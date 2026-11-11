# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-288
Date: 2026-11-11
Pause Required: no

Reviewed: `chg-GH-288-spec.md` v1.1, `chg-GH-288-test-plan.md` v2, `chg-GH-288-plan.yaml`
(revision 1.0, `delivery.plan.v1`, `plan validate` → `valid` / `readyForDevelopment: true`),
`chg-GH-288-pm-notes.yaml`, the ticket body, `doc/planning/oss-tooling/backlog.md` §M2-S11, the M2
pack (`contracts.md`, `architecture.md`, `commands/projects.md`, `entrypoint-delta.md`), and the
delivered sources named in the prompt.

All 35 ACs and all 39 TCs are mapped exactly once in `plan.yaml` (4+1+15+6+3+3+3 = 35 ACs;
5+1+16+6+3+3+5 = 39 TCs) and the traceability matrix in test-plan §3.1 is complete, so
`test_traceability` and `plan_coverage`'s mapping arithmetic pass. The blockers below are not
mapping gaps: they are a design hole in the isolation guarantee, four phase-boundary contradictions
(verified against the gate sources), two spec-internal contract contradictions, one AC whose
evidence cannot be produced with the delivered adapter, and three evidence/ownership claims that
the delivered gates do not support.

## Facet Summary
- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: FAIL
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: FAIL
- dod_defined: PASS

## Findings

### Blocking

B1. **[critical] spec_completeness — spec §5.1 F-1, §8.3 DM-1/DM-3, §23 "Project key"/"Project
   identifier"; plan.yaml phase 1 works 1.1/1.2/1.4**
   Gap: the design permits two distinct repositories to share one project state root. The key is
   "a readable slug" minted once, the state root is `<host root>/projects/<project key>` (§5.1 F-1,
   DM-3), and the glossary concedes the collision by saying the project identifier "distinguishes
   two projects **that would otherwise share a key**". Yet nothing in the path or the index entry
   key is disambiguated by that identifier: if both checkouts mint the readable key `frontend`
   (identical directory basenames — an ordinary workstation case), they write the same
   `phase-state.<REF>.json` and the same `queue.entries:<REF>` under one root, which is exactly the
   collision the ticket removes. Key derivation is never pinned (plan 1.2/1.4 say only "readable
   key" and "minted once"), and no AC or TC cell creates two checkouts whose basenames match
   (TC-PROJ-003 uses `R`/`R-inner`, TC-PROJ-004 uses `clone-a`/`clone-b`, both distinct).
   Suggested remediation target phase: specification
   Suggested fix: pin key uniqueness as a contract — either fold the identifier into the persisted
   key (e.g. slug + stable disambiguator) or key the state root by the project identifier with the
   readable key as a display field — and add one AC + one TC cell ("two checkouts with identical
   directory basenames get distinct keys, distinct state roots, disjoint state"), plus the index
   entry-key rule.

B2. **[major] ac_quality — spec §5.1 F-3 ("read-only with respect to delivery state … never prunes,
   never migrates, never creates a project root"); test-plan §8.3 OQ-T2**
   Gap: an in-scope, contract-level behaviour has no owning AC. F-3 states the read-only posture,
   but AC-F3-1/2/3 assert shape, determinism and exits only, and OQ-T2's disposition is "carried
   inside existing TCs, no new AC" — the same "resolved by acknowledgement" disposition that
   iteration history rejected for the `unbound` scope (which became AC-F1-5). The practical risk is
   concrete: the plan puts index maintenance in `packages/cli/src/production.ts` (phase 2 work 2.4)
   for *every* state-opening invocation, and nothing in the spec says the `projects list` path is
   exempt; a maintenance-on-list implementation would violate DEC-5 and F-3 and would only be caught
   incidentally by a snapshot assertion.
   Suggested remediation target phase: specification
   Suggested fix: add an AC (or extend AC-F3-2) that asserts list writes nothing — index bytes,
   revision and mtime unchanged, no project root created, no prune — and state in §5.1 F-3/§8.1
   that the maintenance step is skipped on the `projects list` path.

B3. **[critical] cross_artifact_consistency / plan_coverage — test-plan TC-PROJ-020 step 8 and
   `Expected Outcome`; plan.yaml phase 4 test obligations; plan.yaml phase 6 work 6.1; verified in
   `scripts/checks/help-guide-coverage.ts` (bidirectional set equality),
   `tests/checks/reference-page-parity.test.ts:41` (set equality with `PROMPT_REQUIRED_COMMANDS`),
   `packages/cli/src/entrypoint.ts` `selectPromptRequiredProgram`**
   Gap: phase 4's owning TC cannot be green at phase 4's boundary. TC-PROJ-020 step 8 requires
   `PROMPT_REQUIRED_COMMANDS` to contain `projects` and the restriction step to keep it, but the
   prompt-required membership, the coverage-inventory entry and the per-command page root are
   phase 6 work (6.1, 6.4, 6.5). If instead the set is changed in phase 4, `help-guide-coverage`
   fails both directions ("missing from the coverage inventory" and, in
   `reference-page-parity.test.ts`, inventory ≠ prompt set) and the M2 page is not yet resolvable
   from `PAGE_ROOT`, so phases 4 and 5 commit a red `pnpm check`. Both orderings are contradictions
   of "every phase is green at its own boundary".
   Suggested remediation target phase: test_planning (primary) or delivery_planning
   Suggested fix: move the prompt-set assertion out of TC-PROJ-020 into TC-PROJ-030 (phase 6), or
   land the prompt-required set + `coverage.json` + page root + page `--help`/`--version` as one
   unit in the phase that owns TC-PROJ-020.

B4. **[critical] cross_artifact_consistency / plan_coverage — test-plan TC-PROJ-001 `Expected
   Outcome` bullet 5; plan.yaml phase 1 test obligations and "Done when"**
   Gap: phase 1's headline TC cannot be green at phase 1's boundary. TC-PROJ-001 asserts "The host
   root `H` … listing is exactly **the host index** plus the `projects/` container", but the host
   index (schema, adapter, maintenance) is phase 2 work (2.1-2.3) and no phase-1 artifact creates
   it. Phase 1's `Done when` correctly says only "the host root holds no store artifact", so the
   TC and the plan disagree with each other and the TC asserts a phase-2 deliverable.
   Suggested remediation target phase: test_planning
   Suggested fix: restate TC-PROJ-001's host-root assertion as "contains no store artifact" (the
   exact host-root set assertion already lives in TC-PROJ-021 and TC-PROJ-026), or move the exact
   set assertion into the index-owning phase.

B5. **[critical] plan_code_area_coverage — plan.yaml phase 1 works 1.2/1.3 and header "PINNED
   CONTRACTS"; test-plan TC-PROJ-020 steps 2 and 5; verified against `.dependency-cruiser.cjs`
   rule `tier-domain-only-contracts`**
   Gap: the plan's placement of the policy contradicts a gate that the same phase's `Done when`
   requires (`pnpm check:boundaries`). `tier-domain-only-contracts` states "domain may import
   ./contracts only" and forbids `packages/core/src/domain/` → `packages/core/src/config/`, while
   plan 1.2 puts the policy in `packages/core/src/domain/state-scope.ts` and 1.3 (and the header)
   say the policy "consumes" `resolveStateDirectoryScope` from `packages/core/src/config/catalog.ts`
   — an import that fails depcruise. The only core tier allowed to import both is
   `packages/core/src/app/`. Relatedly, the test plan and the plan name *different* files "the
   policy": TC-PROJ-020 steps 2/5 require the one home-plus-brand derivation and the one
   `_STATE_DIR` read to live in "the policy module", which is `catalog.ts`, while the plan's policy
   is `domain/state-scope.ts`; the structural assertion therefore has no determinate target.
   Suggested remediation target phase: delivery_planning
   Suggested fix: state explicitly that the caller resolves the host root through
   `resolveStateDirectoryScope` and injects it into the pure policy (no domain→config edge), or
   move the policy to `packages/core/src/app/`; then name that single module in TC-PROJ-020 steps
   2-6 and in plan 1.2/1.3.

B6. **[critical] ac_quality / cross_artifact_consistency — spec §17 AC-F3-3, §24 Appendix A rows 3-4;
   test-plan TC-PROJ-013 precondition and step 3; plan.yaml phase 1 work 1.5; verified in
   `packages/adapters/src/repo/index.ts` (`findGitRoot`, `resolveGitDir`)**
   Gap: the "identity cannot be read" refusal has no producible provocation with the delivered
   adapter, and the plan preserves the collapse. `findGitRoot` returns `undefined` when a `.git`
   *file* does not start with `gitdir:` — indistinguishable from "not a git work tree" — and
   `resolveGitDir` returns `undefined` for a missing/empty `gitdir:` line, so
   `resolveCheckoutGitDirectories` cannot report "git metadata present but unreadable". TC-PROJ-013's
   cell 3 provokes exactly that ("the `.git` file's `gitdir:` target is unparsable or points
   nowhere") and expects exit 1 with `projects.identity-unreadable`; a non-`gitdir:` `.git` file
   resolves to the `unbound` path (exit 0 per AC-F1-5), and a `gitdir:` pointing at a non-existent
   directory resolves a git dir that cannot host a marker, i.e. a state-location failure per
   Appendix A row 3/DEC-8. Plan 1.5 says the read is extended "reusing `findGitRoot` and
   `resolveCheckoutGitDirectories`", which keeps the ambiguity. The subject is also ambiguous:
   AC-F3-3 "a managed checkout whose identity cannot be read" reads as an *indexed* project, while
   TC-PROJ-013 provokes the *invoking* checkout.
   Suggested remediation target phase: specification
   Suggested fix: declare a distinct checkout-read outcome ("git metadata unreadable") as new
   adapter behaviour in §5.1 F-1/Appendix A and phase 1's code area, and name in AC-F3-3 whose
   identity is at issue (invoking scope vs indexed entry); or redefine the cell as a present but
   unreadable identity marker and drop the git-metadata row from Appendix A.

B7. **[critical] cross_artifact_consistency — spec §15 DEC-8 vs DEC-16, §17 AC-F3-3, §24 Appendix A
   row 3**
   Gap: two decisions specify contradictory behaviour for the same cell, and nothing covers it.
   DEC-8 puts `projects.state-unavailable` on "a state location … that cannot be established at all
   (including an uncreatable identity marker)"; DEC-16 requires that error to "name the project key
   and its state location". When the marker cannot be created there is no key and no derived state
   location, so the naming contract is unsatisfiable. AC-F3-3 covers only two cells (unreadable
   identity, present-but-unreadable state location); no AC and no TC exercise the
   uncreatable-marker cell, although §21 makes it a hard rule ("A marker that cannot be created is
   a state-location failure, never a silent path-derived substitute").
   Suggested remediation target phase: specification
   Suggested fix: give the uncreatable-marker cell its own identity (or make the key/state-location
   naming conditional in DEC-16), and add it to AC-F3-3 with an owning TC cell.

B8. **[major] cross_artifact_consistency — `doc/planning/oss-tooling/milestones/m2/commands/projects.md`
   ERORS table and EXAMPLES; spec §16.1 rows for that page; plan.yaml phase 6 work 6.3; AC-F1-5,
   AC-F3-2, DEC-10**
   Gap: the delivered reference page will contradict the delivered behaviour, and the enumerated
   corrections omit both contradictions. The pack page documents `projects.identity-unreadable` as
   "the check-out identity cannot be derived; **the root is not a git work tree**" at exit 1, while
   AC-F1-5/DEC-10 require an out-of-checkout invocation to exit 0 on the declared `unbound` scope;
   and its EXAMPLES show `daemon` as `reachable`/`unreachable` while AC-F3-2 requires the declared
   reason token and forbids a bare negative. §16.1 and plan 6.3 correct only the `STATE` column and
   the `projects.state-unavailable` wording (§16's generic "the delivered errors" is not enough —
   both correction lists are otherwise itemised). TC-PROJ-030 only asserts the page contains
   `--help`/`--version`, so the drift would pass the gate.
   Suggested remediation target phase: specification
   Suggested fix: add both corrections to §16.1's page row and to plan 6.3, and add a
   review-verified assertion to TC-PROJ-034 that the page's error row and `daemon` example agree
   with AC-F1-5 and AC-F3-2.

B9. **[critical] plan_code_area_coverage — plan.yaml phases 5/6/7 `scope.files`;
   test-plan TC-PROJ-028 and TC-PROJ-032; verified in `scripts/checks/forbidden-literals.ts`
   (`unregistered user-facing doc absent at corpusBaseline`) and
   `tests/checks/forbidden-literals.test.ts` (`scan(ROOT)`)**
   Gap: no phase owns `scripts/checks/forbidden-literals.registry.json`. Adding the new guide
   `doc/guides/migrating-to-per-repository-state.md` (phase 5 work 5.4) makes every file under `doc/`
   that is absent at `corpusBaseline` and absent from `registered` a hard failure, i.e.
   `pnpm test` goes red the moment the guide lands. The test plan knows this (TC-PROJ-028 step 1,
   TC-PROJ-032 step 2 "the registry diff shows exactly one addition"), but the registry appears in no
   phase's file list and in no phase's `Done when`, so the blast radius is undeclared and phase 5
   cannot be committed green.
   Suggested remediation target phase: delivery_planning
   Suggested fix: add the registry to phase 5's `scope.files` (and to its `Done when` via
   `bun test tests/checks/forbidden-literals.test.ts`), or to phase 6 with TC-PROJ-032.

B10. **[major] ac_quality — spec §17 AC-F9-2, AC-F10-3 (evidence class column) and the §17 preamble
    rule; test-plan §3.1 rows for both and TC-PROJ-035; verified in
    `tests/checks/privacy-release.test.ts` (TC-RELEASE-001/002)**
    Gap: two ACs declare evidence the delivered gates do not produce, in violation of the spec's own
    rule that a contract-stability half must be named review-verified. (a) AC-F10-3 claims `Suite`
    for "no dependency or lockfile change accompanies it", but TC-RELEASE-001 asserts only changeset
    count/shape/body and pre-existing byte-identity, and TC-RELEASE-002 asserts manifests stay
    `0.0.0` and that `pnpm install --frozen-lockfile` succeeds — which also passes after a
    legitimate dependency + lockfile change. (b) AC-F9-2 claims `Suite` while including "the M1
    milestone snapshot pages are unmodified", a diff against a moving base (AC-F9-3 is correctly
    split; AC-F9-2 is not). TC-PROJ-035/030 do state the review split, so spec and test plan
    disagree on the class.
    Suggested remediation target phase: specification
    Suggested fix: split both evidence columns explicitly ("Suite; the lockfile/diff half is
    review-verified") and mirror that in §3.1, exactly as AC-F9-3 already does — or add a real
    assertion for the lockfile clause.

B11. **[major] ac_quality — spec §17 AC-F6-4; test-plan TC-PROJ-023; plan.yaml phase 4 work 4.4 and
    summary; verified in `packages/core/src/config/catalog.ts` (`resolveDaemonSettings`) and
    `packages/cli/src/daemon-compose.ts`**
    Gap: AC-F6-4 is satisfied by the pre-change build and is nevertheless declared `Suite`.
    `resolveDaemonSettings` already derives `socketPath` from whatever `stateDirectory` it is given
    and already refuses a path outside it; TC-PROJ-023 steps 1-5 call that function directly with a
    project root, so an unmodified tree passes every clause. Per §17's own definition this must be
    `mutation-verified`. Relatedly, plan 4.4 instructs "`packages/cli/src/daemon-compose.ts`: the
    daemon socket path derives from the project state root through the delivered rule", but
    `daemon-compose.ts` contains no socket derivation (it consumes `composition.settings.socketPath`
    / an override), and `resolveDaemonSettings` has no caller anywhere in `packages/**` — the
    unmounted build never resolves a socket, so the "daemon socket derivation" consumer in NFR-9's
    seven is not a live site.
    Suggested remediation target phase: specification (evidence class) and delivery_planning (site)
    Suggested fix: reclassify AC-F6-4 as mutation-verified against the containment/derivation rule,
    and restate plan 4.4 to name the actual integration point (or explicitly declare that the socket
    consumer is asserted structurally only because the daemon is unmounted).

B12. **[major] decision_capture — spec §15 DEC-1, DEC-3, DEC-12, DEC-13; plan.yaml phase 7
    `scope.files`; `doc/decisions/00-index.md`**
    Gap: four precedent-setting decisions are captured only in a change artifact. DEC-1 (durable
    workstation state layout: host root + `projects/<key>`), DEC-3 (project identity = git common
    dir marker, never path or remote), DEC-12 (one state-scope policy below the CLI tier that every
    future surface must consume) and DEC-13 (the help gates learn a per-command reference-page root,
    changing how every future command is documented) all bind later changes. The repository's
    established practice is to graduate exactly this class into `doc/decisions/**` (TDR-0004 state
    storage engine, TDR-0015 handover semantics, TDR-0021 additive harness marker — the last driven
    from a spec OQ). No decision record is proposed and no phase's scope carries one, so future
    deliveries will find a stale change folder rather than durable truth.
    Suggested remediation target phase: specification
    Suggested fix: add the decision-record obligation to §15/§16 (at minimum one TDR for the state
    root + identity + policy rules), route authoring to `@decision-advisor`, and add the record path
    to plan phase 7's `scope.files`.

### Advisory

A1. **[minor] cross_artifact_consistency — spec §5.1 F-9 and §11 RSK-11 (board precedent)** —
    "its command definition exists in the composition, but it is not prompt-required, so the
    composed program drops it" is contradicted by source: `production.ts` composes no `board`, and
    `edge.ts` registers `board` only when an optional `BoardComposition` is supplied (`if
    (options.board !== undefined) commands.board = …`). The delivered silent-drop mechanism exists,
    but the cited precedent is wrong, and adding `projects` to the prompt set while uncomposed would
    *throw* in `selectPromptRequiredProgram`, not drop. Fix: correct the wording to match
    `entrypoint-delta.md` ("a command definition existing in the edge composition is not enough").
    Target: specification.

A2. **[minor] cross_artifact_consistency — spec §16.1 state-layer row, AC-F10-1, test-plan
    TC-PROJ-033** — both require the state-layer page to name the host index "as the only host-level
    document", which contradicts DM-3, DEC-9, AC-F7-1 and TC-PROJ-025 (the host-wide owner-hold
    marker also lives at the host root). Plan phase 7 already words it correctly ("the only
    host-level document besides the host-wide owner-hold marker"). Fix: align §16.1/AC-F10-1/
    TC-PROJ-033 with the plan's wording. Target: specification.

A3. **[minor] spec_completeness — spec §5.1 F-2, §9 NFR-4; test-plan TC-PROJ-010 step 1** — the
    index write rule is unpinned, and the test forces one reading: TC-PROJ-010 requires three
    successive *unchanged* maintenance runs to bump the revision by one each, i.e. an unconditional
    write per invocation, while NFR-4 allows "at most 1" (including zero) and F-2 calls the index a
    derived cache. Fix: state whether the index writes per invocation or only on change, and make
    TC-PROJ-010 consistent. Target: specification.

A4. **[minor] spec_completeness — spec §8.3 DM-2 and §5.1 F-8 legacy predicate** — the host index
    document's file name is never pinned, while the legacy-detection predicate is "the host root
    holds at least one delivered store artifact". Nothing excludes the host index (or a future
    host-level document) from that detector, so a name that matches a store-artifact shape would
    make every migrated host warn forever (AC-F8-2's "no warning on a migrated host"). Fix: pin the
    host index name in `packages/core/src/contracts/projects.ts` and state that the legacy predicate
    excludes the host index, the owner-hold marker and the `unbound` scope. Target: specification.

A5. **[major] plan_code_area_coverage — test-plan §7 "Mocking requirements", §6 new fixtures;
    TC-PROJ-037 steps 3-5, TC-PROJ-036 step 3** — both TCs rely on "a counting index seam" and "a
    counting filesystem edge", but the declared injectable seam list for the production harness
    (`homeDirectory`, environment record, `cwd`, spawn runner, transport, git child runner, daemon
    capability, clock, run-id) contains neither, and TR-1 forbids the harness from accepting roots
    or keys. The plan never names the seam in the composition facts, so "index reads ≤ 1 / writes ≤
    1 per invocation" is not observable through the real path. Fix: name the counting index/edge
    seam among the declared composition facts (observability-only, no path inputs) and add it to the
    plan's phase 2/3 scope. Target: test_planning + delivery_planning.

A6. **[minor] cross_artifact_consistency — test-plan §7 rows for TC-PROJ-030 and plan.yaml phase 3
    `Done when`** — (a) `tests/checks/reference-page-parity.test.ts` is marked "Existing – No
    Change" while plan 6.4 adds the per-command page root to that file (DEC-13): it is an update.
    (b) Phase 3's `Done when` names `tests/checks/error-table-sync.ts`; the delivered file is
    `tests/checks/error-table-sync.test.ts`, so the stated command fails. Fix: correct both rows.
    Target: test_planning.

A7. **[minor] plan_doc_update_coverage — plan.yaml phase 5 work 5.4, spec §16.1 migration-note row**
    — `doc/guides/**` documents carry a generated header block (Copyright / Apache-2.0 / `source:`)
    plus `ados_distribution`, and the repo rule is that agents never hand-write the header;
    `scripts/add-header-location.sh` owns it. Only `ados_distribution` is stated. Fix: add the
    header-generation step (and the resulting `test-doc-distribution.sh` install-set consequence) to
    phase 5's work and done-when. Target: delivery_planning.

A8. **[minor] plan_coverage — plan.yaml phase 2 `Done when`** — it claims behaviour with no owning
    test at that boundary: "the corrupt document is preserved exactly once with its bytes intact"
    belongs to TC-PROJ-008, which the plan itself assigns to phase 3. Either add a seam-level
    assertion in phase 2 or drop the claim from phase 2's `Done when`. Target: delivery_planning.

## Notes for the rerun

- Re-run this gate after the specification reopens for B1, B6, B7, B8, B10, B11/A1/A2/A4,
  test_planning for B3, B4, A5, A6 (and A3 if the spec changes the write rule), and
  delivery_planning for B5, B9, A7, A8.
- Verification already performed and not re-raiseable: the three derivation sites and
  override-blindness (§2.1 R3), the store artifact set and workspace scoping, the identity-marker
  discipline (synced sibling + link, `0600`, create-once), the unmounted daemon and the
  `daemon-not-mounted` consequence, the `_STATE_DIR` rule and the socket-containment rule, the
  help-coverage/parity set equalities, the error-table bidirectional sync, and the release-gate
  shape (exactly one added changeset, five fixed packages at `minor`, testkit excluded, body
  non-empty, pre-existing unchanged) — all check out, except where listed above.
- No pause flag: every remedy is inside `specification`, `test_planning` or `delivery_planning`.
  If the authors prefer a recorded ruling for B1 (key derivation) or B7 (uncreatable-marker
  identity), route it to `@decision-advisor` as part of B11 rather than stopping for a human.
