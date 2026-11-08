# GH-266 delivery verification evidence

Change: `2026-11-07--GH-266--evidence-based-handover-gate`
Branch: `docs/GH-266/evidence-based-handover-gate`
Plan: `chg-GH-266-plan.yaml` v1.3 (tier `lite`, phases P1..P3, 22/22 TCs)
Base: `origin/main-tools` (`f87ec185a672a4d226434b6e903a71a18e8f8ade`)

Every procedure is uncommitted inspection copied verbatim from
`chg-GH-266-test-plan.md` section 7.1 into `/tmp/gh266-procedures/p00.sh` ..
`p17.sh` and run from the repository root with `BASE=origin/main-tools`.
No test code, suite, or harness was added or changed.

## Phase commits

| Phase | Commit | Subject | Completed TCs |
|---|---|---|---|
| P1 | `27ae00009f012ab14fe3fd30c20f4098117e327d` | docs(GH-266): redefine the M1-S9 clean bar on evidence | TC-GATE-001, 002, 003, 004, 005, 010, 018, 022 |
| P2 | `a32cf599219064b6325d410f0adda134a03e5310` | docs(GH-266): record the CEO-D-073 handover amendment in status | TC-GATE-006, 007, 008, 009, 011, 019, 020, 021 |
| P3 | this evidence commit (`git log -1`) | docs(GH-266): record verification evidence for the handover-gate amendment | TC-GATE-012, 013, 014, 015, 016, 017 |

## Plan validation

Recorded verdict from the plan header (v1.3): `verdict=valid`,
`readyForDevelopment=true`, `totalErrors=0`, `schemaVersion=delivery.plan.v1`,
`tier=lite`, `phases=1..3`, 22/22 TCs mapped exactly once (P1=8, P2=8, P3=6)
and 17/17 ACs covered. No `plan` binary is installed in this checkout, so the
header record is the authority (plan D-10).

## P1a/P1b/P1c: containment and whitespace (TC-GATE-012, TC-GATE-017)

```
$ BASE=origin/main-tools bash /tmp/gh266-procedures/p01.sh
doc/planning/oss-tooling/backlog.md
doc/planning/oss-tooling/status.md
none
exit=0
```

`git diff --check origin/main-tools...HEAD` printed nothing and returned
`exit=0`. No conflict markers appear in the added lines.

The two product paths are the complete product diff outside `doc/changes/**`:

```
$ git diff --stat origin/main-tools...HEAD -- doc/planning/oss-tooling/
 doc/planning/oss-tooling/backlog.md | 25 +++++++++++++++++++---
 doc/planning/oss-tooling/status.md  | 41 +++++++++++++++++++++++++++++++++++--
 2 files changed, 61 insertions(+), 5 deletions(-)
```

## TC evidence

| TC | Procedure | Command (section 7.1) | Expected | Observed |
|---|---|---|---|---|
| TC-GATE-001 | P3 | `bun -e '…' backlog.md` | `conditions=4/4` | `a-truth: OK`, `b-classes: OK`, `c-floor: OK`, `d-corroboration: OK`, `conditions=4/4` |
| TC-GATE-002 | P2 | `bun -e '…' backlog.md` | `occurrences=0 unmarked=0` | `occurrences=0 unmarked=0` |
| TC-GATE-003 | P3 (`floor-scope`) | same as TC-GATE-001 | `floor-scope=OK` | `floor-scope=OK` |
| TC-GATE-004 | P4a | `git diff -U0` + `awk` + `cmp` + 4 greps | `M1-S9 AC+Depends byte-identical`, no `MISSING:` | `M1-S9 AC+Depends byte-identical`; no `MISSING:` lines |
| TC-GATE-005 | P4b | `git diff -U0 … \| grep -E '^[+-]#{3} M1-S9'` | `heading unchanged` | `heading unchanged`; both heading lines print `529:### M1-S9 Dispatch engine: dual-run evidence and per-repo handover` |
| TC-GATE-006 | P5 | `bun -e '…' status.md` + render review | `missing=0` + rendered section | `amendment: ## M1-S9 handover amendment: evidence-based clean bar (2026-11-07, CEO-D-073)`, `residual-named=8`, `missing=0`; render review note below |
| TC-GATE-007 | P6a + P6b | `bun -e '…' status.md base-status.md` | `forward=2 pointed=2 pointer-shape=2/2 bytes=2/2`; 332 and 247 bytes | `history (no pointer required): - The dual-run pilot starts now and runs concurrently with M1 planning and`, `forward bytes milestone-exit-forward: byte-identical (332 bytes)`, `forward bytes next-steps-item-3: byte-identical (247 bytes)`, `forward=2 pointed=2 pointer-shape=2/2 bytes=2/2` |
| TC-GATE-008 | P7a/P7b/P7c/P7d | `awk` + `cmp` with reflow negative control | three statement lines + `negative control: reflow detected` | `2026-11-03 section byte-identical`, `lead-in byte-identical`, `statement 1 byte-identical (213 bytes, 3 lines)`, `statement 2 byte-identical (72 bytes, 1 lines)`, `statement 3 byte-identical (582 bytes, 8 lines)`, `negative control: reflow detected`, `P7 verdict: OK` |
| TC-GATE-009 | P8 | `bun -e '…'` on both files | `sources=3/3 insufficiency=OK` twice | `backlog.md: sources=3/3 insufficiency=OK`, `status.md: sources=3/3 insufficiency=OK`; exactly-three read note below |
| TC-GATE-010 | P9 + negative control | `bun -e '…'` importing `DELIVERY_RESULT_TOKENS` | `tokens=11 missing=0 extra=0 duplicates=0`; negative `missing=1` | `tokens=11 missing=0 extra=0 duplicates=0`; negative control `tokens=10 missing=1 extra=0 duplicates=0` + `missing: pr-open-unverified`, exit 1 |
| TC-GATE-011 | P10 | `awk` + `cmp` + `head` + `git diff \| grep -c` | three expected lines | `backlog frontmatter byte-identical`, `status has no frontmatter`, `0` |
| TC-GATE-012 | P1a/P1b | `git diff --name-only … ':(exclude)doc/changes/**'` | two product paths, `none` | two `doc/planning/oss-tooling/*.md` paths, `none` |
| TC-GATE-013 | P11 | `bash scripts/.tests/test-doc-distribution.sh` | guard OK, `exit=0` | `(guard-doc-distribution)[OK] no drift — 81 in-scope docs; install set matches ados_distribution markers`, `exit=0` |
| TC-GATE-014 | P12 + P17 | `bun run scripts/checks/forbidden-literals.ts`; added-line scan | `5/5 … 0 violations`, `exit=0`; `added-lines=N seed-hits=0`; matcher `ados` / `~/.ados` / `none` | `OK forbidden-literals: 5/5 scope classes scanned, 0 violations`, `exit=0`; `added-lines=61 seed-hits=0`, `seed scan exit=0`, `positive: ados`, `positive2: ~/.ados`, `negative: none`, `P17 verdict: OK` |
| TC-GATE-015 | P13a/P13b | `git diff \| grep -oE` + existence loop | `broken=0` | added link `backlog.md`; `broken=0` |
| TC-GATE-016 | P14 + read | `bun -e '…'` on both files | two summary lines + read note | `backlog.md: corroboration=3/3 incident=OK classes=OK floor=OK`, `status.md: corroboration=3/3 incident=OK classes=OK floor=OK`; contradiction read note below |
| TC-GATE-017 | P1c + `--stat` | `git diff --check` | `exit=0`, proportionate stat | `exit=0` with no output; stat `2 files changed, 61 insertions(+), 5 deletions(-)` |
| TC-GATE-018 | P15a/P15b | hunk classifier + derived boundary self-tests | `hunks: inside=N outside=0`, `hunk confinement OK`, derived self-tests, `stories compared: 66` | `M1-S9 entry lines: 529..578`, `backlog.md hunks: 2`, `hunks: inside=2 outside=0`, `hunk confinement OK`, `OUTSIDE: @@ -628,1 +628,1 @@` and `OUTSIDE: @@ -579,1 +579,0 @@`, two inside blocks, `other-story AC/Depends byte-identical`, `stories compared: 66`, `negative control detected the M1-S8 edit`, `P15 verdict: OK` |
| TC-GATE-019 | P7a + P16 (`adjudication`) | `cmp` of the dated section + marker check | `2026-11-03 section byte-identical`, `adjudication: missing=0`, coverage mutant | `2026-11-03 section byte-identical`; `adjudication: missing=0`; `mutant coverage: changed=true adjudication-missing=stricter-coverage` |
| TC-GATE-020 | P16 (`lead-in`) | marker check with two mutants on the flattened form | `calendar-window-alone=OK elapsed-only-phrase=ABSENT floor-scope=OK`; both mutants | `lead-in: calendar-window-alone=OK elapsed-only-phrase=ABSENT floor-scope=OK`; `mutant lead-in: changed=true raw-single-line-noop=true calendar-window-alone=MISSING`; `mutant elapsed-only-phrase: changed=true elapsed-only-phrase=PRESENT` |
| TC-GATE-021 | P16 (`citation`) | exact-literal check with a mutant | `citation: OK`; `mutant citation: changed=true citation=MISSING` | `citation: OK`; `mutant citation: changed=true citation=MISSING` |
| TC-GATE-022 | P4c + P4d | raw-text slicing + two mutants | five region lines, mutants fired, `P4 verdict: OK` | `region goal: byte-identical (244 bytes)`, `region ticket: byte-identical (32 bytes)`, `region phase-a: byte-identical (231 bytes)`, `region handover-flips: byte-identical (85 bytes)`, `region covers-functions: byte-identical (213 bytes)`, `negative control frozen-region mutation: fired=yes named_phase_a_and_handover_flips=yes`, `P4 verdict: OK` |

### TC-GATE-010 eleven-token set comparison (verbatim)

```
$ BASE=origin/main-tools bash /tmp/gh266-procedures/p09.sh
tokens=11 missing=0 extra=0 duplicates=0
exit=0
```

Negative control (token removed from a copy; see the deviation note):

```
$ BASE=origin/main-tools bash /tmp/gh266-procedures/p09-neg.sh
tokens=10 missing=1 extra=0 duplicates=0
missing: pr-open-unverified
neg exit=1
```

The compared set is `DELIVERY_RESULT_TOKENS` from
`packages/core/src/contracts/delivery-result.ts` (eleven tokens), and the
enumeration paragraph in the M1-S9 entry is set-equal to it.

### TC-GATE-018 derived boundary assertion (verbatim)

```
$ end=$(awk '/^### M1-S9 /{s=NR} s&&/^### /&&NR>s{print NR-1; exit}' doc/planning/oss-tooling/backlog.md)
$ boundary=$((end+1))
$ grep -Fq "OUTSIDE: @@ -${boundary},1 +${boundary},0 @@" /tmp/gh266-p15.txt
derived end=578 boundary=579
derived-boundary assertion: PASS
```

No hardcoded `560` is asserted anywhere; `end+1 = 579` is the next `### M1-S10`
heading line and is classified `OUTSIDE`, while `end = 578` is inside.

## Guard outputs (verbatim)

### P11 — doc-distribution (TC-GATE-013)

```
(guard-doc-distribution)[OK]   get_marker() self-tests passed (7 .md + 4 .yaml cases)
(guard-doc-distribution)[OK]   no drift — 81 in-scope docs; install set matches ados_distribution markers
exit=0
```

### P12 — forbidden literals (TC-GATE-014)

```
OK forbidden-literals: 5/5 scope classes scanned, 0 violations
exit=0
```

The guard scans registered docs only; `status.md` is registered and
`backlog.md` is not. P17 compensates (accepted residual N-1).

### P17 — added-line seed scan (TC-GATE-014)

```
added-lines=61 seed-hits=0
seed scan exit=0
positive: ados
positive2: ~/.ados
negative: none
P17 verdict: OK
```

### P13 — link integrity (TC-GATE-015)

```
backlog.md
broken=0
```

## Manual reads

- TC-GATE-016 steps 2-4 (side-by-side contradiction read): the M1-S9 entry and
  the status amendment agree on all four conditions (pilot-path truth,
  eleven-class `TDR-0005` coverage on real tickets, the `>=20 dispatches` or
  `>=7 consecutive days` floor, corroboration), on the floor-only scope of
  `whichever comes first`, and on exactly three corroboration sources
  (completed pm-notes phases, tracker state, CI on the pushed head). No
  statement in `status.md` weakens, widens or contradicts the backlog
  definition; the status section defers to `backlog.md` as canonical.
- TC-GATE-006 step 4 (markdown render review): the new section is a single
  `##` heading followed by four blank-line-separated paragraphs; it adds no
  list, table or nested heading; the only relative link
  `[backlog.md](backlog.md)` resolves from `doc/planning/oss-tooling/`
  (confirmed by P13 `broken=0`).

## Declared residual and disclosures

- **Declared residual (spec section 7.2):** the superseded calendar phrasing
  still appears in `backlog-ranking.md`, `roadmap.md`,
  `cli-command-registry.md`, `milestones/m1/commands/dispatch.md`,
  `milestones/m1/journeys.md`, `user-journeys.md` and
  `milestones/m1/test-scenarios.md`. These are outside this change's file
  scope and are named in the status amendment; a follow-up change refreshes
  them. `operator-requirements-2026-11.md` is a dated historical record and
  stays as written.
- **GH-239 staleness:** the M1-S9 ticket body quotes the old two-week
  definition. It is reported, not edited (another ticket's body is out of
  scope); disclose in the PR body and add a ticket comment at PR time.
- **DEC-3 disclosure:** the ticket's parenthetical list named ten tokens and
  omitted `pr-open-unverified`; the normative clause ("every TDR-0005 result
  class") governs, so the amendment enumerates all eleven classes. Disclose
  in the PR body and a ticket comment.
- **N-1 accepted residual:** AC-NFR5-1's wording says no new forbidden
  literal is attributable to the two changed files while the guard scans
  registered docs only (`backlog.md` is not registered). Accepted; P17's
  added-line scan with the production `matchSeedLiteral` covers both files
  and reported `seed-hits=0`. No `scripts/**` change was made.

## Deviations from the procedure text

- The P9 block in section 7.1 hardcodes its input path, so appending a file
  argument cannot redirect it. The negative control was run by copying
  `p09.sh` and mechanically substituting the trailing path with `sed`
  (`p09-neg.sh`), never retyping the literals. Positive run and negative run
  are recorded above. No other procedure needed a change.

## Handoff to later phases

- The final `p01a`/`p01b` re-run at the evidence-commit HEAD reports the same
  two product paths and `none`; that confirmation belongs in the PR body, not
  in a second commit (plan 3.5).
- `docs/spec/**` needs no correction: M1-S9/GH-239 is undelivered and
  `feature-scheduling-engine.md` excludes dispatch and handover.
