# Independent Code Review — GH-174 State Layer — Iteration 1

| Field | Value |
|---|---|
| work_item_ref | GH-174 |
| mode | local (lifecycle phase 8 `review_fix`; plan task 9.3 independent re-review) |
| reviewer | `@reviewer` (independent — not the delivery executor) |
| branch / HEAD | `feat/GH-174/state-layer` @ `52e4de1` |
| base | `main-tools` @ `d306c20` (diff `d306c20..HEAD`, `doc/changes/**` excluded; 54 files, +5551/−58) |
| reviewed_at | 2026-10-30 (UTC) |
| verdict | **PASS** — 0 blockers / 0 majors / 6 minors / 2 info; no remediation phase required |
| next step | PROCEED — Phase 9.3 independent-review gate is satisfied by this PASS; advisory findings may be addressed at the PR round or in a follow-up change |
| scope of write | this file + `../code-review/review-iter-1.yaml` (machine state) only; no code, no plan edit, no commit |

## 1. Review method

Read in full: spec v1.1 (§5–§9, §17 all 22 ACs, Appendix A–C), plan v1.1 (D1–D8,
Phases 1–10, execution log), TDR-0004 (incl. Amendments), the executor self-reviews
(`review/review-iter-1.md`, `review/review-iter-2.md`), `feature-state-layer.md`,
`chg-GH-174-evidence.md`, and every changed source file: `contracts/state.ts`,
`contracts/error-table.ts` (diff), `contracts/index.ts` (diff), `state/index.ts`,
`state/ledger.ts`, `state/edge.ts`, `driver/runtime-edge.ts`, `driver/strategy.ts`,
the depcruise/registry/rules/changeset diffs, and the assertion bodies of all 13 state
suites plus `packed-state`, `state-scope`, `state-contract`, `state-imports`, the
fixtures harness, the conformance case registry, and the synthetic consumer.

Independently executed at HEAD (`52e4de1`): `bun test` over all 13 state
structure/behaviour suites → **98 pass / 0 fail** (527 expectations);
`error-table-sync` → `entries=20 documented=20`, both directions;
`forbidden-literals` → 5/5 scopes, 0 violations; `check:boundaries` → clean
(ambient-globals 15 files, entrypoints clean). A Node `node:sqlite` probe confirmed
corrupt-index handling defers errors to `prepare` (inside the caught region).
Full `pnpm check` was not re-run (green at `b4a01d4`+ per evidence; the two
commits after `b4a01d4` are docs/notes only — no code change).

## 2. Hard-AC trace (all 22 ACs, spec v1.1 §17)

| AC | Independent evidence | Verdict |
|----|----------------------|---------|
| AC-F1-1 injected identity, zero derivation | `createStateStore` (`state/index.ts:95-108`) derives every path from `identity`; determinism + ambient-throw edge + ambient-marker scan in `state-contract.test.ts`; `#contracts`-only imports verified by `state-imports.test.ts` walk | PASS |
| AC-F1-2 both-kind parity, no discrimination | 11 data cases × `{jsonl, sqlite}` with byte-digest fixture equality, normalized driver-neutral parity, divergent-driver control, kind-branch AST scan; port type (`contracts/state.ts:208-222`) has no kind discriminant; `strategyFor` (`state/index.ts:79-80`) is the sole branch | PASS |
| AC-F1-3 levels fail classified, no local fallback | `openFailure` (`index.ts:113-121`); zero-write recorder + local-substitution control in `state-contract.test.ts` | PASS |
| AC-F1-4 workspace scoping | shared-directory two-workspace test + scoping-disabled control (`state-ledger.test.ts`); `encodeSegment` escapes `/` `\` `:` — no path traversal through `workspaceId` | PASS |
| AC-F2-1 envelope, append-only, contiguous sequence | field test with an **independent** FNV-1a oracle (not circular); prefix-snapshot append-only assertion + in-place-rewrite control; no-prune-surface type assertion | PASS |
| AC-F2-2 schema mismatch, no coercion | header and record variants fail `state.schema.mismatch`, no values, distinct from torn; supported-version control; open-time identity-version check (`index.ts:122-129`) | PASS |
| AC-F3-1 index divergence → rebuild/`state.write.failed` | 7 index tests: missing/corrupt/divergent/**payload-only** (F-1 regression) rebuild with reported evidence and ledger-byte snapshots; rebuild fault → exactly `state.write.failed` (transient/retryable/`not_landed`); stale-index control | PASS |
| AC-F4-1 torn matrix 5/5, safe locations | six ledger variants with mutation-precondition assertions and `planted-payload-*` canaries; `JSON.stringify(error)` leak sweep; detection-disabled + intact controls; locations are `{path, record}` only | PASS |
| AC-F4-2 verified-empty ≠ torn | dedicated never-conflated test; absent/zero-byte → verified-empty (TDR §1, `ledger.ts:136`) | PASS |
| AC-F4-3 terminal repair, mid-record refusal | repair with byte-equality survivors; refusal changes nothing; auto-repair control; header-verdict-before-truncation regression (F-4 fix) | PASS |
| AC-F5-1 key-set assertion, no defaults | falsy payloads (`0`, `""`, `false`, `null`) exact; missing keys named; default-substitution control; verified-empty satisfies only empty declaration | PASS |
| AC-F6-1 atomic replace crash matrix | full fault-point matrix (`replace-before-temp`/`after-temp-write`/`rename`/`after-rename`, append `before/after-flush`); previous-or-new never partial; direct-write partiality control; stale-temp cleanup on open | PASS |
| AC-F7-1 contention, no double write | two-store-object contention via real `wx` lock; retry-after-release contiguous `[1,2]`; lock-disabled control; unfenced-write negative **compile** fixture (brand rejects forged handle) | PASS |
| AC-F7-2 stale handles, explicit recovery | released/recovered/lost matrix fails `state.lock.busy`; recovery reported (`staleToken`, `recoveredAtMs`); reads available throughout; unstale-recovery refusal control | PASS |
| AC-F7-3 crash-after-land stale fence | `append-after-flush` fault leaves landed record + stale fence; record verifies on read; writes fail until explicit recovery; recovery then re-acquire works | PASS |
| AC-F8-1 POSIX matrix fail-closed | exact-bit 0700/0600 under umask `000` **and** `077`; violated dir/file/`checkIntegrity` all fail `state.permission.denied`; restoration reopens; mode-ignoring control | PASS |
| AC-F8-2 Windows ACL platform-conditional | pure `hasForeignAclGrant` matcher unit-tested on every platform (`BUILTIN\Users`, `Everyone`, `Authenticated Users` reject; current user passes); executable win32 branch; OQ-2 skip recorded; doc-contract + registry assertions | PASS (OQ-2 owner run pending — known open item) |
| AC-F9-1 seven codes round-trip, sync | table rows match spec §8.3 verbatim (compared field-by-field); classification tests incl. kind-only ambiguity containment; `error-table-sync` re-run by this reviewer: 20/20 both directions | PASS |
| AC-F9-2 `not_landed` matrix, safe locations | all seven codes driven through real triggers; write-path 100% `not_landed`; canary sweep incl. payload-including formatter control | PASS |
| AC-F9-3 packed Node/Bun probe | real `pnpm pack` + spawned Node and Bun consumers running both driver kinds through the public subpaths; negative subpath probe; manifest checks; the single sanctioned spawn | PASS |
| AC-F10-1 boundaries with fixtures | `state-imports` AST detector (imports incl. re-export/dynamic/require); depcruise state allowance **tightened** to `state/driver/` with failing fixture + clean control (registry and `cases.ts` verified); ambient globals outside driver absent (grep + marker scan) | PASS |
| AC-F10-2 foundation scope | no CLI command / config import / consumer beyond tests, each proven by seeded-violation controls; synthetic consumer drives every port operation via public package imports only | PASS |

## 3. Plan bindings D1–D8 and repo rules

- **D1** layout exactly as bound (`contracts/state.ts` types-only + single `as const`
  version home; facade; pure `ledger.ts`; runtime APIs only in `driver/**`; edge types
  in the state tier) — verified by read + detector. **D2** built-in-only binding,
  recorded matrix asserted by test (throw, not skip). **D3** rows in-change; sync green
  from Phase 1; doc-sync did not rewrite the documented table. **D4** no CI/check
  topology change (`ci.yml` untouched; registry edit + allowance **tightening** only —
  no weakened rule). **D5** changeset = exactly the five publishable fixed-group
  packages, testkit excluded. **D6** evidence file present, honest about the flake fix
  and about what is executor-run vs independent. **D7** harness with data cases,
  digest equality, map-relative anti-vacuity guards, end-state strength unchanged.
  **D8** AST detector + tightened depcruise allowance with failing fixture.
- **Protected paths**: `git diff --name-only d306c20..HEAD` has zero matches under
  `.opencode/`, `.ados-claude/`, `scripts/*.sh`, `tools/`, `.ai/local/`, `tmp/`.
  The `.ai/rules/typescript.md` one-line edit is the explicitly registered lifecycle-7
  reconciliation input (plan v1.1 F5) — authorized, and it tightens (state → state/driver).
- **Forbidden literals**: reviewer grep over the full diff (excluding `doc/changes`)
  found `ados` only in the scanner registry's own seed literals and sanctioned
  `ados_distribution` markers; check exit 0. **License headers**: none added to new
  files (doc-comments only, as required). **Security review**: no command injection
  (`execFileSync` args-array, `icacls` only on win32 branch); no path traversal
  (workspace IDs URL-escaped; document names whitelisted `^[A-Za-z0-9][A-Za-z0-9._-]*$`);
  no payload/checksum content in errors or evidence (canary-swept); no secrets.

## 4. Independent verification of executor findings F-1..F-7

All seven self-review findings were confirmed **fixed** in code by this reviewer
(not trusted from `review/review-iter-2.md`): payload in the index-agreement tuple
(`strategy.ts:59-74`) + regression test; `checkIntegrity` failure-first
(`index.ts:452`); extracted pure `hasForeignAclGrant` with the corrected single-
backslash matcher (`runtime-edge.ts:103-104`) + cross-platform unit test;
header-verdict-before-truncation in `repairTornTail` (`index.ts:460-463`) + byte-equality
regression; TDR-0004 amendment row + corrected feature-doc torn bullet; unused imports
gone; plan Phase 7/8/9 log rows reconciled.

## 5. Findings

Severity scale per review request: blocker / major / minor / info. All findings are
actionable; none block PASS.

| ID | Severity | Location | Finding | Suggested fix |
|----|----------|----------|---------|---------------|
| IR-1 | minor | `packages/core/src/state/driver/runtime-edge.ts:129` | `appendFile` uses `openSync(path, "a")` without a mode: when the ledger is first created it momentarily exists as `0666 & ~umask` (e.g. 0644) and is only chmod'd to 0600 by `ensureMode` **after** write+fsync. Spec F-8 requires 0600 "at creation"; the creation window is observable to a concurrent local user under a permissive umask. All other creation paths (`wx` 0600, temp 0600, dir 0700) are correct at creation; tests stat only after completion, so the window is invisible to them. | Pass the creation mode: `openSync(path, "a", 0o600)`. One-line fix; optionally add an edge note to TDR-0004 §6. |
| IR-2 | minor | `packages/core/src/state/index.ts:280`; `driver/strategy.ts:132-139` | Every append re-reads and re-verifies the **entire** ledger (`verifiedState`) and the sqlite kind then rewrites the **entire** index (`afterAppend`) — cumulative O(n²) on the write path under spec'd forever-retention (§22 "grows unboundedly by design"). Spec RSK-7's mitigation states "append-time checksums avoid full rescans on write" and TDR-0004 §1 says sequence is assigned "from the verified ledger tail"; the shipped full-rescan-per-append contradicts both records (it is the more conservative correct choice, but it is not what the docs claim). No AC threshold is breached and realistic M0 ledgers are small. | Record the O(n) append-time verification honestly (TDR-0004 amendment + optionally feature-doc operational note), or cache the verified ledger state for the duration of a held fence (safe: appends require the fence; re-verify on acquire). |
| IR-3 | minor | `packages/core/src/state/index.ts:240-254, 429-449`; TDR-0004 §3 | Staleness is purely age-based (`now − acquiredAtMs > staleFenceMs`, default 30 s) with no liveness/heartbeat: a live writer that legitimately holds the fence past the window (long GC pause, slow fsync) can have its fence recovered and re-acquired by another process while still mid-write. `requireFence`'s token re-check narrows but does not close the check-then-append race; the resulting interleaved appends would be caught by torn detection on read, but NFR-4's "0 concurrent double-writes landing" can be violated cross-process. Inherent to the spec'd staleness design; worst case is torn-but-detected, never silent. | Add the residual risk to TDR-0004 §3 negative outcomes (lease-expiry semantics; advise sizing `staleFenceMs` generously and keeping fenced sections short), or refresh `acquiredAtMs` on each landed append so staleness tracks activity rather than acquisition time. |
| IR-4 | minor | `packages/core/src/state/index.ts:464-466` | `repairTornTail()` on a store whose ledger file is **absent** returns `state.store.torn` at record 1, while `read()` on the same state returns verified-empty evidence. DEC-6: absent and torn "are never conflated". AC-F4-2 scopes reads, so no AC is breached, but a caller probing repairability gets a tear verdict for a fresh store — a spirit-level conflation on a sibling operation. | Return `ok({ repaired: false, report: zeros, evidence: verified-empty })` for the absent-ledger case, mirroring the empty-text branch immediately below. |
| IR-5 | minor | `tests/structure/state-contract.test.ts:88-104` | The ambient-global scan (`process.env`, `process.platform`, `Date.now`, `Math.random`, `stateDirectoryName`) checks a fixed list of five files. A newly added file under `packages/core/src/state/` outside `driver/` would not be scanned unless manually registered; the import detector (`state-imports.test.ts`) already walks the tree dynamically, so the two detectors have inconsistent coverage. Current code is clean — this is gate hardening, not a violation. | Walk `packages/core/src/state/**` excluding `driver/` (reuse the `stateFiles()` pattern) instead of the hard-coded list. |
| IR-6 | minor | `packages/core/src/state/index.ts:354-356` | An invalid document name is classified `state.write.failed` (transient, retryable) — but an unsafe name is a permanent caller error and the row's remediation hint ("resolve the underlying storage error and retry") misleads. The spec's seven-code set has no input-validation code, so the implementation picked the nearest row; also note the name is validated before the fence check, so an unfenced caller with an invalid name sees `write.failed` rather than `lock.busy`. | No change required this change (the code set is spec-fixed). Record a candidate input-shaped state code for the first consumer story (M0-S6/S8/S10) or validate names at the consumer edge; optionally move validation after `requireFence`. |
| IR-7 | info | TDR-0004 §5; `runtime-edge.ts:174-177` | The temp file is fsync'd but the containing directory is not fsync'd after `renameSync`. Rename atomicity fully satisfies AC-F6-1 (previous-or-new, never partial); power-loss durability of the rename itself is neither claimed nor explicitly scoped out under the TDR's "durability points". | Optional one-line TDR amendment naming the omitted dir-fsync and why it is acceptable for a local dev substrate. |
| IR-8 | info | `packages/core/src/state/index.ts:420-427` | `fenceStatus()` remains the one public operation outside `StateResult` and does not consult the open-time `failure`: on a permission-violating store it still inspects the lock file (read-only; exposes held/stale/token only, no record data). Already logged as an executor information-only observation; agree no action this change. | Fold into any future port-shape revision (e.g., M0-S6 adoption). |

## 6. Negative-control and test-quality assessment

Controls verified live by reading their assertions (would fail if the guarded behavior
regressed): torn detection-disabled (planted canary would surface), auto-repair
(would discard record 1), default substitution (would fabricate a key), local fallback
(zero-write recorder), lock-disabled double writer, unstale-recovery refusal (no silent
steal), crash matrix pre/post rename, mode-ignoring permission control, payload-
including formatter control, seeded CLI/config scope violations, divergent-driver
control, stale-index control, direct-write partiality control, in-place-rewrite control,
scoping-disabled control. Mutation-sampling: flipping the terminal-completeness check
degrades truncated-tail to framing (both torn — acceptable; variant discrimination is
transitively proven by repair refusal); removing payload from the agreement tuple fails
the F-1 regression; weakening exact-bit stat comparison fails the mode-ignoring control.
Checksum verification uses an independent oracle (re-implemented in the harness), not
the production function. Fixtures are generated per run under `mkdtemp` roots with
`gh174-` prefixes; no binary fixtures; no real HOME/state paths; no `.skip`/`.todo`/
`.only` (grep-verified). The known-weak fence "silent-steal control" (shape-only) is
already flagged by the executor; the behavioral control exists at
`state-fence.test.ts:283-298`.

## 7. Verdict

**PASS.** All 22 ACs trace to real implementation with non-vacuous, control-backed
tests; plan bindings D1–D8 hold; repo rules (protected paths, forbidden literals,
headers, changeset) verified clean; the executor's F-1..F-7 fixes are independently
confirmed. The six minor findings are advisory (two are doc-truthfulness gaps between
spec/TDR claims and the conservative shipped behavior; one is a small permission
creation window; one an edge-case conflation; two gate/taxonomy hardening items) —
none breach an AC or NFR threshold, none weaken the headline properties (torn state is
never silently read as zeros; no implementation-dependent call sites). No remediation
phase is appended; findings may be addressed at the PR round or in a follow-up change.
No owner/TDR acceptance is claimed; OQ-2 (Windows verification) and TDR-0004 Proposed
status remain owner gates as recorded.

*Machine-readable state: `../code-review/review-iter-1.yaml` (same findings, schema severities).*
