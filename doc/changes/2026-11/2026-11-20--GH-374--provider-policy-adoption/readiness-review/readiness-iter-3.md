# Readiness Review Iteration 3

Verdict: READY
Work Item: GH-374
Date: 2026-11-21
Pause Required: no

## Scope of the review

Final iteration. Reviewed: `chg-GH-374-spec.md` v1.5, `chg-GH-374-test-plan.md`
v1.2, `chg-GH-374-plan.yaml` revision 1.2, against iteration 2's N1–N8 and its
remediation map. Method: targeted reads of the changed sections plus point checks
against the tree; no whole-artifact re-read. This is the third iteration, so every
remaining observation is recorded as a residual risk rather than as a new
requirement.

## Facet summary

- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: PASS
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

## Iteration-2 finding closure

| ID | Sev | Status | Evidence (artifact + line) and what changed |
|---|---|---|---|
| N1 | major | **CLOSED** | Spec AC-F2-2 (515) now names **model-anchored** classes `claude-(opus\|sonnet\|haiku\|\d)`, `gemini-\d`, `gpt-\d`, `glm-\d`, `deepseek-[a-z0-9]`, states "no family class is a bare prefix, so a tool or script name such as `build-claude-plugin.sh` can never match", and scopes the generated-pair comparison to "the **prompt body after the provenance header** … asserted separately". Repeated in Appendix D (764) and the glossary entry *Model literal* (616). Test plan: AC row (109), SCAN-004 (417), SCAN-006 (419), failing control (272). Plan: revision block (28–42) and phase-2 contract (682–711). All three state the same rule. |
| N2 | major | **CLOSED** | Spec A-5 (400) now reads "the figures `20` (trailing day) and `30` (ticket) … The window figure must stay below the ticket figure (DEC-21)". Matches DM-8 (326), DEC-10 (456), DEC-21 (467), AC-F4-1 (518), §18 (546, 555), Appendix A (830). No reversed pair survives operationally. |
| N3 | major | **CLOSED** | Spec F-4 (176) now reads "the ticket crossing **fails** the entries with **no park and no `skipped` list** … ends in `provider.budget.exceeded` at exit `1` when nothing else can supply an honest resume". Matches AC-F4-1 (518) and the delivered chain/CLI shape cited in iteration 2. DM-8 (326) and RSK-6 (381) carry the same consequence. |
| N4 | critical | **CLOSED** | See the dedicated section below. |
| N5 | minor | **CLOSED** | Spec line 437 now reads "the only newly closed **time-of-day interval** is 04:00–06:00 (weekends and Chinese public holidays are additionally paused — DEC-9)". Consistent with §1 (57), RSK-3 (378), DEC-17 (463), §18 (557). |
| N6 | minor | **CLOSED** | Test plan §7.1 (597) and §8.3 (698) no longer attribute a sixth suite to the plan; both now say the plan folds the migration cases into the reference suite and declares "the same six test files (five new plus the extended `doc-conformance`)". Plan corroborates at 51, 372, 409, 961. |
| N7 | nit | **CLOSED** | SCAN-002's AC cell (328) is `AC-F6-1 (identifier class via TC-POL-SCAN-004)`; its detail (415) says the identifier class "is a **pointer** to SCAN-004, not an oracle of this case" and "AC-F2-2 is not claimed here". The AC-F2-2 forward row (109) lists SCAN-004/006/007 only. |
| N8 | nit | **CLOSED** | Test plan §8.2 (680) cites `originLabel` in `packages/core/src/config/provenance.ts:21–23` and keeps `resolver.ts:344–363` only for the defaults **origin object**. Verified in the tree: `originLabel` is defined at `provenance.ts:20` and its `layer=… file=… line=…` return is line 23; the defaults origin object is constructed inside `resolver.ts:344–363`. The plan's DRIFT-006 note (892–894) cites the same module. |

## N4 (critical) — credential control, re-verified

Greps over the three artifacts:

- `sk-live` — **0 hits** in spec, test plan, plan.
- `4f9c` — **0 hits** in spec, test plan, plan.
- `*_API_KEY=<value>` — the only assignment-shaped text is in a plan comment
  block (plan 1230–1232): `ANTHROPIC_API_KEY=sk-ant-...`,
  `ZAI_API_KEY=<YOUR_KEY>`, `OPENAI_API_KEY=$OPENAI_API_KEY`, plus the
  `sk-ant-…` form. Every one is a declared carve-out token, not a value. No
  assignment in the spec or the test plan carries a value. No 24+-character
  hex/live-shaped token exists in any of the three.

The case itself is now sound:

- **Positive control is runtime-synthesized.** Test plan SEC-003 (478) and §6.2
  (520) build the corpus inside the test: key name
  `["DEEPSEEK","API","KEY"].join("_")`, value
  `["sk","live", randomBytes(12).toString("hex")].join("-")`; the scanner is a
  pure `(path, text)` function, so nothing is persisted. Negative arm asserted:
  "a scan of the declared set for the fragment `sk`+`-`+`live` returns zero".
  Plan phase 5 (1211–1227) states the same and explicitly says the comment
  "describes the sample and does not print one".
- **Carve-out is a closed placeholder set plus a length floor.** Declared tokens
  (`...`, `...`-only, `<YOUR_KEY>`-style angle brackets, `$VAR`, `${VAR}`,
  `sk-ant-...`, `sk-...`, `zai-...`, `sk-ant-…`, bare name with no value) are
  "compared literally after quote-trimming", with a declared **16-character
  floor**. No "ends with an ellipsis" rule exists in either artifact; the plan
  restates it as "never a generic 'ends with an ellipsis' rule".
- **Control that a long `…`-terminated value is still reported.** Corpus arm (D):
  "a 32-character random value with a trailing `…` … → **reported**", with the
  failing control "Carve out value D because it ends in an ellipsis → the
  no-heuristic arm fails". Plan phase 5 and §4.3 (280) assert the same.
- **Satisfiable over its own declared set.** The delivered guides in the scanned
  set carry only carve-out forms: `API_KEY=sk-ant-...` and `API_KEY=sk-...`
  (`doc/guides/opencode-model-configuration.md:155–156`), `API_KEY=zai-...`
  (`doc/guides/zai-peak-hours-hook.md:173`). All three appear in SEC-003's
  closed set, so the case can be green.
- **Historical readiness records keep the old literal, by design.**
  `readiness-review/readiness-iter-1.md:308` (`DEEPSEEK_API_KEY=sk-live-...`)
  and `readiness-review/readiness-iter-2.md:253/256/260/266`
  (`sk-live-4f9c…`) still carry it. They are **evidence, not scanned
  documents**: SEC-003's declared set is the document, six fixtures, six test
  files, three guides, `feature-provider-profiles.md`, the two toolsmith files,
  `migration-output.md`, the plan and the spec. `readiness-review/**` is outside
  it. No action required.

## N1 — model anchoring and body scoping, re-verified

- **Classes exactly as required, in all three artifacts**: spec 515/616/764,
  test plan 109/417/604, plan 686–689. Same five family classes
  (`claude-(opus|sonnet|haiku|\d)`, `gemini-\d`, `gpt-\d`, `glm-\d`,
  `deepseek-[a-z0-9]`) plus the same five provider-qualified prefixes.
- **Containment scoped to the prompt body after the provenance header**: spec 515
  ("the comparison runs over the **prompt body after the provenance header** —
  the header lines naming `scripts/build-claude-plugin.sh` … are **intentionally
  outside the identifier scan**"); test plan 419 (`body(text)` = "everything from
  the first non-comment key line (`name: toolsmith`) onward"); plan 691–701
  (body from `name:` onward; header excluded from the comparison).
- **Arm proves the generator path is NOT reported**: test plan 419 header arm
  ("the header line carrying `scripts/build-claude-plugin.sh` produces **zero**
  findings … while a control arm proves a **broad** `claude-` class would report
  it"); failing control at 272; plan 705–710 part (c). Verified against the tree:
  `.ados-claude/agents/toolsmith.md` line 4 is `# Regenerate with:
  scripts/build-claude-plugin.sh`; `build-claude-plugin` matches no anchored
  class, and the body starts at line 9 (`name: toolsmith`).

## Substance checks

- **Ceilings 20/30 everywhere, no reversed pair.** DM-8 (326), DEC-10 (456),
  DEC-21 (467), A-5 (400), AC-F4-1 (518), §18 (546, 555), Appendix A (830);
  test plan 306/337/431; plan 46, 875. The only "30/20" strings are historical
  rationale explaining why the old pair was unreachable (spec 456/467, plan
  266/554) — correctly framed as the earlier pair, not as policy.
- **No ticket-scope `skipped` claim.** F-4 (176), DM-8 (326), AC-F4-1 (518),
  Appendix A (748), §18 (539) all state no `data` payload, no `skipped` list,
  no park, no expiry. Plan phase 4 (1056, 1095) matches. The `data.skipped`
  references at plan 987/990 belong to chain-selection replays, not the ticket
  crossing.
- **"Time-of-day interval" qualifier with the weekend/holiday note.** Present at
  §1 (57), RSK-3 (378), OQ note (437), DEC-17 (463), §18 (557), Appendix B (824).
- **`originLabel` citation.** Test plan (680) → `provenance.ts:21–23`; plan
  (892–894) → `provenance.ts`. Correct module and function.
- **SCAN-002 points to AC-F6-1 only.** AC cell (328) and detail (415) verified;
  the AC-F2-2 forward row (109) omits SCAN-002.
- **No stale sixth-suite claim.** Test plan §7.1 (597), §8.3 (698); spec NFR-7
  (358); plan 51/372/409/961. The plan's "need no sixth suite" (409) means no
  *additional* suite, which is correct.

## Consistency spot-check

| Property | Expected | Observed |
|---|---|---|
| Cases | 55 | Test plan 34/97/173–174/187 and §7.3 (642) = 55; plan TC→phase (361–380) = 55 |
| Acceptance criteria | 15 | Test plan 34/97; plan AC ownership (347) = 15 |
| Phase case counts | 0/3/17/22/7/6 | Plan 361–380: 0 + 3 + 17 + 22 + 7 + 6 = 55 |
| AC ownership | 0/1/2/9/2/1 | Plan 329–347: 0 + 1 + 2 + 9 + 2 + 1 = 15, one owner each |
| Scope paths | 19 | Plan `scope.files`: P1 1, P2 3, P3 1, P4 7, P5 2, P6 5 = 19 |
| Test files | 5 new + extended `doc-conformance` | Test plan §7.1 (600–605); spec NFR-7 (358); plan phases 2–6; no `provider-migration-evidence` file |
| Spend bands | 25 (window park) / 30 (ticket stop) | DM-9 (327); spec Appendix C (745–748); AC-F4-1; test plan SIM-003/006/009; plan phase 4 |
| G0 | `pnpm build` before every bun-test gate | Plan 582, 745, 943, 1103, 1254, 1364 (six phases) |
| P1 validator gate | Whole document through the delivered validator | Plan 600–610: `bun -e` loads the full committed document through the profile/chain/seat validator; branch-only yields `provider.profile.absent` |

## Non-blocking residual risks accepted

1. **Carve-out enumeration granularity (plan vs test plan).** Plan phase 5
   (1228–1234) lists the closed carve-out as `ANTHROPIC_API_KEY=sk-ant-...`,
   `ZAI_API_KEY=<YOUR_KEY>`, `OPENAI_API_KEY=$OPENAI_API_KEY`,
   `sk-ant-…`, and a bare name. SEC-003's owning set (478) additionally names
   bare `...`, `sk-...`, `zai-...` and generic `$VAR`/`${VAR}`. The delivered
   guides carry `API_KEY=sk-...` and `API_KEY=zai-...`, so the implementation
   must take the token set from the owning case, not from the plan's summary.
   Accepted because the case is the oracle, the plan labels the set
   "exported and asserted by value", and a mismatch surfaces as a named red
   arm rather than a silent pass. No new requirement is implied.
2. **Header line count wording.** Test plan (419) says "seven contiguous comment
   lines after the opening `---`"; plan (683–691) says "the eight lines
   `---`, …". Both enumerate the same seven comments; the plan counts the fence.
   Verified against the tree (lines 1–8): no ambiguity in substance.
3. **`originLabel` line range.** Cited as `provenance.ts:21–23`; the function
   itself spans 20–24. Module and formatter are correct; the observed label form
   is produced at line 23.
4. **"Revision 1.1" attribution in the test plan.** §7.1 (597) and §8.3 (698)
   attribute the six-file set to plan revision 1.1 while the plan is now 1.2.
   Revision 1.2 (16–18, 51) re-confirms the same set without moving any boundary,
   so the statement remains true and the artifacts agree.
5. **Test-plan frontmatter link comment** (line 15) still says the plan was "not
   yet authored when this plan was written" — accurate at authoring time, not a
   current-state claim about the plan's existence.
6. **Generated-pair body equivalence is a two-arm proof, not a character-level
   identity.** Body containment plus placeholder-occurrence
   (`<provider>/<model>`, `<model>`) plus the provenance and no-op arms is the
   right oracle for a build output; a full byte-equality body comparison would
   fail on the source-to-generated frontmatter transform. Accepted as designed.

## Findings

None blocking. The six items above are recorded as accepted residual risks; the
first two carry an optional wording cleanup target (**delivery_planning** /
**test_planning**) that is not required for readiness and must not reopen a
phase.

VERDICT: READY
