# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-365
Date: 2026-11-21
Pause Required: no

## Scope of the review

Read in full: `chg-GH-365-spec.md` v1.2, `chg-GH-365-test-plan.md` r0.2,
`chg-GH-365-plan.yaml`, `chg-GH-365-pm-notes.yaml`,
`doc/decisions/TDR-0074-project-groups-document-operator-local-overlay.md`, the
GitHub #365 body plus both owner comments (`gh issue view 365 --comments -R
juliusz-cwiakalski/agentic-delivery-os`), `doc/decisions/00-index.md`, and the
delivered code/registry surfaces the change relies on:
`packages/core/src/branding/index.ts`, `packages/core/src/contracts/{config,install,error-table,audit}.ts`,
`packages/core/src/state/audit.ts`, `packages/core/src/domain/{install-migration,install-path-block}.ts`,
`packages/adapters/src/{legacy,file/decision-register}.ts`,
`packages/cli/src/{edge,entrypoint,production}.ts`, `packages/cli/src/commands/install.ts`,
`packages/mcp/src/serve.ts`, `scripts/checks/{forbidden-literals.ts,forbidden-literals.registry.json,ignore-rules.ts,ci-topology.ts}`,
`tests/checks/{identity-docs,ci-checks,decision-record,install-lifecycle-docs}.test.ts`,
`.gitignore`, `.git/info/exclude`, and the live tracked tree (grep counts for
`.delivery-os`, `DELIVERY_OS_`, and the bare `delivery-os` token over
`packages/**`, `.opencode/**`, `scripts/**`, `tools/**`, `doc/**`, root
manifests).

Mechanical checks performed rather than assumed: `jaiship plan validate GH-365`
(verdict `valid`, `readyForDevelopment: true`, ten phases); plan path arithmetic
(**161 file entries / 121 unique file paths / 1 folder entry**, matching the
pm-notes claim); AC ownership (3+1+3+5+8+1+4+5+1+0 = **31**, single-owner);
TC ownership (4+1+3+4+11+2+5+5+1+0 = **36**, single-owner); mutation allocation
(5+3+5+4+21+3+4+8+1 = **54**, M1–M54 once each); AC→case links (**37**, 31 rows,
34 AC-linked + 2 NFR-only cases, 36 index rows = 36 detail sections); decisions
index (76 linked records, all on disk and all tracked; TDR-0074 tracked with its
row, `git status --porcelain -- doc/decisions` empty).

Facet verdicts are derived from the findings below; the PASS facets are
evidence-backed and are recorded in "Verified correct" so remediation does not
churn them.

## Facet Summary

- spec_completeness: FAIL
- ac_quality: FAIL
- plan_coverage: FAIL
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: FAIL
- system_spec_consistency: PASS
- plan_doc_update_coverage: FAIL
- plan_code_area_coverage: FAIL
- dod_defined: PASS

---

# Findings by owning artifact

## A. `specification` (remediation target: `specification`)

**S1 — [critical] cross_artifact_consistency / plan_coverage — `chg-GH-365-spec.md` DM-4 (line 263), §5.1 F-5 (line 146), Appendix F (lines 735, 753)**
Gap: The content arm cannot be green over a clean tree with the declared seed
classes, exclusions, `neutralSites[]`, and shim sites. Verified live occurrences
that are neither a declared shim site, a declared corpus, nor a neutral site:
`packages/core/src/branding/index.ts:63` (`const SCOPE_ORG = "delivery-os";` —
`prior-executable` seed under `packageTree`, matched because it is neither
`@`-preceded nor inside `agentic-delivery-os`), `doc/guides/opencode-model-configuration.md:239`
(`.delivery-os/config.yaml` presented as current, `prior-config-directory` seed
under `userFacingDocs`), and `doc/overview/glossary.md:221`
(`DELIVERY_OS_WORKING_NAME` as "the override") and `:575` (`.delivery-os/config.yaml`
presented as current). DM-4 declares `neutralSites[]` as only "the private root
manifest name, and `pnpm-lock.yaml` as generated", so `SCOPE_ORG` has no home;
the only alternatives are to add a neutral site (not declared) or to extend the
exclusions (not declared), and both are reviewed registry changes that this
change's own constraint 5 forbids doing silently.
Second horn: the delivered scanner filters the **DEC-8 path allowlist** before
matching any seed (`scripts/checks/forbidden-literals.ts`, `scanFile` →
`isPathAllowed`). If the extended scanner keeps that structure, `packages/core/src/branding/`
and `packages/adapters/src/legacy/` are silently exempt from the whole
`priorNamespace` class — exactly the discretionary hole `RSK-4` and §22 say the
design excludes. The spec does not state which behaviour the new class has.
Suggested fix: (i) add `packages/core/src/branding/index.ts` (the scope-org
constant) to `neutralSites[]` with its reason, or state explicitly that the
`prior-executable` seed's neutral domain is the scope-org constant and how it is
recognised structurally; (ii) state whether the DEC-8 path allowlist applies to
the `priorNamespace` class (recommended: it must not, and `neutralSites`/
`shimRegistry` are the only authorities for the new class); (iii) add the two
`userFacingDocs` files to the surfaces the scan-first restatement must cover, or
declare them as reviewed sites with role sentences; (iv) add `focus` for the
`SCOPE_ORG` case to `AC-F5-2`'s neutral-scope criterion.

**S2 — [critical] cross_artifact_consistency — `chg-GH-365-spec.md` API-1 (line 244), AC-F3-3 (line 491), DM-8 (line 267), §10 (line 318)**
Gap: API-1 asserts two mutually exclusive facts for the same invocation: "**Zero
state records are appended**, zero install-record fields are written, **and the
delivered audit ledger records the invocation**". The delivered audit ledger is a
state-store record pair, not a separate sink:
`packages/cli/src/edge.ts:1696-1714` composes `createCliAudit(...)` over
`stateDirectoryFor(...)`, and `packages/core/src/state/audit.ts:440-495` appends an
`audit.reservation` **and** an `audit.invocation` record into that store on
`record(...)`. So a real `install migrate` either appends two store records
(falsifying API-1, AC-F3-3 and TC-MIGRATE-004 step 7) or suppresses the audit
write (falsifying §10's "records the invocation as it records any command").
Worse, `stateDirectoryFor` (edge.ts:1663-1688) resolves through
`resolveProjectScope`/`resolveHostStateRoot`, which implement the prior-default
fallback: on an **unmigrated** host the migration's own audit write lands in the
prior state root, i.e. a prior-root write that F-2, constraint 4 and §8.5 ("nothing
written to a prior root") forbid, and it creates a new file inside the source root
that the plan already enumerated (breaking DM-6's retirement rule and AC-F3-3's
"every emptied source root is retired"). The delivered daemon guard does not
cover a foreground store write.
Suggested fix: decide and state where the migration's invocation record lands
(for example: the migration writes its audit record to the **destination** state
root, and the run declares `state-record writes: 2 (audit only)` instead of
zero), or that the migration invocation is the one declared exception that
bypasses the audit seam and why; replace "0 state records appended" in API-1 and
AC-F3-3 with the exact, assertable statement; add the ordering rule (audit write
before the move, at the destination) and declare the consequence if the audit
write is the only write the command makes.

**S3 — [major] ac_quality / cross_artifact_consistency — `chg-GH-365-spec.md` API-2 (line 245), DM-6 (line 265), AC-F3-5 (line 493), DEC-4 (line 386)**
Gap: `API-2` closes the disposition vocabulary at six
(`moved`, `already-migrated`, `duplicate-identical`, `conflict`, `blocked`,
`absent`). DM-6 row 5 ("source present, destination present and differing, entry
in the declared derived set → destination wins, reported, no conflict") assigns
**no disposition** from that set, and AC-F3-5 only says "is destination-wins and
reported". The spec also never states the per-entry→run verdict composition rule
(it says only "per-entry verdicts compose to a per-root and a run verdict"). The
test plan consequently has to invent both (§B1).
Suggested fix: name the derived row's disposition from the closed six (most
naturally `already-migrated`, with a reported derived reason on the entry), and
state the composition rule (for example: the run verdict is the maximum severity
over dispositions, with `duplicate-identical` a retained success).

**S4 — [major] cross_artifact_consistency — `chg-GH-365-spec.md` API-2 (line 245) and DM-5 (line 264)**
Gap: One schema id, `install.migration.v1`, is declared for two structurally
different documents with different required fields: the CLI machine payload
(`schemaId, runId, verdict, daemon, backupPath, roots[]{label,source,destination,verdict,entries[]{relativePath,disposition,files,bytes}}, conflicts[], residuals[], retiredRoots[]`)
and the backup manifest (`schemaId, runId, createdAt, artifactIdentity, roots[]{label,source,destination}, entries[]{rootLabel,relativePath,files,bytes,files[]{relativePath,size,sha256}}, verdict`).
A validator (or any later consumer) keyed on the schema id cannot accept both,
and the change asserts both in the same battery.
Suggested fix: give the manifest its own id (for example
`install.migration.manifest.v1`, consistent with `install.record.v1` /
`install.status.v1`) and keep `install.migration.v1` for the command payload; or
make the manifest a nested member of the payload document. Update DM-5, API-2 and
Appendix F accordingly.

**S5 — [major] spec_completeness — `chg-GH-365-spec.md` §22 (line 577)**
Gap: §22 asserts a security property — the migration "never follows a symlink
into a prior root as a destination" — with no acceptance criterion, no DM-6 row,
no disposition/verdict, no error identity, and no case. This is not hypothetical:
the owner's own checkout currently carries exactly the untracked
`.jaiship -> .delivery-os` symlink (ticket comment 2026-11-19), so the project
root's **destination** in `<git root>/.jaiship` can be a symlink into the source
root on the first real run. The tree arm only rejects a *tracked* symlink
(AC-F5-4), which says nothing about the local, untracked shape the migration would
meet.
Suggested fix: add an AC (given the destination root resolves through a symlink
into a prior-namespace root, the run refuses with a named delivered identity at
exit 1, writes nothing, and moves nothing), add the refusal to DM-6/DM-8, and add
it to AC-F3-1's refusal battery.

**S6 — [major] spec_completeness — `chg-GH-365-spec.md` §8.5 (lines 280-296), §25.1 Appendix A (line 629), §25.3 Appendix C (lines 691-700)**
Gap: The migration moves `~/.delivery-os/bin/` to `~/.jaiship/bin/`, but the
operator's shell profile keeps the delivered managed PATH block
(`packages/core/src/domain/install-path-block.ts:56-60` renders
`export PATH="<installDirectory>:$PATH"`, markers derived from the binary name),
which names the **prior** install directory. `install.json` moves with the root
and records only `{file, marker}` (`packages/core/src/contracts/install.ts:104-108`),
so nothing detects the mismatch. Consequence after a "successful" migration: the
prior-root path stays in an operator file and `~/.jaiship/bin` is not on `PATH`.
This is neither in the deliberate-change table, nor in the declared consequences,
nor in the "not proven" list, nor in any AC or case.
Suggested fix: declare the consequence and choose one: (a) the migration
rewrites/repoints the recorded managed block (a profile write outside the three
roots — then it needs its own declared target set, `--dry-run` line and AC), or
(b) it verifies and reports the stale block read-only, with the operator
remediation in `doc/guides/local-install.md` and a named AC/case.

**S7 — [major] spec_completeness — `chg-GH-365-spec.md` §5.1 F-3 step 1 (line 131)**
Gap: "an invocation outside a work tree reports the project class `unscoped` and
migrates the two host classes" is declared behaviour with **no AC, no case, no
DM-6 row, and no home in either closed vocabulary** (API-2's verdicts and
dispositions contain no `unscoped` token; the root labels are fixed at three). The
plan never mentions the path. A contributor cannot implement or test it without
inventing a token and a verdict.
Suggested fix: either give the project class its declared representation (a root
whose `source`/`destination` are absent with a declared verdict from the closed
five, plus an AC and a case), or move the behaviour to §7.2/out-of-scope with the
reason.

**S8 — [major] plan_doc_update_coverage — `chg-GH-365-spec.md` §25.1 Appendix A glossary row (line 641), DOD-9 (line 542)**
Gap: Appendix A's only glossary obligation is "Add the glossary rows from section
24". The page also carries two prior-namespace statements that this change makes
false: the `Entrypoint` row (line 221) names `DELIVERY_OS_WORKING_NAME` as "the
override", and the `Reference declaration` row (line 575) names "`.delivery-os/config.yaml`"
as this repository's current configuration. DOD-9's stale-statement grep requires
zero hits for a prior config path presented as current, so the page as scoped
cannot pass its own DoD. This is the same gap as S1(iii) on the documentation side.
Suggested fix: extend the glossary row's required reconciliation to name both
rows explicitly (the override channel row and the `.jaiship/config.yaml`
reference-declaration row).

**S9 — [major] decision_capture — `chg-GH-365-spec.md` §15.1 (line 401)**
Gap: The decision log leaves the record question open at the gate: "If PM or the
reviewer judges DEC-3 or DEC-6 precedent-setting, a TDR is authored **before
delivery planning**." Delivery planning is complete and neither pm-notes nor the
spec records that ruling. DEC-3 changes a delivered CLI surface (new verb, retired
flag form, "one operation one contract"); DEC-6 makes a new machine-readable
registry the single authority for a namespace and makes a merge gate consume it —
both read as system-level precedent, not change-local dispositions.
Suggested fix: record the PM ruling now. Either author the TDR(s) before delivery
(`@decision-advisor` owns them) or record an explicit, reasoned "not
precedent-setting" ruling in pm-notes, with the basis (which delivered record
already anticipates the pattern).

**S10 — [minor] ac_quality — `chg-GH-365-spec.md` AC-F3-7 proof column (line 495)**
Gap: The proof names "structure: the accepted-format constant is unchanged **in
the diff**", which asserts a diff against a moving base and is barred by
`.ai/rules/testing-strategy.md`; the test plan already resolves it correctly
(TC-MIGRATE-009 step 7, a committed literal baseline). The spec should not
contradict the rule its own plan obeys.
Suggested fix: "compared against a committed literal baseline in the suite, not
against a branch".

**S11 — [minor] ac_quality — `chg-GH-365-spec.md` AC-F1-2 (line 472)**
Gap: AC-F1-2's every clause is already a clause of AC-F5-3 (zero tracked prior
paths, zero symlinks, committed layer present, runtime files ignored) or AC-F5-4/
AC-F5-5 (the two synthetic trees). It adds no independently failing property, so
the matrix needs three links on one AC and the DoD counts 31 criteria where 30 are
distinct.
Suggested fix: either delete AC-F1-2 and cite AC-F5-3/4/5 from F-1, or give it the
one distinguishing property it is really about (for example: the arm's output
names the committed layer and the *declared* prior-root prefix set is read from
the declaration, not hardcoded — with a mutation that fails only here).

**S12 — [minor] ac_quality — `chg-GH-365-spec.md` NFR-5 (line 306) and §4.1 (line 95)**
Gap: "0 live occurrences in the change head" cannot be true under this design: the
shell hook, the adapter comment, the install-migration declaration, the registry
itself and the three owner-hold pages all keep live occurrences as **declared
sites**, by design. The neighbouring NFR-6 states the real property ("100% of
matches inside a declared site, a declared corpus, or a neutral site; 0 matches
outside").
Suggested fix: restate the NFR-5 threshold as "0 **undeclared** occurrences".

**S13 — [minor] ac_quality — `chg-GH-365-spec.md` AC-F3-2 (line 490) vs NFR-2 (line 303)**
Gap: AC-F3-2 requires "one line per entry" without bound; NFR-2 bounds the plan at
≤ 60 lines and requires truncation with one counted `… N more` line, which
TC-MIGRATE-003 step 8 asserts. On a large machine the criterion's letter cannot
hold.
Suggested fix: qualify AC-F3-2 with NFR-2's bound and the truncation line.

**S14 — [minor] cross_artifact_consistency — `chg-GH-365-spec.md` DEC-9 (line 391), §8.5 row 8 (line 289), RSK-9 (line 333)**
Gap: DEC-9's rationale — "Mapping a name that is not a key can never succeed" — is
false once this change lands: `<environmentPrefix>WORKING_NAME` becomes the
override channel and is read, but it is not a configuration catalog key, so the
bounded rule refuses to map `ADOS_WORKING_NAME` onto a channel that would now
work. Either the override channel is a declared exception to the catalog-key
bound, or the pre-freeze override has no successor — and §8.5 has no row for it.
Suggested fix: state the rule for the override channel explicitly (map it as a
declared exception, or declare that the pre-freeze override is not carried
forward, with the reason), and correct DEC-9's rationale sentence.

**S15 — [nit] spec_completeness — `chg-GH-365-spec.md` §5.1 F-5 tree-arm bullet (line 147)**
Gap: F-5 lists the tree arm's checks as tracked-prior-path, tracked-symlink,
committed-layer presence and the ignore probes; AC-F5-3 and TC-SCAN-003 add a
fifth — a tracked `.jaiship/projects.yaml` fails by name. The capability summary
should not be narrower than the criterion it justifies.
Suggested fix: add the explicit-tracking check to F-5's bullet.

**S16 — [nit] cross_artifact_consistency — `chg-GH-365-spec.md` §2.1 (line 55), §5.1 (line 146), DM-4 (line 263), §16 (line 424), §22 (line 581)**
Gap: The spec uses bare "DEC-8" for the delivered naming-firewall decision of
ADR-0003 while also defining its own **DEC-8** (the override channel). A reader
resolving "the DEC-8 seeds" against §15 lands on the wrong decision.
Suggested fix: qualify every reference as `ADR-0003 DEC-8`.

**S17 — [nit] cross_artifact_consistency — `chg-GH-365-spec.md` DM-6 retirement rule (line 265)**
Gap: "A source root whose entries are all `absent`/`already-migrated` after the
run is removed and reported as retired" also matches a root that never existed
(the idempotent second run), so a second run could be required to "remove and
report" a nonexistent root. TC-MIGRATE-005 does not say which.
Suggested fix: "a source root that existed at plan time and whose entries are all
`absent`/`already-migrated` after the run".

---

## B. `test_planning` (remediation target: `test_planning`)

**B1 — [major] cross_artifact_consistency — `chg-GH-365-test-plan.md` TC-MIGRATE-007 step 2 (line 886), M21 (line 1651), §8.2 A5 (line 1826); contradicting TC-MIGRATE-006 step 8 (line 857)**
Gap: TC-MIGRATE-007 asserts "the derived entry's disposition is `destination-wins`"
and M21's expected family says "derived entry expected destination-wins", but
`destination-wins` is **not** in API-2's closed six, and the same plan's
TC-MIGRATE-006 step 8 asserts "every disposition is drawn from the closed six".
The same case then fills the spec's missing composition rule with assumption A5
("the verdict is the maximum severity over dispositions"). Two cases in one plan
cannot both pass, and the implementation would have to guess which token the
assistant/verdict vocabulary accepts.
Suggested fix: once S3 names the derived row's disposition and the composition
rule, restate TC-MIGRATE-007 step 2, the Expected Outcome, M21's failure family and
A5 against the spec's closed vocabulary; keep A5 only if the spec adopts it.

**B2 — [major] cross_artifact_consistency — `chg-GH-365-test-plan.md` TC-MIGRATE-004 step 7 (line 788) and TC-MIGRATE-010 step 6 (line 992)**
Gap: `TC-MIGRATE-004` step 7 asserts "0 state records were appended" and
TC-MIGRATE-010 step 6 asserts "the run appends no record kinds and changes no
schema", but the delivered audit seam writes two store records per command into
the selected state root (S2). As written the case fails on any real composition,
and on an unmigrated world it would also observe a write into the prior state
root.
Suggested fix: after S2 is decided, assert the exact record set (for example
"exactly two audit records, kind `audit.invocation`/`audit.reservation`, written
at the destination root, and zero delivery records"), and make the prior-root
zero-write assertion explicit for the audit store too.

**B3 — [minor] plan_coverage — `chg-GH-365-test-plan.md` TC-ROOT-004 Target Layer line (line 1209)**
Gap: The case names `tests/behaviour/projects-config.test.ts` and
`tests/behaviour/ceremony-mirror-composition.test.ts` as "extended", while the spec
(§16, DEC-12) says the composition/read path is unchanged and comment-only
(`decision-register.ts`), and the plan declares neither path for P7. Either the
target line overstates the work or the plan under-declares it; the phase gate
cannot be audited until one is true.
Suggested fix: keep the delivery-behaviour assertions that are already delivered
in `projects-groups-list.test.ts`/`config-cli.test.ts` and drop the two
"(extended)" claims, or declare both paths in P7 (and then reconcile with DEC-12's
"no composition change").

**B4 — [nit] test_traceability — `chg-GH-365-test-plan.md` TC-MIGRATE-001 step 1 (line 676) and TC-MIGRATE-002 step 2 (line 713)**
Gap: `--stop-daemon` combined with `--dry-run` is an accepted flag combination
(API-1), and the dry-run discipline says a dry run never evaluates the guard and
never stops anything, but no row exercises `install migrate --dry-run
--stop-daemon` against a live daemon.
Suggested fix: add one row asserting 0 daemon-port calls and `daemon: unchecked`
for that combination.

**B5 — [nit] plan_coverage — `chg-GH-365-test-plan.md` TC-MIGRATE-012 Target Layer line (line 1077) and step 4 (line 1090)**
Gap: The case lists `scripts/checks/help-guide-coverage.ts` among its target
locations, which reads as "edited", while the plan (correctly, per its
scope-declaration rule) treats it as re-run only. A reviewer cannot tell whether a
change to that file is authorised.
Suggested fix: mark it "verify only (not edited)" in the Target Layer line, as the
plan does for other re-run-only files.

---

## C. `delivery_planning` (remediation target: `delivery_planning`)

**C1 — [critical] plan_coverage — `chg-GH-365-plan.yaml` P3 obligations 3.1 (lines 740-745) and 3.6 (lines 780-789), gate d1 (line 833)**
Gap: P3's gate requires "zero violations over the real tree" while the phase
restates identifiers on exactly five pages plus the prompt pair. Verified
additional scanned surfaces are therefore left red: `doc/guides/opencode-model-configuration.md:239`,
`doc/overview/glossary.md:221` and `:575`, and the `SCOPE_ORG` literal in
`packages/core/src/branding/index.ts:63` (see S1). P3 also cannot be green unless
`packages/core/src/branding/index.ts` is a declared neutral site — P3's own
`neutralSites[]` obligation lists only the root manifest name and the generated
lockfile.
Suggested fix: extend P3's alignment scope (and `scope.files`) to the two
additional pages, or declare them as reviewed `priorEnvironmentPrefix`/
`priorWorkingNameOverride` sites with role sentences; add the `SCOPE_ORG` neutral
site to the registry in P3; re-derive the alignment set from a mechanical grep of
the seven classes so the set cannot be under-enumerated again.

**C2 — [major] plan_coverage — `chg-GH-365-plan.yaml` P2 obligation 2.2 (line 638) vs P10 scope (`.changeset/gh-365-jaiship-namespace-migration-minor.md`); `chg-GH-365-test-plan.md` TC-SHIM-001 precondition (line 413); spec Appendix D (line 704)**
Gap: The registry's two delivery-os window values are declared to be "derived from
the change's changeset" and TC-SHIM-001's precondition says "the change's changeset
exists, so the two delivery-os window values are derivable" — but this plan has no
phase before P10 that authors a changeset, and P10 authors the only one. P2 (and
TC-SHIM-004 at P5, which renders the alias's deprecation sentence naming the
removal release) therefore cannot be green in isolation, and a window authored
before the changeset exists risks a removal release that no changeset delivers.
Suggested fix: move the single minor changeset into P2 (or earlier), or state that
P2 fixes the window by an explicit version pair and that P10's changeset must
match it (and which phase re-asserts the equality).

**C3 — [major] plan_coverage — `chg-GH-365-plan.yaml` P2 obligation 2.3 (lines 646-656) vs P8 scope (`tests/fixtures/namespace/pre-freeze-env.ts`)**
Gap: The shim registry is authored in P2 and its validator fails on "a site absent
from the tree" (spec DM-3 line 262). Appendix F (line 735) and DM-3 make the
"prior-environment fixtures (the entrypoint prior-identity harness **and the
eight-variable pre-freeze fixture**)" declared sites of `prior-environment-prefix`.
The eight-variable fixture does not exist until P8, and no phase re-declares the
registry. P2's own gate therefore fails on a declared site that the plan creates
five phases later.
Suggested fix: either author `tests/fixtures/namespace/pre-freeze-env.ts` early
(P1/P2) so the site exists, or drop the unscanned `tests/**` fixtures from the
declared site set (they can never be matched by any scope class) and say so in
DM-3, or declare the registry edit in P8.

**C4 — [major] plan_doc_update_coverage — `chg-GH-365-plan.yaml` P9 obligation 9.1 (lines 1594-1601); spec Appendix A `local-install.md` row (line 629) and DEC-13 (line 395); pm-notes line 72**
Gap: The guide must "carry DEC-13's operator remediation for the shell fallback
after a migration", and pm-notes records that remediation as setting the fallback's
override `ADOS_DISPATCH_STATE_ROOT`. `doc/guides/**` is inside the DEC-8
`userFacingDocs` scope, `ADOS_` is a delivered seed literal, and the DEC-8 allowlist
is frozen by this change's own constraint 5 and by the delivered exact-shape
validation (`EXPECTED_ALLOWLIST_IDS`). Written literally, the remediation fails the
content arm in P9; written without the variable name it is unactionable for the
operator. The plan does not decide which.
Suggested fix: state the expression the guide must use (for example: name the
variable in prose with a declared site — which requires widening the DEC-8
allowlist and therefore an explicit, reviewed decision — or instruct the operator
to read the override name from the script's own header, naming the script and not
the literal). Whichever is chosen, say it in P9's obligation so a contributor does
not "fix" the gate by widening the allowlist.

**C5 — [major] plan_coverage — `chg-GH-365-plan.yaml` P2 obligation 2.3 (lines 646-656)**
Gap: The site enumeration lists `packages/**` surfaces, the two bins, both registry
documents and the shell surfaces — and **no document page**, although three
current-truth pages stay permanent declared sites of `prior-environment-prefix` by
Appendix F (`doc/spec/features/feature-autonomous-delivery.md`,
`doc/guides/delivery-modes.md`, `doc/quality/test-specs/test-spec-autonomous-delivery.md`),
and they all carry live `DELIVERY_OS_` occurrences today (verified). Their
occurrences are legitimate and must stay declared; omitting them from P2's
enumeration means either P2's registry is untruthful or P3's reconciliation fails
on them.
Suggested fix: add those three pages (and any other surviving site) to P2's site
enumeration with role sentences and budgets, and cross-check the list against
`git grep -n` over the seven classes before P2's gate.

**C6 — [minor] plan_code_area_coverage — `chg-GH-365-plan.yaml` P7 `scope.files` (lines 1415-1427)**
Gap: P7 owns AC-F2-4 (and TC-ROOT-004), whose own Target Layer names
`tests/behaviour/projects-config.test.ts` and `tests/behaviour/ceremony-mirror-composition.test.ts`
(and step 7 asserts the ceremony mirror's composed target set). Neither path is
declared by any phase, so the blast radius of the group-document/mirror proof is
not explicit and the commit primitive would refuse the edit.
Suggested fix: decide B3 and make the plan and the case agree; if the assertions
land in those two files, declare them in P7.

**C7 — [minor] plan_code_area_coverage — `chg-GH-365-plan.yaml` P8 (lines 1455-1490)**
Gap: The bounded mapping (the owner's D1 defect) reads "the declared catalog key
set", whose authority is `PRODUCTION_CATALOG` in
`packages/core/src/config/catalog.ts`, and the adapter imports no workspace
package (`packages/adapters/src/legacy/index.ts` header). P8 declares
`packages/core/src/contracts/config.ts` (for the `override-read` reason) and no
module for the key-set derivation, so if the derivation lands beside the catalog
the phase cannot commit it.
Suggested fix: name the module that exposes the declared key set and declare it in
P8 (catalog.ts, or an explicit contracts-level selector), so the D1 fix's blast
radius is computable.

**C8 — [minor] plan_coverage — `chg-GH-365-plan.yaml` header SCAN-FIRST block (line 135) and P3 title/obligation 3.6**
Gap: The header says "**Six** registered documents still [present] a prior path or
prefix as current" and then enumerates five; P3's obligation 3.6 enumerates the
same five. The arithmetic error is also substantive: the real set is larger (S1,
C1), so a reader who trusts the count under-scopes the phase.
Suggested fix: after C1, state the set mechanically (the grep that produced it) and
make the count match the enumeration.

**C9 — [minor] plan_coverage — `chg-GH-365-plan.yaml` P1 gate (line 570) and `chg-GH-365-test-plan.md` TC-LAYER-003 step 1 (line 352)**
Gap: The fresh-clone drill clones **HEAD**, and the plan states no ordering between
the P1 gate and the P1 commit (the gate is listed in the phase's gate block; the
commit convention says only "one commit per plan phase"). If the gate is executed
pre-commit, the clone has neither `.jaiship/config.yaml` nor the added ignore
pattern, and d3 fails for a reason unrelated to the change; if post-commit, the
expectation should say so. The drill's own precondition ("the workspace tree is
clean") implies the post-commit reading, but the plan does not state it.
Suggested fix: state explicitly that the P1 gate is executed (or re-executed) on
the committed phase head, and that a pre-commit dry read of the drill is not gate
evidence.

---

## Verified correct (do not churn these)

- Plan schema and verdict: `jaiship plan validate GH-365` → `verdict: valid`,
  `readyForDevelopment: true`, `tier: full`, ten delivery phases.
- Path arithmetic: 161 declared **file** entries over 121 unique files + 1 folder
  entry; 27 shared paths are declared by every phase that touches them, as the
  scope rule states.
- Ownership arithmetic: 31/31 ACs single-owned (per-feature 4/4/8/4/6/5), 36/36
  TCs single-owned, 0 orphans, 0 double-owned; the two cross-phase ACs (AC-F3-1,
  AC-F1-2) follow their last observation and are stated as ruled, not split.
- Test plan arithmetic: 31 matrix rows, 37 AC→case links, 6 extras, 34 AC-linked +
  2 NFR-only cases, 36 index rows = 36 detail sections; 54 mutations M1–M54
  contiguous with the plan's 5+3+5+4+21+3+4+8+1 allocation.
- Fixture inventory: 21 reused (7 extended) + 11 authored = 32, as claimed.
- TDR-0074: tracked; `doc/decisions/00-index.md` row present and tracked; all 76
  linked records exist and are tracked; no row points at an untracked record.
- Baseline claims re-verified against the tree: eleven `install.*` identities;
  `PROMPT_REQUIRED_COMMANDS` = 28 with `install` 26th and `provider` last; seven
  configuration layers; twelve `BrandIdentity` fields; `SCOPE_ORG = "delivery-os"`
  and root `package.json` `"name": "delivery-os"` (both declared neutral); five
  `packages/**` files, one `.opencode` file, seven `scripts/**` files and thirteen
  `doc/**` files carrying prior-namespace literals; `.gitignore` `.*/config.local.yaml`
  brand-free; `.git/info/exclude` locally hiding both roots; the four delivered
  notice reasons and the renderer naming both locations; four ignore-rule coverage
  classes; `TS_JOBS` pinned in `tests/checks/ci-checks.test.ts`; the baseline-fetch
  obligation present in `scripts/checks/ci-topology.ts`.
- Owner traceability: the 2026-11-19 clause set (non-empty
  `git ls-files .jaiship/config.yaml`, no tracked prior-root path, clean fresh
  clone, fallback reporting the current path, the symlink/file negative control,
  the declared one-release window) and the 2026-11-21 D1/D2 clause set (eight
  pre-freeze variables, inert `ADOS_FOO=bar`, one authoritative root, bounded
  one-time notice, no notice on a migrated host, declared git-ignored local
  overlays) each map AC → case → phase as claimed.
- `system_spec_consistency`: the spec's current-state snapshot matches the tree on
  every fact checked, including `feature-ceremony-runner.md` §9's "invoking
  repository … project-committed `projects.yaml` members" (so DEC-12's
  comment-only disposition is right) and `feature-project-groups.md`'s
  "project-committed" claim.
- `dod_defined`: ten DoD items, each with an observation instrument; DOD-1 ties to
  the verified 31/31 matrix; DOD-2/DOD-3/DOD-5 correctly keep the aggregate, the
  range gate and the scratch-machine proof out of the permanent suites.

---

## Verdict

NOT_READY

| Facet | Status |
|---|---|
| spec_completeness | FAIL |
| ac_quality | FAIL |
| plan_coverage | FAIL |
| test_traceability | PASS |
| cross_artifact_consistency | FAIL |
| decision_capture | FAIL |
| system_spec_consistency | PASS |
| plan_doc_update_coverage | FAIL |
| plan_code_area_coverage | FAIL |
| dod_defined | PASS |

Blocking set (must be resolved before delivery): S1, S2, S3, S4, S5, S6, S7, S8,
S9, C1, C2, C3, C4 (plus B1/B2, which follow S2/S3). The cheapest consolidated
remediation order is: `specification` fixes S1–S9 (one pass, touching DM-4/DM-6/
API-1/API-2/DM-5/AC-F3-* and Appendix A), then `test_planning` re-aligns B1–B3, then
`delivery_planning` re-scopes P2/P3/P7/P8/P9 and re-derives the scan-first set
(C1–C5), after which this gate is re-run as iteration 2.

Pause Required: no

No finding requires human/owner input: S9 needs a PM ruling that can be recorded in
this change's docs, and S5/S6/S14 need product-interpretation rulings the PM can
take. If the PM prefers the owner to decide whether the managed PATH block is
repointed by the migration (S6) or left as declared operator remediation, that one
question may be escalated — it is the only finding whose answer changes operator
behaviour beyond this repository.
