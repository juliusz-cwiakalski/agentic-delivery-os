# Readiness Review Iteration 3

Verdict: READY
Work Item: GH-365
Date: 2026-11-21
Pause Required: no

## Scope of this review

Read in full: `chg-GH-365-spec.md` v1.5, `chg-GH-365-test-plan.md` r0.4,
`chg-GH-365-plan.yaml` (ten phases), `chg-GH-365-pm-notes.yaml`,
`readiness-review/readiness-iter-1.md`, `readiness-review/readiness-iter-2.md`,
`doc/decisions/TDR-0074-project-groups-document-operator-local-overlay.md`,
`doc/decisions/00-index.md`, the GitHub #365 body plus both owner comments
(`gh issue view 365`), and the delivered surfaces needed to test the claims:
`packages/cli/src/index.ts` (`parseInvocation` 439–493, the audit write 612–651),
`packages/cli/src/edge.ts` (`createCliAudit` 661, `createProductionDependencies`
1697 with the audit composition at 1701, `NEUTRAL_OVERRIDE_NAME` 629),
`packages/cli/src/entrypoint.ts`
(`resolveWorkingName`, `workingNameEnvironmentVariable`), `packages/cli/src/help.ts`
(the M4 install entry, usage line `install [--migrate]`), `packages/cli/src/bin/*`,
`packages/mcp/src/serve.ts`, `packages/core/src/contracts/install.ts`
(`INSTALL_DOMAIN_CODES`, 11 rows), `packages/core/src/domain/commit-staging.ts`,
`packages/adapters/src/git/commit.ts`, `scripts/checks/forbidden-literals.ts`
(`EXPECTED_SCOPE_IDS`, `listRepoFiles`, `registered`-only `userFacingDocs`),
`scripts/checks/forbidden-literals.registry.json` (200 registered docs, five
classes), `scripts/checks/ignore-rules.ts`, `scripts/checks/changesets-group.ts`,
`.changeset/config.json`, `tests/checks/identity-docs.test.ts`,
`tests/checks/forbidden-literals.test.ts`,
`tests/structure/install-conformance.test.ts` (`definition.flags` pin, 129),
`tests/checks/install-lifecycle-path.test.ts`, `tests/structure/rename-drill-doc.test.ts`,
`.gitignore`, `.git/info/exclude`, and the live tracked tree.

Mechanical checks re-run rather than assumed:

- `jaiship plan validate GH-365` → `verdict=valid`, `tier=full`,
  `readyForDevelopment=true`, ten phases; `jaiship lint plan GH-365` → valid,
  zero errors.
- Plan scope arithmetic parsed from the YAML: **168** file entries over **121**
  unique paths + **1** folder entry (P10); per-phase entries
  14+8+20+11+27+25+11+21+26+5 = 168.
- Spec §17: **31** AC rows (4+4+8+4+6+5), ids F1-1…F6-5 contiguous and unique.
- Test plan: **36** `#### TC-` sections (6 groups: 4/4/12/4/6/6); matrix 31 rows
  with **37** links (6 extras: AC-F1-2 +2 on TC-SCAN-004/005, AC-F1-3 +1 on
  TC-LAYER-003, AC-F3-1 +2 on TC-MIGRATE-002/011, AC-F3-5 +1 on TC-MIGRATE-007);
  **55** mutation rows M1–M55; allocation by owning phase
  5+3+5+5+21+3+4+8+1 = 55 (P1 M1–M5, P2 M32–M34, P3 M31/M36–M39, P4 M40–M43+M55,
  P5 M10–M30, P6 M52–M54, P7 M6–M9, P8 M35/M44–M50, P9 M51).
- `PROMPT_REQUIRED_COMMANDS` = **28** with `install` 26th and `provider` last;
  `INSTALL_DOMAIN_CODES` = **11**; `.changeset/config.json` fixed group = the five
  lockstep packages.
- TDR-0074 tracked (`git ls-files --error-unmatch` exits 0); its
  `doc/decisions/00-index.md` row is line 99; `git status --porcelain --
  doc/decisions` empty.
- `git check-ignore .jaiship/config.yaml` exits **1**; `.git/info/exclude` no
  longer names `.delivery-os/` or `.jaiship/`; `.gitignore` already carries
  `.*/config.local.yaml` and `.*/projects.yaml`.
- Content-arm achievability over the real tree: path/environment seeds occur in
  exactly **5** `packages/**` files, **1** `.opencode` file, **7** `scripts/**`
  files, and **8** path/env occurrences across the **5** registered docs P3
  restates (`ceremony-runner`, `provider-conditions-and-parks`,
  `feature-branding-seam`, `feature-cli-entrypoint`, `feature-mcp-surface`).
  The three owner-hold pages and the glossary are **not** in `registered` and
  therefore cannot be scanned (declaration-only), exactly as DM-3/DM-4 now state.
- `bun test tests/structure/rename-drill-doc.test.ts` → 5 pass,
  `bun run scripts/checks/ignore-rules.ts` → green (four classes).

---

## A. Disposition of iteration-2 findings

| ID | Disposition | Evidence |
|----|-------------|----------|
| **S18** audit suppression / pre-freeze ordering | **Resolved** | Spec v1.5 makes the delivered pair a **declared suppression for `install migrate` in every mode**: API-1 (line 251), DM-7 (273), AC-F3-1…AC-F3-4 (500–503), §8.5 row 13 (301), §8.2 (261), §10 (327), §12 (351), §20 (574), §21 (582), F-3 steps 3/8/10 (133/138/140), Flows 2/3 (168, 182), §4.1 (92), DOD-10 (554), glossary "Command audit" (632), Appendix F (787). No "pair at the destination before the move" statement survives (only the §26 history entries, which record the superseded ruling). Feasibility re-verified against the delivered seam: `packages/cli/src/index.ts:614–651` gates the write only on `deps.audit`, and `parseInvocation` (439) rejects an undeclared flag before a definition resolves, so suppression must be keyed on the invocation tokens in the runner — inside `packages/cli/src/index.ts`, which **P5 declares** (plan line 1749) and obligation 5.7 (1601–1615) names. Observability holds: `createCliAudit` (edge.ts:661) is composed by `createProductionDependencies` (edge.ts:1697, audit at 1701), and the test plan keeps it composed **and recording** (TC-MIGRATE-001 step 8, 699; TC-MIGRATE-003 step 5, 773; TC-MIGRATE-004 step 7, 814), so the recorder sees zero writes = suppression, not an absent seam. |
| **S19** derived rule vs DM-6 table and retirement | **Resolved** | DM-6 (272) now states the derived rule **before** the entry table: never moved/backed up/counted/conflicted; destination copy `already-migrated`/`absent`; source copy a derived residual "removed with a retired root"; and retirement of a root whose **non-derived** entries resolve explicitly says "a retained derived residual does not prevent that retirement line". F-3 steps 6–7 (136–137), glossary "Disposition"/"Derived residual" (626, 631), AC-F3-3/AC-F3-5 (502, 504), §20 (571) and DEC-4 (397) agree. Test plan now matches: TC-MIGRATE-006 step 9 (888), TC-MIGRATE-007 steps 2 and 5 (921, 924), TC-MIGRATE-005 step 3 (848). The seven-token / swallow-retirement contradiction is gone. |
| **S20** declared site vs scanned corpus | **Resolved** | DM-3 (269) states "presence is validated always; a match is validated only for a site that lies in a scanned corpus", with a declaration-only outcome; DM-4 (270) explains that `userFacingDocs` scans only the post-baseline **registered** list; NFR-6 (316), AC-F4-2 (514), the glossary "Declared site" (621) and Appendix F (785) repeat it. Verified against the code: `forbidden-literals.ts:415–443` scans `scannedDocs = registry.registered` only and hard-fails a registered doc present at `corpusBaseline`, so the three owner-hold pages and the glossary can only be declaration-only — which is what the spec now says. The test plan asserts the split (TC-SHIM-002 step 1 line 530, step 5 line 534, Notes 543–546). |
| **S21** pre-freeze fixture misassigned | **Resolved** | DM-3 (269) and Appendix F (754) assign `ADOS_`/`.ados` to the legacy adapter and the eight-variable fixture, and keep the fixture **off** `prior-environment-prefix`; the `DELIVERY_OS_` sites are the owner-hold hook, its battery, the three owner-hold documents and the entrypoint harness. Plan 2.3(b) (1054–1061) and 2.3(d) (1064–1072) carry the same split; P8 (2102–2123) keeps the mapping bound in the adapter and moves the override exception to the raw-environment seam. |
| **S22** AC-F6-1 alias | **Resolved** | AC-F6-1 (533) is scoped to "each **current-identity** composed surface (the primary CLI, the entrypoint's composition, and the MCP composition with no configured working name)" and **excludes** the alias as a declared prior default (DM-9, §8.5 row 7). TC-IDENTITY-001 steps 7–8 (1333–1334) assert the alias's prior default as a shim fact plus an override arm where it is current. |
| **S23** `ADOS_WORKING_NAME` seam | **Resolved** | DEC-9 (402), §8.5 row 12 (300), F-6(c) (150), API-5 (255), API-6 (256) and AC-F6-3 (535) all place the read at the **entrypoint/edge raw-environment seam before brand/prefix derivation**, never in the adapter mapping, with the mapped override name excluded from configuration-layer strictness. Verified against the delivered reads: `edge.ts:5001` (`options.environment[NEUTRAL_OVERRIDE_NAME]` before `resolveBrandIdentity`), `entrypoint.ts:175`, `bin-launcher.ts:93` — the seam exists and is raw. Plan 8.1/8.4 (2084–2123) and TC-IDENTITY-003 step 8 (1404) assert the same precedence and strictness exclusion. |
| **S24** AC-F1-2 attribution | **Resolved** | AC-F1-2 (483) now requires only that "one mutation that hardcodes the prefix set fails the **AC-F1-2-named assertion** … the mutation may share an owning case, and attribution is per assertion, not per case"; DOD-1 (545) reads attribution per assertion. TC-SCAN-003 step 8 (573) and Notes (581) state exactly that; M55 (1773) is routed to the first mutation family and `P4`'s obligation 4.2 (1435–1442) repeats it. The "only this criterion" claim is gone. |
| **S25** Flow 2 manifest order | **Resolved** | Flow 2 (172) is now "write the manifest, report the backup (all n planned entries, before the first move)" placed **after** the per-entry backup/verify loop and **before** the move loop. |
| **S26** doc count 14 | **Resolved** | §2.1 (56) says "fourteen files" and its enumeration sums to fourteen (3 stale-path guides + 1 example guide + glossary + 5 feature pages + 2 M1 snapshots + 1 inception record + 1 quality test spec). |
| **S27** OQ-1 context | **Resolved** | OQ-1 (387) now reads "the ceremony mirror composes its target set from the **invoking checkout's own** `projects.yaml` members (whose `root` values name other checkouts)". |
| **B6** zero records without the seam | **Resolved** | TC-MIGRATE-001 step 8 (699), TC-MIGRATE-003 step 5 (773), TC-MIGRATE-004 step 7 (814), TC-MIGRATE-005 step 7 (852), TC-MIGRATE-010 step 6 (1029) all assert **0 records of any kind** with the audit dependency composed and recording; D2 (test plan line 199) and §8.2 item 12 (1891) state the dependency stays present; M17/M24/M26 carry the suppression branches (1690, 1702, 1709). No "exactly two records at the destination" assertion remains. |
| **B7** derived residual | **Resolved** | TC-MIGRATE-007 steps 2 and 5 (921, 924) match DM-6's derived rule and retirement; TC-MIGRATE-005 step 3 (848) and TC-MIGRATE-006 step 9 (888) are consistent. |
| **B8** alias arm | **Resolved** | TC-IDENTITY-001 step 7 (1333) removes the alias from the strict current-path claim and asserts its declared prior default; step 8 (1334) asserts the override arm. |
| **B9** override seam | **Resolved** | TC-IDENTITY-003 step 8 (1404) asserts the raw-environment read, the precedence, the strictness exclusion and "no configuration key"; TC-SHIM-003 adds the row C2 (per test-plan revision 0.4, line 1919). |
| **B10** `--migrate` grammar/help split | **Resolved** | TC-MIGRATE-012 step 2 (1127) separates `definition.flags` (retains `--migrate`, pinned) from the documented/help flag set (retires it) and aligns with TC-MIGRATE-011 step 7 (1096). Verified feasible: `help.ts` renders a static table (usage line 1071 `install [--migrate]`), and the parser reads `definition.flags` (`index.ts:453–465`), so the two surfaces are genuinely independent. |
| **B11** presence/match | **Resolved** | TC-SHIM-002 step 1 (530) asserts presence for all sites and match/budget only for in-corpus sites, names the declaration-only set, and row B (533) proves presence is unconditional; row F (537) proves the lineage separation. |
| **B12** seven-class exact shape | **Resolved** | TC-SCAN-001 step 7 (461) asserts the widened validation accepts exactly **seven** classes and rejects the old **five-class** registry by name, while the ADR-0003 DEC-8 seed/allowlist exact shape is unchanged. Verified the delivered pins: `EXPECTED_SCOPE_IDS` (`forbidden-literals.ts:15`), `scopeClasses` length 5 (`tests/checks/forbidden-literals.test.ts:60`), `outcome.classes` order (`tests/checks/identity-docs.test.ts:297`). |
| **B13** per-assertion M55 | **Resolved** | TC-SCAN-003 Notes (581) and §7.4 M55 (1773) plus the closing total (1775) state per-assertion attribution and drop the case-level "only row" claim. |
| **C10** local-exclude staging blocker | **Resolved** | Plan 1.0 (859–870) is now an explicit precondition: remove the local `.git/info/exclude` entries and write the pattern before staging, with the reason (the commit primitive stages from `git status` + `git add -A`); the gate adds a **pre-gate precondition** `git check-ignore .jaiship/config.yaml` must exit 1 (945–949) and done criterion **d0** (963–965). Environment re-verified: `.git/info/exclude` no longer names either root and `git check-ignore` exits 1, so P1 can stage the moved layer on this workstation; a fresh lane inherits the shared exclude (or has none on a new machine) and the precondition is stated for it. `computeStagingPlan` (`commit-staging.ts:41–84`) is candidate-driven, so an unchanged declared path cannot block the commit. |
| **C11** five scanned pages | **Resolved** | Plan header (312–332) and 3.6 (1268–1292) require the five registered pages to end **literal-free** (shim named by id) and **not** declared as sites; the three owner-hold pages are P2 sites reworded in P9 (2.3(e), 1073–1083; 9.3, 2341–2356). The registry is consumed, never edited by P3 (interaction note 1393–1395). Verified achievability: all 8 path/env occurrences in registered non-corpus docs fall on exactly those five pages. |
| **C12** glossary sites | **Resolved** | DM-3 (269) now declares the glossary a site of **two** shims (`prior-working-name-override`, `prior-config-directory`), presence-only; plan 9.6 (2372–2382) adds exactly those two with role sentences and budgets in the same commit as the rows, and re-runs both the registry and conformance suites. |
| **C13** pre-freeze sites | **Resolved** | Plan 2.3(b) (1054–1061) sites `ADOS_`/`.ados` at `packages/adapters/src/legacy/index.ts` (the `LEGACY_ENV_PREFIX` constant and the provider table) and the eight-variable fixture; 2.3(d) (1070–1072) sites the harness as `prior-environment-prefix`; P2's gate expectation states "the two lineages' sites are disjoint" (1135) and d5 enforces it (1153–1154). |
| **C14** `--migrate` pin vs remedy | **Resolved** | Plan 6.2 (1791–1797) keeps `--migrate` in `definition.flags` so the remedy is reachable; 6.4 (1810–1813) updates the install-conformance pin (entry count 5→6; `--migrate` retained as a recognised refusal flag) and separates the documented set. Verified against the pin (`install-conformance.test.ts:129`) and the handler. |
| **C15** golden reasons | **Resolved** | Plan 8.2 (2093–2098): "P7 authored the four delivered lines, this phase adds the fifth". |
| **C16** boundary control count | **Resolved** | Plan P7 d4 (2035–2036) reads "the eight-proven / eight-not-proven boundary holds with FIVE planted controls". |
| **C17** seam count | **Resolved** | Plan header (56) cites "the THIRTEEN seams"; test plan §7.1 (1588) has thirteen rows. |
| **C18** nine files | **Resolved** | Plan header (202, 309–311): "seven documents plus the prompt pair — NINE files". |
| **C19** class-shape pin | **Resolved** | Plan 3.4 (1246–1253) names `EXPECTED_SCOPE_IDS` + the `forbidden-literals.test.ts` shape assertion as the authority and `identity-docs.test.ts` as a consumer edited only for its class-order assertion; verified both pins exist at those files. |
| **C20** "exactly one changeset" | **Resolved** | Plan 2.4 (1097–1101) makes it mechanically observed in the registry suite (one GH-365 changeset, five lockstep packages, window equality) and P10 10.5 (2539–2545) re-runs it; verified the fixed group is the five packages and `changesets-group.ts` validates the group. |
| **C21** scope arithmetic ledger | **Partially resolved** | The plan header now states the correct arithmetic — "168 file entries over **121** unique paths, plus one folder entry", with the derivation (81–90) — which matches the parsed YAML. Two bookkeeping residues remain: the same header's own C21 line still says "168 / **122** unique / 1 folder" (line 212), and `pm-notes` line 212 still records 122 with no appended correction. No scope entry, phase, or gate depends on the figure. Non-blocking (advisory A1). |
| **C22** duplicate 9.3 | **Resolved** | P9's obligations now run 9.1…9.7 (2334–2388) with one `9.3` (guides + M4 blueprint) and distinct 9.4/9.5/9.6/9.7. |
| **C23** verify-only suites | **Resolved** | `tests/behaviour/projects-groups-list.test.ts`, `tests/structure/rename-drill-doc.test.ts`, `tests/behaviour/projects-config.test.ts` and `tests/behaviour/ceremony-mirror-composition.test.ts` are **not declared in any phase scope** (parsed and checked), are re-run as controls (P7 gate 2022–2024, P9 gate 2437), and the plan's assumption (o) (783–793) states the rule once. |
| **C24** audit-suppression code area | **Resolved** | P5's scope declares `packages/cli/src/index.ts` (1749) and `packages/cli/src/edge.ts` (1750), and 5.7 (1601–1615) names the seam and the "composed and recording" proof. |
| **C25** owner-hold pages reworded | **Resolved** | 2.3(e) (1073–1083) removes "never reworded": the three pages are **declared sites** for surviving mentions **and** are **reworded in P9** because their prose calls the example hook's names "the current default brand's names"; 9.2/9.3 (2324–2356) and Appendix A (657, 664) carry the same, and P9 d1 (2445–2447) asserts it. Verified the current prose is indeed presented as current. |

No iteration-1 or iteration-2 finding **regressed**.

---

## B. New findings

**None blocking.** After the second remediation, no spec/test-plan/plan contradiction remains
that would make a declared phase gate unachievable or contradict the ticket. The items
that survive are precision/bookkeeping advisories that change no AC, case, phase,
scope entry, or gate, and none of them needs an artifact edit before delivery starts.
They are recorded below for the PR body and for the coder's attention.

---

## C. Residual advisories (non-blocking; carry in the PR body)

**A1 — [nit] `arithmetic` — `chg-GH-365-plan.yaml` line 212; `chg-GH-365-pm-notes.yaml` line 212.**
Gap: the plan's C21 restatement and the historical pm-notes entry still say "122 unique
paths" while the plan header and the YAML say 121. Required fix (post-delivery housekeeping,
not a readiness item): when the PM next appends a `notes:` entry, record
"168 file entries / 121 unique paths / 1 folder (P10)", and leave both historical entries
as written. Owning artifact: `delivery_planning` (bookkeeping only).

**A2 — [minor] `test_planning` — `chg-GH-365-test-plan.md` §7.7(b) line 1846 vs plan P8 8.6 (2146) and `evidence.ts` declarations in P1–P8.**
Gap: §7.7(b) says the battery-row registry "must be complete by `P7`", but the plan has
P8 append rows (8.6) and `tests/fixtures/namespace/evidence.ts` is declared in P1…P8.
`TC-IDENTITY-006` is still green at P7 (all eight proven ids have rows by then) and the
aggregate re-runs it, so nothing fails. Required fix if the reviewer wants precision:
"complete for every proven id by P7; later phases append rows that the aggregate
re-validates". Owning artifact: `test_planning` / `delivery_planning` (wording only).

**A3 — [minor] `test_planning` — `chg-GH-365-test-plan.md` TC-SHIM-002 step 1 (line 530).**
Gap: the step names the glossary among the **declaration-only sites** it asserts, but the
glossary is declared only in P9 (plan 2.3 line 1087–1089; 9.6). At the P3 boundary the
glossary is not yet a declared site; the step still passes (the file is present and is
never reported matched), but it does not verify the declaration until P9's re-run. No gate
fails. Required fix if amended: "…and, from P9, the glossary". Owning artifact:
`test_planning` (precision only).

**A4 — [minor] `delivery_planning` — `chg-GH-365-plan.yaml` P2 scope line 1166–1168.**
Gap: P2 declares `packages/adapters/src/legacy/index.ts` with the note "read, not edited",
while the plan's own scope rule (252–264) says only authored/edited paths are declared.
The declaration is harmless (the staging plan is candidate-driven, so no diff is required)
and P8 legitimately edits the file from its own declaration. Required fix if amended:
mark it as a *read-for-data* declaration in the three-kind list. Owning artifact:
`delivery_planning` (rule wording only).

**A5 — [nit] `specification` — API-1 (spec line 251) and DM-7 (line 273): "Nothing is written before, during, or after the run, in a source root or a destination root."**
Gap: in context the sentence is about **records**, but read literally it would forbid the
backup (inside the destination configuration root) and the moved entries themselves. The
test plan asserts only "0 records" plus "0 writes" on dry-run/refusals, so no case
contradicts it. Required fix if amended: "No record is written …". Owning artifact:
`specification` (wording only).

**A6 — [advisory] `delivery` execution note — the tracked `.gitignore` pattern.**
`.*/projects.yaml` is already committed on the branch (`3f7f4d7b`, `docs(GH-365): update
.gitignore`), so P1 1.2 is a no-op on this lane and the fresh-clone drill's evidence is
carried by the change head rather than by P1's diff. AC-F1-3/DOD-4 are change-head
properties, so nothing fails; if the coder re-runs the drill before pnpm-check parity,
note in the phase pm-notes that the pattern pre-existed. No artifact edit required.

**A7 — [advisory] implementation precision — the shell site→shim assignment.**
Plan 2.3(d) enumerates all seven shell files as sites but assigns them by a group label
("the `DELIVERY_OS_` shell surfaces"). The longest-literal rule (DM-3, Appendix F) requires
per-shim assignment, and the content arm is shim-keyed (TC-SHIM-002 step 2: "one of **that
shim's** declared sites"). The coder should declare:
`scripts/install.sh`, `scripts/uninstall.sh`, `scripts/.tests/test-uninstall.sh` as
`prior-working-name-override` sites (they hold `DELIVERY_OS_WORKING_NAME`);
`scripts/lib/dispatch-authority.sh` and `scripts/.tests/test-dispatch-bash-fallback.sh` as
`prior-config-directory` (plus `prior-executable` for the bare token in the battery);
`scripts/hooks/pre-opencode-iteration-owner-hold.sh` and its battery as
`prior-state-directory`, `prior-environment-prefix` and `prior-executable` (the hook's
own comment names the prior working name). A uniform `prior-environment-prefix` mapping
would leave the override occurrences undeclared and would also create a zero-match
in-corpus site for `dispatch-authority.sh`, failing TC-SHIM-002 steps 1–2 at P3.

**A8 — [advisory] implementation precision — audit suppression must be pre-parse.**
Because `parseInvocation` (`index.ts:439`) returns `ok:false` for an undeclared flag before
a command definition is resolved, a suppression keyed on a resolved definition (or on a
handler-set flag) would still write the pair for the `install migrate --force` arm and fail
TC-MIGRATE-001 steps 2 and 8. The predicate must read the invocation tokens (command
`install` + subcommand `migrate`) in the runner, which is inside `packages/cli/src/index.ts`
(P5's declared scope) and leaves every other command's seam unchanged.

**A9 — [nit] `delivery_planning` — plan header lines 373–375.**
Gap: the leftover sentence "treats a prior literal as the shim the P2 registry already
declares" is ambiguous against 3.6's literal-free mandate for the five scanned pages. The
authoritative obligations (3.6 (i)/(ii)) are unambiguous. Owning artifact:
`delivery_planning` (wording only).

**A10 — [nit] `test_planning` / `specification` — the tree-arm job id.**
`ts-namespace-conformance` appears in M42/M43 and Flow 6 while Appendix D leaves the exact
job id implementation-decided. Harmless (the M rows are reviewer-executed), but the
permanent CI-binding case should read the job id from the topology check rather than a
literal.

---

## D. Verified correct (do not churn these)

- Plan validity and shape: ten phases, `tier=full`, `readyForDevelopment=true`, lint-clean,
  `kind: delivery` and `repo:main-tools` on every phase.
- AC/TC arithmetic: 31/31 ACs; 31 matrix rows; 37 links (6 declared extras); 36 detail
  sections = 36 index rows; 34 AC-linked + 2 NFR-only; every case's owning phase in §4.2
  equals the plan's acceptance line, with no AC double-owned (AC-F3-1's last observation is
  P6; P5 explicitly disclaims it).
- Mutation arithmetic: 55 rows M1–M55 contiguous; allocation 5+3+5+5+21+3+4+8+1 = 55; M55
  is P4 and follows TC-SCAN-003.
- Scope arithmetic: 168 file entries / 121 unique paths / 1 folder; every file in the test
  plan's §7.3 (13 new suites, 11 new fixture modules, extended files) is declared by the
  phase that introduces it; `evidence.ts` is declared by P1–P8; verify-only suites are
  declared nowhere.
- Content-arm achievability: all path/env seed occurrences in scanned corpora are covered
  by the plan's site set (5 packages files, 7 scripts files, the two registries'
  self-declarations, `SCOPE_ORG` neutral site, both manifest neutral sites), and the five
  restated registered pages are exactly the ones that carry the remaining occurrences.
- Tree arm: `namespace-tree.ts` reads its prefix set from the shim registry and the
  forbidden-literal registry, reports it, and has the two synthetic controls; `.delivery-os/
  config.yaml` is the only tracked prior path today and P1 deletes it.
- Phase-gate self-sufficiency: P2 authors its changeset and fixture before its gate; P3
  consumes P2's registry and can be green only with the restatements it owns; P4 authors the
  tree arm and its CI binding; P5 owns the whole migration battery including suppression;
  P6 retires one identity and one documented flag form together; P7 lands the proof
  boundary after P5's `migration-*` rows; P8 adds the fifth golden line in the same commit
  as the reason; P9 adds the glossary's two sites in the same commit as the rows; P10
  verifies the changeset and never re-authors it.
- TDR/index: TDR-0074 tracked, `Proposed`, index row present, `doc/decisions` clean.
- DoD: ten items each with an observation instrument; DOD-1 ties to 31/31 with per-assertion
  attribution; DOD-3/5 keep the range gate and scratch proof in lifecycle phase 9; DOD-9's
  grep covers the two glossary rows, the opencode configuration path and the
  `projects.yaml`-as-committed claim.
- Decision capture: DEC-1…DEC-13 recorded change-locally; §15.1 states the ruling that
  DEC-3/DEC-6 need no additional record; TDR-0074 is the only new record; OQ-1/OQ-2 are
  resolved with owners and no criterion depends on them.
- System-spec consistency: every current-truth page that presents the prior namespace as
  current is in Appendix A and in P9's scope (`feature-branding-seam`, `feature-cli-entrypoint`,
  `feature-mcp-surface`, `feature-config-layer`, the three owner-hold pages, the glossary,
  `opencode-model-configuration`, `provider-conditions-and-parks`, `ceremony-runner`), and
  every page that names the retired identity or the `--migrate` refusal
  (`local-install`, `feature-install-lifecycle`, `feature-result-contract`, the M4 command
  and model pages) is in P6's scope.

---

## Facet Summary

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

## Verdict

**READY.** All ten facets pass; every iteration-2 blocking finding is resolved with
evidence in the artifacts and the delivered code; no new blocking finding exists; no
human decision is outstanding and no override record is needed. Delivery may start at the
`delivery` phase (P1), beginning with P1 obligation 1.0 (the local-exclude precondition)
and the gate on the committed phase head.

**Residual advisories the PR body should carry (non-blocking, none requires an artifact
edit before delivery):**

1. The command-audit suppression is the change's one declared exception; it must be
   evaluated in the runner from the invocation tokens (pre-parse) so the grammar-refusal
   arm also writes zero records (A8), and it is proven with the audit dependency composed
   and recording, not by removing the seam.
2. The shell site→shim assignment is per-shim, not per-file (A7): `install.sh`,
   `uninstall.sh` and `test-uninstall.sh` → `prior-working-name-override`;
   `dispatch-authority.sh` and its battery → `prior-config-directory`;
   the owner-hold hook and its battery → `prior-state-directory` +
   `prior-environment-prefix` + `prior-executable`.
3. `.gitignore` already carried `.*/projects.yaml` on the branch (`3f7f4d7b`); P1's
   pattern edit is a no-op and the fresh-clone evidence is a change-head property (A6).
4. The plan/pm-notes ledger arithmetic is 168 file entries / 121 unique paths / 1 folder;
   two historical lines still say 122 (A1).
5. `§7.7(b)`'s "complete by P7" predates P8's row appends; `TC-IDENTITY-006` is green at
   P7 and the aggregate re-validates the later rows (A2).
6. API-1/DM-7's "nothing is written … in a source root or a destination root" means "no
   record" — the backup and the moved entries are the run's intended writes (A5).
7. The declared-window semantics are a declaration, not an executed release: the five
   lockstep packages are private and `privatePackages.version: false`, so the
   `declaredIn`/`removalRelease` pair is a registry value derived from the change's
   changeset and its expiry is the later shim-removal change (Appendix C item 6).

Pause Required: no
