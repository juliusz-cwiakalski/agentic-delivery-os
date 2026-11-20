# Readiness Review Iteration 2

Verdict: NOT_READY
Work Item: GH-374
Date: 2026-11-20
Pause Required: no

## Scope of the review

Read: `chg-GH-374-spec.md` v1.4 (832 lines), `chg-GH-374-test-plan.md` v1.1
(713 lines, 55 cases), `chg-GH-374-plan.yaml` (revision 1.1, 6 phases),
`chg-GH-374-pm-notes.yaml` (D9–D14), `migration-output.md`, and
`readiness-review/readiness-iter-1.md`.

Read against the real tree and the delivered code the cases assert:

- `.opencode/agent/*.md` (24 files), `.ados-claude/agents/toolsmith.md`,
  `scripts/build-claude-plugin.sh`, `scripts/install.sh`,
  `doc/templates/blueprints/zai-peak-hours-hook--install.sh`;
- `packages/core/src/provider/{validate,peak-rules,conditions,budgets,chain,engine}.ts`,
  `packages/core/src/config/{catalog,defaults,resolver,provenance}.ts`,
  `packages/cli/src/commands/provider.ts`, `packages/cli/src/edge.ts`;
- `tests/checks/{milestone-prompts,doc-conformance}.test.ts`,
  `scripts/checks/prompt-conformance.ts`, `package.json`;
- the four provider/config system-spec pages and the three edited guides
  (`ados_distribution` markers checked);
- `AGENTS.md` (§tool frontmatter, generated-plugin rule, delivery phases) and
  `.ai/agent/pm-instructions.md`.

Unlike iteration 1, the blocking-four were re-executed where execution was
possible. The phase-1 validator probe was run in the exact `bun -e` shape the
plan declares (static `yaml` import and static relative `.ts` imports), first
against the current document (no `provider` branch) and then against a synthetic
declaration containing the spec's entries, chains, both profiles and both
`peakWindows`. Results are quoted under B3/B4 below. No source file was modified;
the scratch files were removed.

The tracker still has no MCP access from this session, so the ticket-side review
uses the ticket text quoted verbatim in the spec and the owner comment summarised
in the spec/pm-notes, as in iteration 1.

## Facet summary

- spec_completeness: FAIL — A-5 still states the reversed ceiling pair; F-4 still
  claims an unobservable skipped list.
- ac_quality: FAIL — AC-F2-2's generated-pair arm is not safely testable as
  written: the generated provenance header carries `build-claude-plugin.sh`,
  which matches the broad `claude-` class unless the scan is body- or
  value-scoped.
- plan_coverage: PASS — 6 phases; 55/55 cases mapped; 15/15 ACs owned; scopes
  explicit and non-overlapping.
- test_traceability: FAIL — coverage is complete (15/15, 55/55) but SEC-003's
  oracle is unsatisfiable because its positive control is written inside the
  scanned artifacts.
- cross_artifact_consistency: FAIL — A-5, F-4, the test plan's stale
  "sixth suite" note, and AC-F2-2 vs the generated header.
- decision_capture: PASS — D9–D14 and DEC-20…DEC-24 record the scope widening and
  the three owner-review deviations; no decision record is warranted.
- system_spec_consistency: PASS — DEC-23 names the exact contradicted
  `feature-provider-profiles.md:38` sentence; the page's line 61 and the delivered
  code agree with the replacement.
- plan_doc_update_coverage: PASS — four documentation rows plus the distribution
  row; the profiles page is declared once in phase 6.
- plan_code_area_coverage: PASS — every authored path is in exactly one phase's
  `scope.files`; `.delivery-os/config.yaml` is phase 1 only.
- dod_defined: PASS — 15 ACs, each with an assertion, a case and an owning phase.

Coverage arithmetic still reconciles: 55 cases = 0+3+17+22+7+6 by phase and
17+22+4+3+3+6 by owning suite; 15 ACs = 0+1+2+9+2+1. The failures are false, unsafe, or
unsatisfiable assertions, not holes.

## Iteration-1 finding closure

Status is `CLOSED` only when the revised text is true against the code/tree.

| ID | Status | Revised artifact (line) | Evidence / residual |
|---|---|---|---|
| B1 | **PARTIALLY CLOSED** | spec AC-F2-2 (515), F-8 (180), NFR-7 (358), §16 (477–478), DEC-20 (466); test plan SCAN-004 (417), SCAN-006 (419), SCAN-007 (420); plan phase 2 (632–752) | Scope widening is real and correctly placed: the spec adds `.opencode/agent/toolsmith.md` and `.ados-claude/agents/toolsmith.md`; the plan's phase 2 declares both plus the prompt-scan suite and gates on it. The roster scan is satisfiable after the edit (only toolsmith.md carries the ten classes today). The generated-pair arm is unsafe as written: `.ados-claude/agents/toolsmith.md:4` is `# Regenerate with: scripts/build-claude-plugin.sh`, which matches the broad `claude-` class; the source has no `claude-` outside the literals being removed. "contains no identifier the source does not contain" is true only if the comparison is scoped to the generated body or the family class is value/model-anchored. See new finding N1. |
| B2 | **PARTIALLY CLOSED** | spec DM-8 (326), DEC-10 (456), DEC-21 (467), AC-F4-1 (518), App. A (663–664), App. C (745/748); test plan SIM-003 (400), SIM-006 (403), SIM-009 (406), DRIFT-004 (431); plan phase 1 (536–548), FIXTURE RULES (251–257), phase 4 (1000–1025) | The substantive fix is correct and code-true: `combineProviderConditions` returns `failed` before any `parked` (`conditions.ts:57–80`); `evaluateBudgets` parks a window crossing and fails a ticket crossing (`budgets.ts:122–176`). Window 20 < ticket 30; the park fixture measures 25, the stop fixture 30; no case asserts one figure as both. Residual: spec A-5 (400) still says "the figures `30` (trailing day) and `20` (ticket)". See N2. |
| B3 | **CLOSED** | plan phase 1 gate (573–595) | The gate passes the whole `doc` to `parseAndValidateProfileConfiguration(doc, providers.config)`. Re-executed: with a synthetic declaration carrying the spec's entries/chains/peaks and a valid seat shape, the whole-document call returns `ok: true` (both profiles, grace 300 accepted); the branch-only call returns `provider.profile.absent`; `bun -e` resolves the `yaml` import and the static relative `./packages/core/src/provider/validate.ts` import from the repo root. The corrected shape is the only green one. |
| B4 | **CLOSED** | spec DM-1 (319), F-1 (173), NFR-4 (355), AC-F6-3 (522), §21 (582), App. A (642–643); test plan SEC-002 (477), DM-1 row (137); plan phase 1 (470–477) | Every credential statement now uses `{ sourceKey: { style, name } }`; the two remaining `{ style, name }` mentions in the plan are explicitly the *refused flat shape*. Re-executed: `{ sourceKey: { style: literal, name: ZAI_API_KEY } }` parses `ok`; a flat `{ style, name }` child is refused with detail `credentials.zai.sourceKey`. The config layer rejects an unknown key as `config.key.unknown` with no `key` member (`resolver.ts:52–61,264–265`); the raw parser reads only `sourceKey` and ignores extra keys (`validate.ts:201–215`). |
| M1 | **CLOSED** | spec §8.3 "declared values versus delivered defaults" (331), AC-F7-1 (523); test plan CFG-006 (373), DRIFT-001 (428), DRIFT-006 (433); plan phase 3 (799–803, 829–833) | The five declared quota leaves are pinned from the document; the four delivered defaults (`timeoutMs` 15000, `outageParkTtlSeconds` 300, `credentialParkTtlSeconds` 900, `capParkTtlSeconds` 300) are asserted separately with `layer=defaults`; no resolved node is deep-equalled against a defaults-omitting literal. `PRODUCTION_DEFAULTS` matches the four values (`defaults.ts:20–31`); the origin formatter is `layer=… file=… line=…` (`provenance.ts:21–23`). |
| M2 | **PARTIALLY CLOSED** | spec AC-F4-1 (518); test plan SIM-006 (403); plan phase 4 (1015–1018) | The ticket arm now asserts the refusal envelope: exit 1, no `data`, no skipped list, no park, no expiry, and the `[provider.budget.crossed]` suffix is delivered (`chain.ts:176–190` → `provider.ts:267–268,410–411`). Residual: spec F-4 (176) still says "the ticket crossing fails the entries, **skips them as `budget-exhausted`**", contradicting AC-F4-1 and the delivered payload. See N3. |
| M3 | **CLOSED** | spec F-1 (173), AC-F1-1 (511), §8.1 (309); test plan CFG-004 (371); plan phase 3 (784–798) | The delivered chain details are exactly those quoted: `chain ${name} places subscription entries after pay-per-token entries`, `… references unknown provider …`, `… lists provider … more than once`, `provider … references unknown credential …`, `default chain … is not declared`, `chain … has no entries` (`validate.ts:388,396,408,429,496,506`). No `field` is claimed for a chain defect; the profile and budget `field`/detail arms are asserted where they exist. |
| M4 | **CLOSED** | test plan NOM-002 (456); plan phase 4 (1031–1039) | `nominateProviderProfile` maps eligibility to `${profile}:${verdict}:${blocker.kind joined by +}` and never carries a blocker value (`engine.ts:192–199`); the exact `["delivery:ineligible:condition+condition","paid:ineligible:condition"]` shape is asserted there, and blocker values are asserted on the composed `provider profile resolve` payload. |
| M5 | **CLOSED** | test plan SEC-002 (477); plan phase 5 (1153–1170) | The hostile key is driven through the config layer (`config.key.unknown`, no `key` member, differential oracle) and through the raw parser (ignored, parse `ok`). This matches the delivered code; no invented credential path remains. |
| M6 | **PARTIALLY CLOSED** | test plan SEC-003 (478), §6.2 (520); plan phase 5 (1171–1182); spec AC-F6-3 (522) | The placeholder carve-out is declared and controls are specified in both directions, which fixes the guides' `sk-ant-...` / `zai-...` false positives. Residual: the **positive** control is written into the scanned artifacts themselves (`DEEPSEEK_API_KEY=sk-live-4f9c…` at test-plan 478 and 520 and plan 1178), while SEC-003 declares that the plan and spec are in the scanned set and that this literal **must be reported**. Either the scan reports its own case file, or a trailing-ellipsis carve-out silently nullifies the positive control. See N4. |
| M7 | **CLOSED** | spec §16 (489, 501), DEC-23 (469), OQ-1 (433); test plan DOC-006 (446); plan phase 6 (1267–1273) | The real page still contains the contradicted sentence at line 38 and the delivered truth at line 61; the named replacement is exactly what the delivered selection does (entry peaks gate; `createResolvedProviderProbe` reads `descriptor.peak`). DOC-006 pins both directions and the delta carve-out. |
| M8 | **CLOSED** | test plan §6.1 (486), §6.3 (528–539); plan preconditions (210–220) and every phase gate | `G0` (`TMPDIR=$PWD/tmp/tmpdir pnpm build`) precedes every `bun test` gate in phases 1–6; §6.1 now states the suites depend on the built workspace packages, never on an installed binary. |
| M9 | **CLOSED** | spec AC-F7-3 (525), traceability (527–535); test plan §1.2 (54), §3.1.1 (127); plan (285–293), phase 6 (1320–1323) | The dispatch clause is stated as four fully traced plus one partial by declared substitution, in the AC, the traceability table, the test plan's out-of-scope list, NOM-003 and the PR obligation. No case claims a typed-attempt record. |
| M10 | **CLOSED** | spec DM-6 (324), DEC-16 (462), F-5 (177), §22 (600) | The paid profile is qualified as the daemon-path fallback; the synchronous probe reads no quota, and the seat-level consequence (a z.ai seat stays on `glm-5.3` while `provider resolve` reports paid) is stated. |
| M11 | **CLOSED** | spec AC-F6-1 (520), DEC-12 (458), DEC-22 (468), App. D (752–764); test plan SCAN-001 (414), SCAN-005 (418); plan phase 5 (1109–1146) | The scan is scoped to the delivery surface; every exclusion has a reason; the `scripts/install.sh` example copy is a declared exception; the blueprint is the only file copying to a path ending `pre-opencode-iteration` (`doc/templates/blueprints/zai-peak-hours-hook--install.sh:28–29,44`) and no delivery-surface file references it. Verified in the tree. |
| M12 | **CLOSED** | spec AC-F2-3 (516); test plan SEAT-004 (388); plan phase 4 (987–996) | Both vision arms name their agent (`designer`, then `image-reviewer`); the agent-less resolution is asserted as the `bootstrapper` trap, not used as the oracle. |
| m1 | **CLOSED** | spec DEC-24 (470) | `mixed`→`delivery`, `deepseek`→`paid`, `zai-only`→`subscription-only`, tier files→seat matrix, `openai` intentionally undeclared, `zai-top`/`zai.sh` historical. The "nothing dropped" claim is now auditable. |
| m2 | **CLOSED** | spec NFR-7 (358) | "Five new suites plus the extended `doc-conformance`" is stated and matches §16 and the plan's six test files (five new + the extended one). |
| m3 | **PARTIALLY CLOSED** | spec §1 (57), RSK-3 (378), DEC-17 (463); test plan CFG-009 (376), DOC-001 (442) | The authoritative sites say "time-of-day interval" and state the weekend/Chinese-holiday superset. Residual: spec line 437 still says "the only newly closed window is 04:00–06:00" without the qualifier. See N5. |
| m4 | **CLOSED** | test plan CFG-005 (372) | The case asserts the delivered phrase `no active work-item ref was found at <context path>` and explicitly rejects a `workItemRef` token; the delivered summary matches (`budgets.ts:295–300`). |
| m5 | **CLOSED** | spec §18 owner-review table (551–557), DEC-7 (453); plan owner-review list (305–319) | The derived `envName` is one of the three deviations the owner confirms at the PR; D14 restates it. |
| m6 | **CLOSED** | spec §18 (559); plan preconditions (231–238) | The `PATH` rule is stated as **append** `node_modules/.bin` and explains why prepending shadows the installed binary. |

17 CLOSED, 5 PARTIALLY CLOSED (B1, B2, M2, M6, m3). No finding is still wholly
open, but four residuals are false statements, one is an unsafe oracle (N1), and
one is an unsatisfiable oracle (N4, critical).

## The four blocking findings, re-verified

### B1 — scope widening landed; the generated-pair arm is unsafe as written

The spec and plan now include the two toolsmith files and the prompt-scan suite,
and the carve-out is honest: `AGENTS.md:338–345` documents the nested
`claude:\n  model: opus|sonnet|haiku` frontmatter and says "Claude Code uses
`claude.model` for model assignment"; the real source carries it at
`.opencode/agent/toolsmith.md:26–27`, and the generated file carries
`model: opus` at line 11. A bare `model: opus` matches none of the ten patterns,
so the carve-out is coherent.

The roster scan is satisfiable after the phase-2 edit: the real tree reports the
ten classes only in `.opencode/agent/toolsmith.md` (lines 232, 294, 353, 409, 453,
588, 597, 604, 630, 638, 655, 717), and the other 23 prompts carry none. SCAN-004
scans all 24, with ten planted controls and per-file zero, so it cannot pass
vacuously. The generated-pair arm is the risk: the generated file's own
provenance line 4 contains `scripts/build-claude-plugin.sh`, which matches the
broad `claude-` family token. The source does not contain that string. The AC says
"model-family id used as a value", and the test plan's prose sample excludes a
bare family name; a faithful value-scoped scanner would not report the header.
But SCAN-006 says "the generated file's identifier set (ten patterns)" without
declaring body-scoping, and a substring or colon-value scanner would report line 4
and fail the phase-2 gate on a correct pair. The assertion is therefore unsafe as
written, not proven false. See N1.

### B2 — ordering is correct in every operational site; one assumption still reverses it

Verified against the delivered code: `combineProviderConditions` filters `failed`
first and returns it before considering any `parked` (`conditions.ts:57–80`); a
window crossing is `parked` with `newestAtMs + windowSeconds*1000`
(`budgets.ts:122–151`); a ticket crossing is `failed` with no expiry
(`budgets.ts:172–187`); the CLI appends `[provider.budget.crossed]`
(`provider.ts:267–268,410–411`). Window 20 / ticket 30 is the only reachable
ordering, and the fixtures use 25 (park band) and 30 (stop). Every case names one
figure with one outcome; SIM-009 pins both. The residual is A-5, which still says
30 trailing / 20 ticket — a direct contradiction of DM-8 and a value a coder can
copy. See N2.

### B3 — verified executable, and the branch-only call is the failing one

The plan's command (abridged to the load path):

```bash
TMPDIR=$PWD/tmp/tmpdir pnpm build
TMPDIR=$PWD/tmp/tmpdir bun -e '
  import { readFileSync } from "node:fs";
  import { parse } from "yaml";
  import { parseAndValidateProviderConfiguration,
           parseAndValidateProfileConfiguration } from "./packages/core/src/provider/validate.ts";
  const doc = parse(readFileSync(".delivery-os/config.yaml", "utf8"));
  const providers = parseAndValidateProviderConfiguration(doc);
  const profiles = parseAndValidateProfileConfiguration(doc, providers.config);
  …'
```

I ran the same shape. Static `yaml` and relative `.ts` imports resolve from the
repo root under `bun -e` (Bun 1.4.4). With a synthetic declaration carrying the
spec's entries, chains, both profiles and both `peakWindows`, the whole-document
call returns `ok: true`; the branch-only call returns
`provider.profile.absent`; the flat credential returns
`credentials.zai.sourceKey`. The gate can only be green with the whole document,
which is what the plan passes. B3 is closed.

### B4 — shape and both parsers verified

Every normative credential site uses `{ sourceKey: { style, name } }` (DM-1,
F-1 §5.1, NFR-4, AC-F6-3, §21, Appendix A, the plan's phase-1 contract, the test
plan's DM-1 and SEC-002). The plan's two `{ style, name }` strings are explicitly
the refused flat form, not a declaration. The config catalog requires the
`sourceKey` child and rejects unknown keys (`catalog.ts:76–91`;
`resolver.ts:264–265`), and the raw parser reads only `sourceKey`
(`validate.ts:201–215`). The extra-key facts are asserted in both directions, so
SEC-002 no longer fabricates a refusal. B4 is closed.

## New findings

### N1 — [major] ac_quality — AC-F2-2's generated-pair arm is not safely testable against the generated provenance header

Artifact: `chg-GH-374-spec.md` AC-F2-2 (line 515); `chg-GH-374-test-plan.md`
SCAN-006 (line 419) and its AC-F2-2 row (line 109); `chg-GH-374-plan.yaml`
phase-2 contract (lines 667–680).

Gap: AC-F2-2 requires the generated `.ados-claude/agents/toolsmith.md` to
"contain no identifier the source does not contain". The generated file's line 4
is `# Regenerate with: scripts/build-claude-plugin.sh`; the declared family class
`claude-` matches `build-claude-plugin`, and the source contains no
`build-claude`/`claude-` outside the literals phase 2 removes. The AC qualifies
family ids as "used as a value", so a value- or model-anchored scanner should
ignore the header — but SCAN-006 states the containment as "the generated file's
identifier set (ten patterns) is a subset of its source's set, and both are
empty" without declaring that the provenance header is excluded or that the
family classes are model-anchored. A substring or colon-value implementation
reports line 4 and turns a correct pair's phase-2 gate red; a body-scoped
implementation is fine. The plan's "first five header lines" also names four (it
omits the actual line 4, "If behavior must change …"), which is the same header
the containment scan must handle explicitly.

Suggested remediation target phase: **specification** (AC-F2-2 wording) +
**test_planning** (SCAN-006) + **delivery_planning** (phase-2 contract wording).

Suggested fix: state that the identifier comparison runs over the generated
**prompt body after the provenance header** (the header is asserted separately),
and define the family classes as model-anchored (e.g. `claude-(opus|sonnet|haiku|instant)`)
so `build-claude-plugin` cannot match. Correct the "first five lines" list at the
same site.

### N2 — [major] cross_artifact_consistency — spec A-5 still states the reversed ceiling pair

Artifact: `chg-GH-374-spec.md` A-5 (line 400).

Gap: A-5 says "the figures `30` (trailing day) and `20` (ticket) are the PM's
initial proposal". DM-8 (326), DEC-10 (456), DEC-21 (467), AC-F4-1 (518),
Appendix A (663–664), §18 (546, 555), the test plan and the plan all say window
20 / ticket 30. A coder or reviewer reading only the assumptions list would
declare the pair that B2 proved unreachable — the exact regression this
revision exists to prevent. This is a persistent B2 residual, not a new value.

Suggested remediation target phase: **specification**.

Suggested fix: change A-5 to "the figures `20` (trailing day) and `30` (ticket)",
keeping the owner-review sentence.

### N3 — [major] cross_artifact_consistency — spec F-4 still claims the ticket crossing skips entries as `budget-exhausted`

Artifact: `chg-GH-374-spec.md` F-4 (line 176).

Gap: F-4 says "the ticket crossing fails the entries, **skips them as
`budget-exhausted`**, and ends in `provider.budget.exceeded`". AC-F4-1 (518)
correctly asserts "no `data` payload, no `skipped` list, no park, no expiry"; the
delivered chain returns an error with no skip list (`chain.ts:176–190`), and the
CLI error path emits only `{error}` (`provider.ts:250–265`). This is the exact
iteration-1 M2 overclaim, left in the capability text while the AC was fixed.

Suggested remediation target phase: **specification**.

Suggested fix: replace with "the ticket crossing fails the entries with no park
and no skipped list, and ends in `provider.budget.exceeded` at exit `1` when
nothing else can supply an honest resume", matching AC-F4-1.

### N4 — [critical] test_traceability — SEC-003's positive control is written inside the files SEC-003 scans

Artifact: `chg-GH-374-test-plan.md` SEC-003 (line 478), §6.2 placeholder corpus
(line 520), §4.3 credential control (line 280); `chg-GH-374-plan.yaml` phase-5
SEC-003 (lines 1171–1182, literal at 1178).

Gap: SEC-003 declares the scanned set to include "this plan and the spec", asserts
the scanned path set equals that declared set exactly, and asserts that a
realistic secret `DEEPSEEK_API_KEY=sk-live-4f9c…` **is reported**. That literal is
present in the test plan (line 478 and 520) and in the plan (line 1178), both
inside the declared scanned set. The declared placeholder carve-out covers `...`,
`<...>`, `$VAR`, `${VAR}`, `sk-ant-…` and bare names, but not `sk-live-4f9c…`.
So one of two things is true, and both fail the case:

- the scanner reports the literal → the scan fails on its own plan/test plan;
- the scanner treats a trailing ellipsis as a placeholder → `sk-live-4f9c…` is
  carved out and the positive control (a realistic secret must be reported)
  cannot be satisfied, while `sk-ant-...` must still not be reported.

This is the iteration-1 M6 class re-created one level deeper: the remediation's
own control corpus is now the false positive. A scanner cannot distinguish
`sk-ant-...` (must be ignored) from `sk-live-4f9c…` (must be reported) by
ellipsis alone; it needs a declared entropy/length rule, and the plan's own text
must not carry the positive sample.

Suggested remediation target phase: **test_planning** (§5.2.9, §6.2) +
**delivery_planning** (phase-5 contract).

Suggested fix: declare that the control corpus is constructed **in memory** (a
pure `(path, text)` scanner), and replace the literal in the plan/test-plan prose
with a non-matching description ("a synthetic `*_API_KEY` assignment with 32
random characters, built in the test"). The negative controls may stay as
documented placeholders; the positive control must exist only in the synthetic
input. If the plan/spec must stay in the scanned set, also state that the
placeholder rule is "a known placeholder token or a value ending in an ellipsis
**and** shorter than the declared entropy bound", with the bound asserted.

### N5 — [minor] cross_artifact_consistency — spec line 437 still lacks the m3 qualifier

Artifact: `chg-GH-374-spec.md` line 437 (the OQ-resolution paragraph).

Gap: "the only newly closed window is 04:00–06:00" omits "time-of-day interval"
and the weekend/Chinese-holiday superset. §1 (57), RSK-3 (378) and DEC-17 (463)
carry the qualifier; this site does not. It is a historical note, but it is the
same absolute wording m3 asked to remove.

Suggested remediation target phase: **specification**.

Suggested fix: add "time-of-day interval" and "(weekends and Chinese public
holidays are additionally paused, DEC-9)" to the sentence.

### N6 — [minor] cross_artifact_consistency — the test plan still says the plan lists a sixth suite

Artifact: `chg-GH-374-test-plan.md` §7.1 (line 597) and §8.3 (line 698).

Gap: both say `chg-GH-374-plan.yaml` "still lists a sixth suite from its earlier
revision". Plan revision 1.1 already folded MIG-001..-003 into the reference
suite (plan lines 16–18, 766–771, 921–923) and lists exactly six test files
(five new plus the extended `doc-conformance`). The test plan points at a defect
the plan no longer has, which can send a coder or PM to "fix" a correct plan.

Suggested remediation target phase: **test_planning**.

Suggested fix: replace both notes with "the plan's revision 1.1 folds the
migration cases into the reference suite and declares six test files (five new
plus the extended `doc-conformance`), matching this plan".

### N7 — [nit] test_traceability — AC-F2-2 is listed on a phase-5 case while the plan owns it in phase 2

Artifact: `chg-GH-374-test-plan.md` §5.1 SCAN-002 row (line 415), §3.1 AC-F2-2
row (line 109); `chg-GH-374-plan.yaml` AC ownership note (lines 329–338).

Gap: SCAN-002 is owned by phase 5 and its AC column includes AC-F2-2, while the
plan argues AC-F2-2 completes in phase 2 because SCAN-002 asserts none of its
oracles (the fourth planted class is SCAN-004's). The plan's rule is sound, but
the test-plan row is what a reader sees; leaving the link makes the "last
completing assertion" rule look violated.

Suggested remediation target phase: **test_planning**.

Suggested fix: remove AC-F2-2 from SCAN-002's `AC` cell (keep AC-F6-1), and say
in SCAN-002's detail that the fourth class is SCAN-004's, as it already does.

### N8 — [nit] test_planning — the origin-label citation names the wrong module

Artifact: `chg-GH-374-test-plan.md` §8.2 (line 680).

Gap: the assumption cites `packages/core/src/config/resolver.ts:344–363` for the
`layer=defaults file=core/src/config/defaults.ts line=<n>` form; the formatter is
`packages/core/src/config/provenance.ts:21–23`. The asserted form is correct, so
this is a documentation nit only.

Suggested remediation target phase: **test_planning**.

Suggested fix: point the citation at `provenance.ts`.

## New-artifact consistency

| Check | Result |
|---|---|
| Ceilings 20/30 across spec/test plan/plan | Agree everywhere operational; A-5 disagrees (N2) |
| 24 seats, 8/2/14 base split, 14 judgment / 10 execution | Agree: DM-5/Appendix B, SEAT-005/DRIFT-003, plan phase 1 |
| Spend bands 25 (window park) / 30 (ticket stop) | Agree: DM-9/Appendix C, SIM-003/006/009/§6.2, plan FIXTURE RULES/phase 4 |
| Five new suites + extended `doc-conformance` | Spec and test plan agree; plan says "six test files (five new + the extended one)", which is the same set; test plan's "plan still lists a sixth suite" note is stale (N6) |
| Six plan phases | Plan only; no contradiction elsewhere |
| 55 cases | Test plan §3.4/§7.3 = 55; plan TC→phase = 55; no orphan |
| Case→phase counts | 3+17+22+7+6 = 55; per-suite 17+22+4+3+3+6 = 55 |
| AC ownership 15/15 | 0+1+2+9+2+1 = 15; AC-F2-2 pointer caveat (N7) |
| A file in two phases' scopes | None: config P1; toolsmith pair + prompt-scan P2; reference P3; fixtures + behaviour P4; scan + canary P5; guides + profiles page + doc-conformance P6 |
| Prompt-scan suite / profiles page exactly once | Yes (P2 / P6) |
| `feature-provider-profiles.md` in phase 6 | Declared once in P6; phase 7 verifies the other three pages. Judged acceptable: the sentence is contradicted by the delivered code, the spec's §16 names it as Changed, AC-F7-2 and DOC-006 require it, and the one-edit-set rule puts the phrase row in the same commit. Leaving it for phase 7 would ship a known-false current-truth page through phases 1–6. The spec's §16 heading ("Phase 7 … reconciles these pages") is slightly ambiguous; a clarification that phase 6 changes this one sentence and phase 7 verifies the rest would remove the ambiguity (nit, spec-side). |

## Plan executability

- **P1 command:** works as written. `bun -e` accepts static `yaml` and relative
  `.ts` imports from the repo root; the whole-document profile call is the only
  green shape; branch-only gives `provider.profile.absent`. The probe is a gate,
  not a committed suite, as declared.
- **G0:** `pnpm build` is the first line of every phase gate (P1 572, P2 709,
  P3 904, P4 1064, P5 1197, P6 1307) and is stated as a precondition (210–220).
- **Commitlint PATH:** stated as append-only with the shadowing reason (231–238;
  spec §18 559).
- **Prompt conformance:** phase 2 runs `tests/checks/milestone-prompts.test.ts`,
  which (a) asserts the generated-plugin provenance and second-build no-op and
  (b) calls `runPromptConformance()` and `runHelpGuideCoverage()`
  (`milestone-prompts.test.ts:196–230`). So the `.opencode` edit is gated at the
  phase boundary, not only at `pnpm check`.
- **`pnpm check` coverage:** G5 is the lifecycle aggregate, includes `pnpm test`
  (which discovers the five new suites and the extended one), `prompt-conformance`,
  lint, format, typecheck and boundaries. G0 is a precondition and `pretest`
  rebuilds; the plan states both.
- **Claude-plugin freshness / pair commit:** SCAN-006 asserts the provenance
  header, a byte-identical second build and `git status --porcelain --
  .ados-claude .opencode` empty; phase 2 declares both files and G8 re-checks the
  pair. This is the right gate, subject to N1's body-scoping fix.
- **Residual risk (not gating):** the `claude-` class is broad enough to match
  any `claude-` hyphenation. Besides the provenance header (N1), the phase-2 edit
  must not introduce `build-claude-plugin.sh` into `.opencode/agent/toolsmith.md`;
  the spec's pointer is to `provider.profiles`, not the generator, so the risk is
  low but unstated. Anchoring the family class to a model token removes both
  risks.

## Test honesty

- **SCAN-004:** non-vacuous. 24 files enumerated at assertion time, ten declared
  classes, ten planted controls asserted individually, per-file zero for
  toolsmith, a 23-file scan fails. A bare-family prose sample and the
  `claude.model` frontmatter are not reported. PASS.
- **SCAN-006:** the generated-pair containment oracle is unsafe as written (N1).
  The provenance, no-op and control-suite arms are otherwise sound.
- **SCAN-007:** non-vacuous; it scans recorded pre-change text and asserts every
  historical identifier is reported. The recorded line list is not exhaustive
  (the tree also has `openai/gpt-5.2` at 294/453, `gpt-5.2` at 604,
  `claude-opus-4-6` at 588, `claude-sonnet-4-6` at 597), but SCAN-004's ten
  classes supply the class coverage, so the case is not vacuous. A note that the
  reconstruction must be the full pre-change file, not only the quoted list,
  would make it stronger (nit).
- **SEC-003:** the carve-out is the right idea, but the positive control sits in
  the scanned set (N4). Until that is fixed, the case cannot pass.
- **Vision:** SEAT-004 and AC-F2-3 name `designer` then `image-reviewer`; the
  agent-less `bootstrapper` outcome is asserted as the trap. PASS.
- **Defaults:** CFG-006, DRIFT-001 and DRIFT-006 pin declared values and assert
  the four delivered quota leaves separately with `layer=defaults`; no resolved
  node is deep-equalled against a five-key literal. PASS.

## Owner-review list and the dispatch substitution

- The three deviations are stated in spec §18 (551–557), the plan's owner-review
  block (305–319) and pm-notes D14: the initial ceilings 20/day and 30/ticket,
  the derived `envName`, and the paid union window with its 04:00–06:00
  time-of-day cost plus the weekend/holiday superset.
- The dispatch clause is consistently stated as partial: four of five ticket ACs
  fully traced, the typed-attempt half declared as a substitution (spec AC-F7-3
  and the traceability table, test plan §1.2/§3.1.1, NOM-003, plan 285–293 and
  phase-6 PR obligation). No artifact claims a 5/5 trace.
- The prompt-scope widening (D9) is not on the owner-review table, but it is the
  ticket's own task ("no model literal lives in an agent prompt"), not a
  deviation from it; DEC-20 and D9 record it.

## Focus-area judgments

1. **Satisfiability against the delivered code.** B3/B4 are now executable facts.
   B2 is code-true. The remaining unsafe AC arm is AC-F2-2's generated-pair arm
   (N1); the remaining unsatisfiable case is SEC-003 (N4).
2. **Policy faithfulness.** The seat map matches the real `mixed.sh` intent
   (8 glm, 2 flash, 14 deepseek; vision on the paid model), the peaks/buffers
   load through the delivered rules parser (grace 300 ≤ 300), and the union
   window's 04:00–06:00 cost is stated. A-5 is the one false policy statement.
3. **Scan honesty.** The delivery-surface scan is scoped, declares every
   exclusion, has an empty-set guard and both directions; the blueprint is
   verified as the only installer and is unreferenced. The prompt scan is
   non-vacuous. The two credential/prompt-scan oracle issues are N1/N4.
4. **Scope discipline.** No `packages/**`, `.ai/**`, `.jaiship`, other prompt or
   configuration layer is required. The only `.opencode` change is the toolsmith
   pair. The phase scopes are a clean partition.
5. **Documentation.** The four obligation rows are closed, the profiles-page
   sentence is named, the markers are valid (`redistributable` × 3, `internal`
   for the spec page), and the doc-conformance block adds both directions without
   editing the GH-350 rows (no GH-350 row requires the line-38 sentence).
6. **Residual process observation.** Editing the profiles page in phase 6 rather
   than phase 7 is acceptable for the reasons above; the spec's §16 heading could
   say so explicitly. No other documentation is moved out of phase 7.

## Smallest remediation map

- **specification** (`@spec-writer`): AC-F2-2's generated-pair scope (N1); A-5
  figures (N2); F-4's skipped-list clause (N3); line 437 qualifier (N5); optional
  §16 heading clarification.
- **test_planning** (`@test-plan-writer`): SCAN-006 body-scoped identifier scan
  and header wording (N1); SEC-003 in-memory controls and removal of the literal
  from the scanned prose (N4); §7.1/§8.3 sixth-suite note (N6); SCAN-002 AC link
  (N7); provenance citation (N8).
- **delivery_planning** (`@plan-writer`): phase-2 SCAN-006 wording and header
  list (N1); phase-5 SEC-003 control wording/literal (N4). No phase boundary,
  scope or count changes.
- **decision_capture:** nothing new; D9–D14 and DEC-20…DEC-24 already record the
  decisions.
- **needs_human_input:** none. The ceiling values are decided (20/30); the fixes
  above are wording/oracle corrections, not product choices.

VERDICT: NOT_READY
