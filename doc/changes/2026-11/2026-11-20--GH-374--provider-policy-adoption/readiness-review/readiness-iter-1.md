# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-374
Date: 2026-11-20
Pause Required: yes

## Scope of the review

Read: `chg-GH-374-spec.md` v1.2, `chg-GH-374-test-plan.md` v1.0 (52 cases),
`chg-GH-374-plan.yaml` (5 phases), `chg-GH-374-pm-notes.yaml`,
`migration-output.md`, `AGENTS.md`, `.ai/agent/pm-instructions.md`,
`.ai/rules/typescript.md`, `.ai/rules/testing-strategy.md`,
`doc/guides/definition-of-ready.md`, the four provider/config system-spec pages,
and the delivered code the artifacts rely on:
`packages/core/src/provider/{validate,peak-rules,peak,profile,chain,budgets,simulate,profile-env-record,engine}.ts`,
`packages/core/src/config/{catalog,defaults,resolver}.ts`,
`packages/cli/src/{edge,production}.ts`,
`packages/cli/src/commands/{provider,config}.ts`,
`packages/core/src/domain/harness-profile-propagation.ts`,
`packages/adapters/src/file/{pm-context,config-source}.ts`, plus the real tree
(`.opencode/agent/*.md`, `scripts/install.sh`, `doc/templates/blueprints/**`,
the three edited guides, `.delivery-os/config.yaml`).

The tracker was not reachable from this session (no MCP tracker tool), so the
ticket-side review uses the ticket text quoted verbatim in the spec plus the
owner comment summarised in the spec and pm-notes. Where the quoted clause and
the spec's restatement differ, the difference is called out below.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: FAIL
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

Traceability itself is complete: 15/15 ACs have cases, 52/52 cases name at least
one AC, the AC→TC and TC→AC directions match, and the plan's case→phase map
(14/22/11/5) and AC ownership (0/1/9/4/1) reconcile exactly. The failures are not
coverage holes; they are unsatisfiable or false assertions and contract values
inside otherwise complete artifacts.

## Blocking findings

### B1 — [blocking] ac_quality / spec_completeness — AC-F2-2 and TC-POL-SCAN-004 are false against the real tree

Artifact: `chg-GH-374-spec.md` §17 AC-F2-2 (line 484); `chg-GH-374-test-plan.md`
§5.2.4 TC-POL-SCAN-004 (line 384) and §3.1 AC-F2-2 row (line 93); plan phase 4
comment (SCAN-004, plan lines 760–763).

Gap: AC-F2-2 requires `.opencode/agent/**` to report **zero** findings for
`zai-coding-plan/`, `deepseek/`, `glm-`, `deepseek-`. The real tree reports
seven pattern occurrences across five lines, all in one file:

- `.opencode/agent/toolsmith.md:232` — `deepseek/deepseek-3.2`
- `.opencode/agent/toolsmith.md:353` — `deepseek/deepseek-3.2`
- `.opencode/agent/toolsmith.md:630` — `deepseek-3.2`
- `.opencode/agent/toolsmith.md:655` — `glm-4.7`
- `.opencode/agent/toolsmith.md:717` — `deepseek-3.2`

`zai-coding-plan/` is 0; `deepseek/` is 2; `glm-` is 1; `deepseek-` is 4.
The AC is therefore unsatisfiable without editing `.opencode/agent/toolsmith.md`,
an edit that NG-5 and NFR-7 (spec lines 133, 343) forbid and the plan's closed
locality set excludes (plan lines 88–105). TC-POL-SCAN-004's positive
assertion ("the real trees report 0 findings") cannot pass, and the plan's phase 4
gate would be red. The AC also dodges its own ticket wording in the other
direction: the frontmatter `claude.model: opus|sonnet|haiku` (e.g.
`.opencode/agent/toolsmith.md:28`) is a model hint that the four patterns never
examine, which is defensible only if the AC is explicitly scoped to
provider-qualified policy literals, which it is not.

Remediation target: **specification** (AC wording) + **test_planning** (scan
target/patterns) + **needs_human_input** (scope choice).

Suggested fix: either (a) narrow AC-F2-2 to "no provider-qualified model
expression or provider/model policy assignment in an agent prompt", define the
scan as frontmatter/assignment contexts, and declare toolsmith's illustrative
example fences out of scope with the reason; or (b) add
`.opencode/agent/toolsmith.md` to the change's scope and remove the literals,
accepting a prompt edit against NG-5. The two readings have different scope
consequences, so this is the human decision recorded under "Pause Required".

### B2 — [blocking] cross_artifact_consistency — the 30/20 ceilings make the trailing-window park and half of AC-F4-1 impossible

Artifact: `chg-GH-374-spec.md` DM-8 (line 313), DEC-10 (line 437), Appendix A
(lines 617–619), AC-F4-1 (line 487); `chg-GH-374-plan.yaml` phase 1 DM-8 contract
(lines 359–365); `chg-GH-374-test-plan.md` TC-POL-SIM-003 (line 367), SIM-006
(line 370), DM-8 row (line 128), fixtures table (line 462).

Gap: `window-cost` declares `ceiling: 30` over 86,400 s; `ticket-cost` declares
`ceiling: 20` with no `entries` list, so it governs every entry. The ticket sum
is by definition ≥ the trailing-window sum, so **any** spend that reaches 30
also reaches 20. `evaluateBudgets` (`packages/core/src/provider/budgets.ts:122`,
`127–176`) returns a `failed` ticket outcome in that case, and
`combineProviderConditions` (`packages/core/src/provider/conditions.ts:49–65`)
reports a `failed` condition ahead of every park. The declared entry therefore
never becomes `parked`; it becomes `failed`, and `resolveProviderChain`
(`packages/core/src/provider/chain.ts:176–190`) returns
`provider.budget.exceeded` with no park and no chain park. I reproduced the
evaluation against the delivered module: with a cost-30 point,
`ticket-cost` is `failed` and `window-cost` is `parked`, so the combined entry
is failed. `budget-park.json` (`now` 12:00, point 11:00 cost 30) and
TC-POL-SIM-003's expected chain park cannot pass, and AC-F4-1's
"when the same facts reach the default chain, then both governed entries are
parked" is also impossible.

Remediation target: **specification** (DM-8, DEC-10, AC-F4-1, Appendix A) with
propagation to **test_planning** (SIM-003, SIM-006, CFG-005, DRIFT-004) and
**delivery_planning** (phase 1 contract).

Suggested fix: make the trailing-window ceiling strictly lower than the ticket
ceiling (e.g. `window-cost.ceiling: 20`, `ticket-cost.ceiling: 30` or `40`) so the
window park is reachable and the ticket ceiling remains the terminal outer stop;
then set `budget-park.json` to a cost equal to the new window ceiling and
`ticket-ceiling.json` to a cost at/above the new ticket ceiling. Both figures
remain initial, owner-reviewable policy (A-5).

### B3 — [blocking] plan_coverage — the phase 1 gate passes the wrong value to the profile validator, so a correct declaration fails the gate

Artifact: `chg-GH-374-plan.yaml` phase 1 gate (lines 399–402).

Gap: the gate calls
`parseAndValidateProfileConfiguration(doc.provider?.profiles, providers.config)`.
The delivered function reads `values.provider.profiles`
(`packages/core/src/provider/validate.ts:949`: `values.provider?.profiles`), so
passing the branch itself leaves `values.provider` undefined, returns the
**empty** profile configuration with `ok: true`, and then
`validateProfileConfiguration` refuses `provider.profile.absent`
(`validate.ts:1018–1025`). I reproduced this against the delivered source with a
synthetic valid declaration: `doc` → `ok: true`;
`doc.provider.profiles` → `provider.profile.absent`. The phase 1 gate therefore
exits 1 on a perfectly valid document, and the plan's first escalation trigger
(plan lines 276–278) tells the coder to "fix the declaration in phase 1's scope",
which would send the coder hunting a non-existent declaration defect.

Remediation target: **delivery_planning**.

Suggested fix: pass the whole document —
`parseAndValidateProfileConfiguration(doc, providers.config)` — and add a note
that the validator expects the document (or provider branch), not the
`profiles` child.

### B4 — [blocking] cross_artifact_consistency — the credential shape is wrong in the spec, the plan and the test-plan matrix

Artifact: `chg-GH-374-spec.md` DM-1 (line 306) and AC-F6-3 (line 491);
`chg-GH-374-plan.yaml` phase 1 DM-1 contract (lines 304–306);
`chg-GH-374-test-plan.md` DM-1 row (line 121).

Gap: all three say the credential child is
`{ style: literal, name: ZAI_API_KEY }`. The delivered configuration requires
`credentials.<name> = { sourceKey: { style, name } }`:
`packages/core/src/config/catalog.ts:77–91` (the `sourceKey` child is required
and the schema rejects unknown keys), `packages/core/src/provider/validate.ts:201–215`
(returns `credentials.<name>.sourceKey` when it is missing), and
`packages/core/src/config/defaults.ts:7–9` (the shipped default is
`zai: { sourceKey: { style: "literal", name: "ZAI_API_KEY" } }`). A coder
following the plan's "the values are not negotiable prose" contract would author
`zai: { style, name }`; the config layer would then refuse at the schema
(`config.key.unknown`, `packages/core/src/config/resolver.ts:264–265`) and phase 1
would fail. Appendix A (spec lines 597–598) and TC-POL-DRIFT-001 (test-plan
line 393) already use the correct `sourceKey` nesting, so the artifacts contradict
each other.

Remediation target: **specification** (DM-1, AC-F6-3) + **delivery_planning**
(phase 1 contract) + **test_planning** (DM-1 row).

Suggested fix: change every occurrence to
`{ sourceKey: { style: literal, name: <ENV_NAME> } }` and state that the
credential child's only key is `sourceKey`.

## Major findings

### M1 — [major] cross_artifact_consistency — "resolved config equals the declared document" ignores the shipped defaults

Artifact: `chg-GH-374-test-plan.md` TC-POL-CFG-006 (line 340), TC-POL-DRIFT-001
(line 393), TC-POL-DRIFT-006 (line 398).

Gap: the real resolved configuration is the merge of `PRODUCTION_DEFAULTS`
(`packages/core/src/config/defaults.ts:5–38`) and the document. The z.ai entry
already ships with a full quota block (`timeoutMs: 15000`,
`outageParkTtlSeconds: 300`, `credentialParkTtlSeconds: 900`,
`capParkTtlSeconds: 300`; `catalog.ts:103–116`). The document's DM-2 quota block
does not declare those four leaves, so the resolved `provider.entries` has nine
quota keys, not the five-key object CFG-006 deep-equals, and those four leaves
report `layer=defaults` — contradicting DRIFT-006's "no provider leaf reports
`layer=defaults`". The delivered reference test already proves the defaults layer
is real on provider paths
(`tests/behaviour/provider-chain-resolution.test.ts:95–107` asserts
`layer=defaults` for `provider.entries.zai-coding-plan.class`,
`provider.entries.zai-coding-plan.peak.timezone`, and
`provider.credentials.zai.sourceKey.name`). CFG-006/DRIFT-001/DRIFT-006 will fail
against a correct document.

Remediation target: **test_planning** (or **specification** if the document is
extended).

Suggested fix: either declare the four quota leaves explicitly in DM-2 (so the
document owns every leaf and the exact pins pass), or make the reference test
assert the declared subset per leaf and scope DRIFT-006's "no defaults" arm to
the keys the document actually declares, with the default-only leaves listed as
known.

### M2 — [major] ac_quality — AC-F4-1's "the entry is skipped as `budget-exhausted`" is not observable

Artifact: `chg-GH-374-spec.md` AC-F4-1 (line 487); `chg-GH-374-test-plan.md`
SIM-006 (line 370).

Gap: a ticket-scope crossing makes the entry's combined condition `failed`; the
engine returns `provider.budget.exceeded` directly
(`packages/core/src/provider/chain.ts:176–190`) and the CLI error path sets no
`data` and no `skipped` list
(`providerError` in `packages/cli/src/commands/provider.ts:250–265`,
`packages/cli/src/edge.ts:5151–5153`). The skip reason `budget-exhausted` exists
only for a `parked`/failed entry inside a chain park's `skipped` list, and a
ticket failure never produces that list. The test plan hedges with "where the
refusal carries the skip detail", which is not an oracle. The AC clause should
not claim a skipped-list payload the delivered command does not emit.

Remediation target: **specification** + **test_planning**.

Suggested fix: restate the ticket-ceiling arm as "the entry fails the ticket-scope
crossing, no park or expiry is created, and the refusal names the budget, the
measured figure, and the ceiling, stating that it cannot reopen"; drop the
skipped-list clause and the hedge.

### M3 — [major] ac_quality — the "naming the field" oracle is false for chain refusals

Artifact: `chg-GH-374-spec.md` AC-F1-1 (line 480) and F-1/§8.1 (lines 168, 291);
`chg-GH-374-test-plan.md` TC-POL-CFG-004 (line 338).

Gap: `ProviderValidationError` has no `field` member
(`packages/core/src/provider/validate.ts:46–51`). The five chain defects produce
prose details — "chain X references unknown provider Y", "chain X places
subscription entries after pay-per-token entries", "provider Z references unknown
credential W", "default chain D is not declared", "chain X has no entries"
(`validate.ts:380–411, 453–511`) — and the `provider resolve` runtime returns
`parsed.error.detail` as the summary (`packages/cli/src/edge.ts:5151–5153`). The
test's expected `chains.subscription-first.entries[...]`/`quota.credentialRef`
dot-paths are not in the payload. The AC's "naming the field" is an overclaim for
these identities.

Remediation target: **specification** + **test_planning**.

Suggested fix: assert the exact delivered detail strings (chain name + provider/
credential name + the reason phrase) and reword the AC/§8.1 to "names the chain,
entry, credential, or chain name in its detail"; keep "names the field" only for
profile/budget errors that actually carry `field`.

### M4 — [major] ac_quality — NOM-002 asserts blocker values the nomination result does not expose

Artifact: `chg-GH-374-test-plan.md` TC-POL-NOM-002 (line 420).

Gap: `nominateProviderProfile`'s refusal maps each eligibility entry to a string
`"<profile>:<verdict>[:<blockerKind>+…]"` — the blocker **kind**, not its value
(`packages/core/src/provider/engine.ts:192–199`). It never carries
`peak-window`. At 05:00 the strings are
`delivery:ineligible:condition+condition` and
`paid:ineligible:condition`, so the test's "both `peak-window` blockers named"
fails unless it uses the composed `provider profile resolve` payload, whose
`data.eligibility[].blockers` do carry `{ kind: "condition", value: "peak-window" }`
(`packages/core/src/provider/profile.ts:350–370`).

Remediation target: **test_planning**.

Suggested fix: assert the nomination refusal as `ok === false` plus the exact
string array, and move the blocker-value assertions to the composed
`provider profile resolve --json` arm (which the same case already drives).

### M5 — [major] test_traceability — SEC-002's hostile-extra-key refusal identity is false

Artifact: `chg-GH-374-test-plan.md` TC-POL-SEC-002 (line 442); plan phase 4
SEC-002 contract (plan lines 775–779).

Gap: the config schema rejects an unknown `value`/`secret`/`token`/`key`/`raw`
key as `config.key.unknown` (`packages/core/src/config/resolver.ts:264–265`), not
`provider.chain.invalid` at the credential node. If the case calls
`parseAndValidateProviderConfiguration` directly on a raw document, the parser
silently **ignores** extra keys (`packages/core/src/provider/validate.ts:201–215`
only reads `sourceKey`), so the hostile arm resolves instead of refusing. There
is no delivered path that produces the asserted identity. The `name` pattern
assertion is also not enforced by the delivered credential parser (it only
requires a non-empty string), although the declared `ZAI_API_KEY` values satisfy
it.

Remediation target: **test_planning**.

Suggested fix: drive the hostile declaration through the config layer
(`acquireFileConfig`/`resolve`) and assert `config.key.unknown` naming the
credential path; keep the credential grammar assertion to the exact declared key
sets; or drop the hostile-key arm if AC-F6-3 is reworded to a canary + exact
declared-shape proof.

### M6 — [major] test_traceability — SEC-003's credential-shaped scan false-positives on the change's own guides and test plan

Artifact: `chg-GH-374-test-plan.md` TC-POL-SEC-003 (line 442).

Gap: the declared scanned set includes the three edited guides, the spec, and
this plan. Those files already contain credential-shaped placeholders:
`doc/guides/opencode-model-configuration.md:155` (`ANTHROPIC_API_KEY=sk-ant-...`),
`:156` (`OPENAI_API_KEY=sk-...`), `doc/guides/zai-peak-hours-hook.md:173`
(`ZAI_API_KEY=zai-...`), and the test plan's own negative-control instruction
(`DEEPSEEK_API_KEY=sk-live-...`). The `*_API_KEY`-with-a-value pattern matches
them; the row only excludes a **bare** name, not a placeholder value. The suite
as written fails on its own declared set, and the guides cannot be edited to
remove the placeholders without losing operator setup instructions.

Remediation target: **test_planning** + **specification** (AC-F6-3 wording).

Suggested fix: define the placeholder carve-out explicitly (`...`, `<...>`,
`$VAR`, `sk-ant-…`), add a negative control that a realistic secret is reported
and a placeholder is not, and state in AC-F6-3 that the canary/no-value rule
covers real values, not documentation placeholders.

### M7 — [major] system_spec_consistency — the profiles page both claims and denies that profile `peakWindows` gate admission

Artifact: `doc/spec/features/feature-provider-profiles.md:38` vs `:61`;
`chg-GH-374-spec.md` OQ-1 (line 414) and §16 (line 462).

Gap: line 38 says the profile `peakWindows` rules "drive both the admission
gating below and the daemon's lane-level peak pausing". Line 61 says "admission
gating is unchanged by that enforcement layer", and the delivered code agrees
with line 61: `selectProfile` probes provider availability only
(`packages/core/src/provider/profile.ts:350–370`), and
`createResolvedProviderProbe` reads `descriptor.peak` and no `peakWindows`
(`packages/cli/src/edge.ts:2913–2938`). The change's OQ-1 quotes line 61 and
relies on it, but the page's line 38 contradicts it. The §16 obligation table
says these pages are "Verified, not restated" and that phase 7 records "no
current-truth statement is contradicted" — a generic verification will not
catch this contradiction unless the sentence is named.

Remediation target: **specification** (add the sentence to the §16 obligation
table).

Suggested fix: add `feature-provider-profiles.md` §profiles to the phase-7
obligation table: the sentence to stop is "These rules drive both the admission
gating below and the daemon's lane-level peak pausing"; the statement to become
true is "profile `peakWindows` are daemon lane-watch rule data and do not
participate in profile eligibility".

### M8 — [major] plan_coverage / test_traceability — the canonical gate battery omits `pnpm build`

Artifact: `chg-GH-374-test-plan.md` §6.1 line 451 ("No case depends on … the
presence of a built artifact") and §6.3 gate battery (lines 491–521);
`chg-GH-374-plan.yaml` environment preconditions (lines 123–130).

Gap: the workspace packages export from `dist/`, so `bun test` on a clean
checkout cannot resolve `@delivery-os/adapters/credentials` until `pnpm build`
runs — the plan records this as a reproduced precondition (plan lines 123–130),
but the test plan's gate battery starts at `bun test` and the §6.1 sentence says
the opposite. A runner following the test plan's numbered battery would fail for
an environment reason and could misattribute it to the change.

Remediation target: **test_planning**.

Suggested fix: add `TMPDIR=$PWD/tmp/tmpdir pnpm build` as gate 0 (once per
worktree, `dist/**` untracked), and correct §6.1 to say the suites depend on the
built workspace packages but never on an installed binary.

### M9 — [major] spec_completeness — the ticket's "records a typed attempt" clause is only half-evidenced, but the traceability table claims 5/5

Artifact: `chg-GH-374-spec.md` AC-F7-3 (line 494) and ticket traceability
(line 502); pm-notes decision (lines 85–89).

Gap: the ticket clause is "`jaiship dispatch <ref> --json` gets past
`provider.profile.absent` and records a typed attempt". The change deliberately
does not run `dispatch` (it would claim the repository lease and start a second
delivery), and substitutes the nomination predicate plus seat/binding proofs. That
proves the gate passes; it does not prove the typed attempt record. The table
labels the clause as fully traced, which overstates the evidence. No dry-run /
plan-only dispatch form exists in the delivered grammar to close the gap
(`packages/cli/src/commands/dispatch.ts`), so the substitution is reasonable — but
it must be stated as a partial satisfaction, not a 5/5 trace.

Remediation target: **specification** (traceability wording) + **decision_capture**
(record owner acknowledgement).

Suggested fix: change the row to "4/5 fully traced; 1 partially — the admission
half is proven by nomination/binding, the typed-attempt half is not run per the
no-self-dispatch decision" and record the owner's acceptance of that substitution
in the pm-notes (or in the PR's review notes).

### M10 — [major] cross_artifact_consistency — "the delivered quota-driven all-paid switch" is not reachable synchronously

Artifact: `chg-GH-374-spec.md` DM-6 (line 311), DEC-16 (line 443); §22 (line 557).

Gap: DM-6/DEC-16 call the paid profile "the target of the delivered quota-driven
all-paid switch". The synchronous probe reads no quota
(`packages/cli/src/edge.ts:2883–2938`), and the profile lifecycle's switch
provider is the first **unavailable** base provider (based on the probe), so a
quota-exhausted subscription does not move the selected profile; only the chain
fallback reacts to quota, and the daemon path that could mark the subscription
exhausted is not mounted (NG-7). §22 does disclose the boundary, but the
unqualified DM-6/DEC-16 claims read as a delivered switch. The seat-level
consequence — a z.ai seat still receives `zai-coding-plan/glm-5.3` while the
chain reports the paid fallback — is not stated.

Remediation target: **specification**.

Suggested fix: qualify DM-6/DEC-16 to "the declared target of the daemon
all-paid switch (not mounted by this change)" and add one sentence to §22/F-5:
the synchronous path does not move a z.ai seat to the paid model on quota
exhaustion; `provider resolve` reports the paid fallback, and live selection
waits for the daemon path.

### M11 — [major] spec_completeness / cross_artifact_consistency — the legacy-source scan's boundary is defensible but the AC/traceability overclaims the ticket clause

Artifact: `chg-GH-374-spec.md` AC-F6-1 (line 489), ticket traceability
(line 503), DEC-12 (line 439), Appendix D (line 711);
`chg-GH-374-test-plan.md` SCAN-001/SCAN-005 (lines 381, 385).

Gap: the ticket clause is "no committed script or prompt … installs the
pre-iteration hook". The tree contains
`doc/templates/blueprints/zai-peak-hours-hook--install.sh:28–29,44`, which
literally `cp`s `scripts/hooks/pre-opencode-iteration-zai.sh` to
`~/.ados/hooks/pre-opencode-iteration`, and `scripts/install.sh:144–147` ships
the hook examples under `ADOS_HOOK_EXAMPLES`. AC-F6-1 is scoped to the
"declared scan surface" and excludes `doc/**`, so it is satisfiable; the
traceability row quoting the unqualified clause is not. Excluding adopter
scaffolding from a scan of *this repository's delivery path* is defensible, but
the exclusion must be stated in the AC and the example installation must be a
declared allowed exception (the scan's "path ending `pre-opencode-iteration`"
pattern does not match `pre-opencode-iteration-zai.sh`, so `scripts/install.sh`
passes by a naming accident, not by a declared rule).

Remediation target: **specification** (AC-F6-1 + traceability) + **test_planning**
(SCAN-001/005).

Suggested fix: in AC-F6-1 say explicitly "over the declared surface, which
excludes adopter scaffolding (`scripts/hooks/**`, `scripts/.tests/**`,
`tests/fixtures/**`, the blueprint under `doc/templates/blueprints/**`) and
documentation"; add `scripts/install.sh`'s example-copy as an allowed exception
with its reason; update the traceability row to "the declared-surface grep".

### M12 — [major] test_traceability — SEAT-004's vision-requiring arm does not name the visual agent and resolves the alphabetically first (text-only) seat

Artifact: `chg-GH-374-test-plan.md` TC-POL-SEAT-004 (line 355); `chg-GH-374-spec.md`
AC-F2-3 (line 485).

Gap: the case drives "a vision-requiring selection (`requireVision: true`) on the
base at 12:00Z" without an `agent`. `targetSeatName(profile, undefined)` returns
`Object.keys(profile.seats).sort()[0]` (`packages/core/src/provider/profile.ts:123–130`),
which is `bootstrapper` — a text-only z.ai seat. The capability gate then produces
`provider.profile.capability-denied` (`profile.ts:351–356`), contradicting the
case's expected "not capability-denied". The AC's "the visual seat is eligible"
also does not name `designer`/`image-reviewer`.

Remediation target: **test_planning** + **specification** (AC wording).

Suggested fix: pass `agent: "designer"` (and a second arm for
`image-reviewer`) to `selectProfile({ requireVision: true, agent })`, and name the
seat in AC-F2-3.

## Minor findings

### m1 — [minor] spec_completeness — the legacy `openai` chain member and the alternate legacy profiles are dropped without a stated disposition

Artifact: `chg-GH-374-spec.md` §2.1 (line 66) names the legacy chain default
`mixed,zai-only,openai,deepseek`; DM-3 (line 308) declares only `subscription-first`
and `subscription-only`; the pm-notes legacy-intent note names only z.ai and
DeepSeek. The owner's disposition says "nothing may be dropped" (G-3, line 98).
The `openai` profile (`~/.ados/config/profiles/openai.sh`), `zai-only`, `zai-top`
and the tier files are not declared and their disposition is not recorded.

Remediation target: **specification**.

Suggested fix: add one DEC/pm-notes line: `openai` is intentionally not declared
(no credential/policy target in this adoption; the current target is DeepSeek),
`mixed` → `delivery`, `deepseek` → `paid`, `zai-only` → `subscription-only`, and
`zai-top`/`zai.sh` are alternate historical profiles not adopted. That makes the
"nothing dropped" claim auditable.

### m2 — [minor] cross_artifact_consistency — NFR-7 says "three test suites" while the change authors six

Artifact: `chg-GH-374-spec.md` NFR-7 (line 343) vs §16 (lines 455–458) and the
plan locality (lines 88–95). The five new suites plus the extended
`doc-conformance` are six files. Fix: say "the six test files (five new suites
plus the extended `doc-conformance`)".

### m3 — [minor] cross_artifact_consistency — "the only newly closed window is 04:00–06:00" needs the weekend/holiday qualifier at every site

Artifact: `chg-GH-374-spec.md` §1 (line 57) and DEC-17 (line 444);
`chg-GH-374-test-plan.md` TC-POL-CFG-009 (line 343). The arithmetic is correct on
the daily time-of-day axis, and DEC-9 states the weekend/Chinese-holiday superset,
but "the only newly closed window" is false over a full week (weekend mornings
and holidays are also newly paused). Fix: say "the only newly closed *time-of-day
interval*; weekends and Chinese holidays are additionally paused (DEC-9)" in the
AC/CFG-009 and keep the daily-superset sentence adjacent.

### m4 — [minor] test_traceability — CFG-005's refusal-string assertion names `workItemRef`, which the summary does not contain

Artifact: `chg-GH-374-test-plan.md` TC-POL-CFG-005 (line 339); the delivered
summary is "no active work-item ref was found at <path>"
(`packages/core/src/provider/budgets.ts:295–300`). Fix: assert the exact phrase
"no active work-item ref was found at" + the context path, or assert the code
`input.value.rejected` and the path.

### m5 — [minor] decision_capture — the `envName` omission is a real ticket deviation and is not on the owner-review list

Artifact: `chg-GH-374-spec.md` DEC-7 (line 434), ticket-task traceability
(line 506). The ticket lists `envName` among the seat fields; the declaration
omits it and derives `OC_JAISHIP_AGENT_<SEAT>_MODEL`. The rationale (brand
neutrality, `AGENTS.md`) is sound, but the deviation is not surfaced with the
ceilings/floor in the PR. Fix: add it to the PR's owner-review list as an
explicit deviation, with the derivation and the record-level satisfaction.

### m6 — [minor] plan_coverage — the commitlint PATH workaround is only in the retro note, not in the plan's preconditions

Artifact: `chg-GH-374-pm-notes.yaml` retro note (lines 163–172) vs
`chg-GH-374-plan.yaml` environment preconditions (lines 123–140). The coder will
hit the same `commit.commitlint-failed` / shadowed-shim failure. Fix: add the
working invocation (append `node_modules/.bin` to PATH; installed binary wins)
to the plan preconditions or the coder handoff.

## Focus-area judgments

1. **AC satisfiability against delivered code.** Most ACs are satisfiable; the
   exceptions are AC-F2-2 (B1), AC-F4-1's window-park arm (B2), AC-F1-1's
   "field" wording (M3), AC-F6-3's credential shape (B4), NOM-002's blocker
   values (M4), SEC-002's hostile-key identity (M5), and SEAT-004's agent-less
   vision arm (M12). The chain-park shape (`data.decision.park.*`,
   `chain:subscription-only`, `chain-exhausted`, contributing kinds) matches
   `chain.ts:215–236` and `parks.ts:85–107`; `shadowed` is in
   `PROVIDER_SKIP_REASONS` and is what `skipReason` returns for a clear paid
   entry under `allowPaidFallback` (`chain.ts:94–105`); `provider simulate`'s
   exits and payload keys match `simulate.ts:536–629` and the CLI; the work-item
   ref rule matches `budgets.ts:286–301` and `production.ts:564–574`; the
   `--chain subscription-only` proof is valid.
2. **Policy faithfulness.** Per-seat routing matches `mixed.sh` exactly (8 glm,
   2 flash, 14 deepseek; visual seats on deepseek-flash, confirmed in
   `~/.ados/config/profiles/mixed.sh:76–110`); the paid union 01:00–10:00, the
   subscription 06:00–10:00 + 7200 s, the daily superset, the 04:00–06:00 cost,
   both ceilings and the 2 USD floor are present. The legacy `openai` chain
   member is dropped without a disposition (m1), and the "quota-driven all-paid
   switch" is not reachable synchronously (M10). Nothing else is silently
   dropped; the pacing ladder and compaction are explicitly deferred/left to the
   harness.
3. **04:00–06:00 arithmetic.** Correct: legacy DeepSeek windows
   01:00–04:00/06:00–10:00, new pauses [04:00,10:00) ∪ [01:00,10:00) = the same
   two windows plus 04:00–06:00. "Only newly closed" is true per day-of-time;
   the weekend/holiday caveat is m3.
4. **Legacy-source scan.** The scan over `scripts/**` (minus hooks/tests),
   `tools/**`, `.opencode/**`, `packages/**`, `tests/**` (minus fixtures/self)
   finds no real sourcing/install writes in the included surface; the allowed
   invocation in `deliver-ticket.sh:620–622` and `ceo-loop.sh:200` is correctly
   unreported. The blueprint exclusion is defensible as scaffolding, but the AC
   /traceability must say so (M11); `scripts/install.sh`'s example copy is an
   undeclared allowed exception. The scan is meaningful for the *typed path*
   claim, not for the ticket's literal repository-wide clause.
5. **Model literals.** The pattern set is neither honest nor sufficient: it
   misses the frontmatter `claude.model` hints (allowed by AGENTS.md's
   tool-specific frontmatter contract, but the AC says "no model literal") and
   it is falsified by toolsmith's prose examples (B1). It dodges the AC while
   also failing its own four patterns.
6. **Budget ceilings.** The figures are legitimately owner-reviewable, but the
   current 30/20 ordering is not: it makes the window park unreachable and
   defeats a ticket AC (B2). Fix the ordering first; flagging the final figures
   at PR review remains acceptable.
7. **Test-plan realism.** 52 cases / 15 ACs in both directions, one owning suite
   per case, hermetic scratch execution and explicit negative controls are
   strong. The realism defects are the oracle/identity issues above, the missing
   `pnpm build` gate (M8), and the guide/test-plan placeholders in SEC-003 (M6).
8. **Plan readiness.** Phase scopes, gates, case→phase mapping (52/52), AC
   ownership and commit subjects are consistent; phase 1 can be verified by its
   one-off validator probe before phase 2 exists — once B3 and B4 are fixed.
9. **Documentation obligations.** The spec/test plan/plan name the exact pages,
   statements and the `ados_distribution`/guard obligation. The missing piece is
   the `feature-provider-profiles.md:38` sentence (M7).
10. **Scope discipline.** No `packages/**`, `.opencode/**`, `.ai/**`, `.jaiship`,
    or decision record is required by the intended design; no self-dispatch is
    performed; `.delivery-os/config.yaml` is the right tracked home until M4-S2
    (A-1; `production.ts:1786–1793, 1935`). The one conflict is B1: the literal
    model-literal AC would force a `.opencode/agent/toolsmith.md` edit that the
    scope forbids.

## Pause Required — the human decision

The workflow must stop for one product/scope decision. The ticket requires "no
model literal lives in an agent prompt"; the tree contains model literals in
`.opencode/agent/toolsmith.md` (illustrative examples, not assignments); the
change's scope forbids editing `.opencode/**`.

Question for the owner: should AC-F2-2 be narrowed to "no provider-qualified
model expression or provider/model policy assignment in an agent prompt" (with
toolsmith's illustrative example fences explicitly out of scope and the
`claude.model` frontmatter treated as the AGENTS.md tool-specific contract), or
should this change widen scope to remove the literals from
`.opencode/agent/toolsmith.md`?

The budget-ceiling ordering, the validator-gate argument, and the credential
shape are PM/author fixes and do not need a human pause.

## Smallest remediation map

- **specification** (`@spec-writer`): AC-F2-2 wording (B1, pending the owner
  answer); DM-8/DEC-10/AC-F4-1 figures and the ticket-ceiling wording (B2, M2);
  DM-1/AC-F6-3 credential shape (B4); AC-F1-1/§8.1 "field" wording (M3); §16
  profiles-page sentence (M7); traceability rows for the dispatch and scan
  clauses (M9, M11); the openai/legacy-profile disposition (m1); NFR-7 count (m2);
  the 04:00–06:00 qualifier (m3); the envName owner-review note (m5).
- **test_planning** (`@test-plan-writer`): SCAN-004 target/pattern (B1); SIM-003/
  SIM-006/CFG-005/DRIFT-004 figures (B2, M2); CFG-006/DRIFT-001/DRIFT-006
  defaults handling (M1); CFG-004 detail-string oracle (M3); NOM-002 blocker
  values (M4); SEC-002 identity (M5); SEC-003 placeholder carve-out (M6);
  SEAT-004 agent (M12); §6.1/§6.3 `pnpm build` (M8); CFG-005 wording (m4).
- **delivery_planning** (`@plan-writer`): phase 1 validator argument (B3); phase 1
  DM-1 shape (B4); phase 1 DM-8 figures (B2); the plan's SEC-002 contract (M5);
  the commitlint precondition (m6).

VERDICT: NOT_READY
