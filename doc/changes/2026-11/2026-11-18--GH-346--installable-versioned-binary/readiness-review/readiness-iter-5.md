# Readiness Review Iteration 5

Verdict: NOT_READY
Work Item: GH-346
Date: 2026-11-18
Pause Required: no

Reopen: **`test_planning`** and **`delivery_planning`** (finding 1). One optional-but-recommended clause in **`specification`** (finding 1's root cause; the artifacts already contain a defensible reading, but no sentence states it).

Artifacts reviewed as they stand on disk: spec **v1.5** (`f3cad5ab91fa3f677a0d1a51f33774e5`), test plan **v1.5** (`7ad47cb9095b557f5ed26727e3c09a2c`), plan **YAML read from the working tree including the uncommitted diff** (`f6dda3e340e2a8719a1989aeb7e37024`, 18:39Z), TDR-0036 / TDR-0038 / TDR-0040 on disk, ticket GH-346 read through `gh`. The plan file was rewritten twice by the PM while this gate ran (the diff grew from 64 to 243 lines and then further, all version-reference normalisation plus the declared-limit correction); the anchors below are against the snapshot above, and I re-checked that the finding's text is unchanged in the live file.

The iteration-4 minimum change set landed and all three findings are closed **on the merits**. The wrong-name limit is now one rule, stated in the same direction in every place the task named, with no statement requiring detection and none permitting a missing name. The ordinal correction is right in all eight places it had to reach, and the over-correction is forbidden by name in a guardrail. The entrypoint page's identity-literal claim is owned, scoped, phrase-pinned in both directions, and its falsehood window is declared.

One new defect remains, and it sits **inside the arm the iteration-5 rewrite created**: `TC-INST-042` arm (g) states two expectations that no legal implementation can produce, and places the carried claim in the wrong record field. It is one field name and one clause across two artifacts, but it is the only case that exercises the declared-limit proceed, and both readings of it (implement as written, or implement per F-8) fail. Hard gate: closed.

No `delivery` finding exists.

## Iteration-4 close-out

| # | Iter-4 finding | Status | Anchor | What remains |
|---|---|---|---|---|
| 1 | MINOR blocking — CLI entrypoint page's identity-literal claim unpinned and about to become false | **CLOSED** | Spec 427 (retired claims, entrypoint entry), 577 (§16 obligation row: both sentences, the scoped restatement, the phrase pair), 589 (the ungated-falsehood class now includes the entrypoint page), 591 (class rule), 660 (AC-F16-1 names both sites and the unqualified sentence), 449 (NFR-17: 0 unqualified occurrences, 0 pages lacking the scoped sentence at both sites); test plan 558 (`TC-INST-111` step 1), 559 (`TC-INST-112` steps 2, 3, 5 — both directions driven), 717 (§7.2 `doc-conformance` row); plan 297–312 (window declared), 2264–2276 and 2432–2445 (page + phrase table in phase 6's file list and comment). The window (phase 1 → phase 6) is stated with its reason and its gate status. | — |
| 2 | MINOR blocking — supervision page's "25th family" is an ordinal, and the declared edit would falsify it | **CLOSED** | Spec 583 (§16 row: only the two allowlist restatements move; the three ordinal references stay and "must **not** be rewritten to 26th"), 449 (NFR-17 scoped to the mounted-family **count**), 660 (AC-F16-1: ordinal stays as delivered, metrics page carries the count 26); test plan 558 step 7 (moves the two allowlist sites, **asserts** the ordinal present at 9/241/287), 559 steps 2, 3, 5 (ordinal is a required phrase, never stale; moving it to 26th fails), 685 (§7.2 pin row: the ordinal excluded from every stale regex, the suite title stays); plan 270–278, 1005–1013, 1059 (guardrail), 1419–1491 (the `25` split, stated twice), 1609–1622, 2373 (`26th` requirement refused by name). | — |
| 3 | MINOR — rollback's record precondition worded as a name-verification test | **CLOSED as a predicate** | Spec 185 (F-8: `previous` "checked for **presence** only", four **missing**-name causes, **Declared limit**), 187 (F-9), 377/378 (§8.1 rows), 404 (DM-2), 548 (DEC-13), 839 (C.4), 870 (Appendix E), 645 (AC-F8-2: the wrong name "is **not** an arm"); TDR-0040 §4 (368–373, incl. "the refusal is about a **missing** name, never a **wrong** one"); test plan 480 (arms (f1)/(f2) refuse on the destination leg, arm (g) proceeds), 459 (`TC-INST-026`'s partition, stated as a pair with one unknowable leg), 127, 773 (TR-11 restated as the live risk), 798 (OQ-TP-9 resolved); plan 86–99, 445, 508–517, 1059. | The **predicate** is closed. The **arm that exercises its proceed** is not: finding 1 below. |

## Adversarial re-derivation 1 — the declared limit, cell by cell

| Artifact / cell | Missing `previous` | Wrong `previous` | Rename detectable? |
|---|---|---|---|
| F-8 (185) | refuses (`install.record.unreadable`, four missing-name causes) | "taken at its word … remains a claim the operator can check against `install status`" | no — "no slot digest is stored"; `current` leg checked against the destination |
| F-9 (187) | refuses, ordered before the daemon stop | "cannot be detected without a stored slot digest and is taken at its word" | no |
| §8.1 (377, 378) | four causes listed as missing-name conditions | "taken at its word — it is not detected" | no |
| DEC-13 (548) | refuses unless `current` names the destination **and** a `previous` name is present | present ⇒ proceeds | no |
| Appendix E (870) | slot present + the four causes | "latter by **presence** only … never detected" | no |
| C.4 dry-run (839) | refusal in place of a plan | "presence only; a wrong name is taken at its word" | no |
| AC-F8-2 (645) | four arms refuse, zero writes | "**not** an arm … taken at its word" | no |
| TDR-0040 §4 (368–373) | four causes refuse | "declared limit … not a refusal" | no |
| `TC-INST-042` (f1) (480) | `previous` present (names P) — refuses on the **destination** leg | — | no |
| `TC-INST-042` (f2) (480) | `previous` present (names destroyed Q) — refuses on the **destination** leg | — | no |
| `TC-INST-042` (g) (480) | — | proceeds at exit 0, claim recorded, structural no-slot-digest assertion | asserted absent |
| `TC-INST-026` (459) | never reached; names the next gate and its one unknowable leg | same | no |
| Plan phase 3 (1769–1857) | four missing-name causes; `previous` "presence only by DECLARED LIMIT" | "PROCEEDS … the claimed `previous` name recorded VERBATIM" | asserted absent |
| Plan phase 3 (1911–1920) | — | "arm (g) PROCEEDS because its `previous` name is present and the slot leg is never knowable" | no |

**Result: consistent.** No cell requires detecting a wrong name; no cell permits a missing one; every cell that mentions the slot leg names it as unknowable. The (f1)/(f2) refusals are correctly attributed to the destination leg, so they no longer pass on a missing-name reading — that was the point of the split, and it holds. The one place the derivation breaks is the consequence of the proceed, not the predicate: what the proceeding run **writes and reports** (finding 1).

## Adversarial re-derivation 2 — the ordinal

`supervise` is the **twenty-fifth** family; `install` appends as the twenty-sixth. Only one value in the whole change set is a family **count** that moves: `feature-metrics.md`'s mounted count 25 → 26 (spec 582; plan 1450–1462; test plan 685). Every surface agrees:

- **Spec:** §16 supervision row (583) keeps the three ordinals and forbids "26th"; NFR-17 (449) scopes the prohibition to the count; AC-F16-1 (660) requires the ordinal to stay **and** the metrics page to carry 26; §8.5 (427) says the supervision page's "`supervise`-ordinal references are true as delivered and stay".
- **Test plan:** `TC-INST-111` step 7 (558) moves only the two `65-member` sites and asserts the ordinal still present at 9/241/287; `TC-INST-112` steps 2/3/5 (559) put the ordinal on the **required** side and out of every stale list, and fail a `26th` rewrite; §7.2 (685) excludes `twenty-fifth`/`25th` from the stale regex and keeps the delivered suite title.
- **Plan:** phase 2's page bullet (1466–1484) leaves the three statements verbatim and names the over-correction as the defect; the phase-2 grep rule (1419–1431) splits `25` into count/ordinal; guardrail (1059) makes an ordinal rewrite an escalation trigger; phase 6's supervision row (2373, 2471) requires the ordinal as a phrase.
- **Delivered code truth:** `tests/structure/supervision-mounting.test.ts:13`'s title ("supervise is the twenty-fifth prompt-required family") stays true, and the plan says it is not edited.

**Result: correct.** The over-correction is now a named failure, not a style preference.

## Adversarial re-derivation 3 — the entrypoint literal claim

| Requirement | Where | Both directions? |
|---|---|---|
| Page states the scoped claim at both sites (36 prose, 127 structural row) | spec §16 (577), AC-F16-1 (660), NFR-17 (449); plan 2432–2445 | required |
| Unqualified "exactly the declared five-site inventory" absent at both sites | same | stale, **two** sites named |
| Phrase table carries the pair | plan 2270–2276, test plan 717 | one failing mutant per direction (test plan 559 steps 4–5) |
| Page and phrase move as one commit | plan phase 6 file list (2428–2475) | yes |
| Falsehood window declared with its gate status and duration | spec 589, plan 297–312 | yes (phase 1 → phase 6) |

**Result: owned, scoped, phrase-pinned in both directions.** No delivered gate reads the two sentences today, which is why the window is declared rather than silent — that is the same disposition the branding page carries, and §16 and AC-F16-1 own the correction here rather than deferring it.

## Finding

1. **[MAJOR — blocking] `cross_artifact_consistency` — `TC-INST-042` arm (g) asserts an outcome no legal implementation can produce, and puts the carried claim in the wrong record field.**
   Gap: the arm is the change's only exercise of the declared-limit proceed, and two of its assertions are unsatisfiable under the rule the arm exists to prove.
   **(a) The claim is asserted in `previous`.** Step 7 requires "the record is rewritten … with its `previous` carrying **X verbatim**" (test plan 480; plan 1835). F-8 (185) defines the record a rollback writes: "the slot's occupant in `current`, the displaced destination in `previous`". In arm (g) the slot holds **P**, the destination holds **A**, and the pre-run record is `{current: A, previous: X}` — so the post-swap record must be `{current: X (the claim), previous: A}`, exactly the inversion `TC-INST-024` step 4 asserts for the ordinary case (`{current: A, previous: B}` after a rollback from `{current: B, previous: A}`). Writing X into `previous` claims the slot holds X, which it does not; and the arm's own next clause — `install status` "naming the slot identity from the record" — requires `previous` = A, so the step contradicts itself in one sentence.
   **(b) The run is required to report the occupant's real identity.** The arm requires "the destination then holds P's bytes and **reports P's identity** … both identities are reported" (test plan 480; plan 1833–1834). No process can know P's identity: an artifact's identity is a compile-time constant no process can read out of a file (F-2 173, §2.1 63, TDR-0037 §2), DM-2 stores no slot digest (404), and the arm's own structural assertion forbids "a slot-digest field" and "any comparison with the slot's occupant". The only destination identity a proceeding run can report is the **claim** X. As written the arm is satisfiable only by reading the slot's identity — the capability it declares absent two clauses later.
   Consequence: against a correct implementation the case fails at step 7; against an implementation written to satisfy it, the record's `previous` names an artifact that is not in the slot and `install status` reports a slot identity that is false — a false delivered report in exactly the class the limit exists to keep honest, and no gate can catch it (no slot digest). Root cause: the spec never states what a **proceeding** rollback writes and reports when the claim is wrong, so the arm was written from the observer's view (the test knows P) instead of the process's (the process knows only the claim).
   Evidence: test plan 480 (step 7 and the Expected row); plan 152, 594, 1032, 1832–1838, 1913, 1998 (the same assertion repeated as a gate signal: "the claimed `previous` name recorded verbatim"); spec 185 (F-8 field semantics), 187 (F-9), 404 (DM-2), 548 (DEC-13), 645 (AC-F8-2); test plan 459/`TC-INST-024` step 4 as the field-semantics control.
   Suggested remediation target phase: `specification` (one clause), `test_planning`, `delivery_planning`.
   Suggested fix: (1) spec: in F-8 (and echo in DEC-13) add one sentence — "in the declared-limit proceed the claimed `previous` name becomes the record's new `current` and the displaced destination becomes `previous`; the destination identity the run reports is that claim, never a read of the slot, and a later `install` reconciles the record by content agreement". (2) test plan: arm (g) step 7 asserts "`current` carries X verbatim, `previous` carries A (the displaced destination)"; the destination "reports the claim X as its identity", the slot is reported as A, and `install status` after the run reports `record-stale` against the true running identity P while the slot identity reads A from the record. Keep the structural assertions and the three discriminators untouched. (3) plan: correct the same clauses in phase 3 (1832–1838) and in the three gate-signal restatements (152, 594, 1032/1998) and the diff's preamble.

## Residual risks and debt (non-blocking)

| Residual | Why it does not block | Suggested home |
|---|---|---|
| `feature-cli-entrypoint.md:131–133` states steer/metrics/supervise as the twenty-third/-fourth/-fifth family. All three stay true, but no obligation, phrase pair or guardrail names them, while phase 6 edits that page to say "twenty-six families"; the over-correction guardrail (plan 1059) is scoped to the supervision page only. | The declared edit does not touch those rows, and the new install row makes the surrounding ordinals conspicuous; this is a coder hazard, not a false artifact claim. | phase 6 clause (nit): "the mount table's 23rd/24th/25th ordinals are true and are left verbatim", plus one assertion in `TC-INST-111` step 1. |
| TDR-0040 §4's two descriptive sentences still read as a name match ("needs the record's `previous` to name the artifact in the slot", 368; "names **both** artifacts the swap inverts", 455), and the iteration-4/5 restatement landed in place with no amendment heading or history, while spec §12/Appendix F call it an amendment. | §4's cause list and its "Declared limit, unchanged" bullet (373) state missing-vs-wrong unambiguously in the same section, and no case implements detection. | decision record (nit). |
| Spec §12 (486) still says "where it still carries the earlier wording … pending that amendment", and Appendix F (880) "until that amendment lands" — the amendment has landed. | Meta-wording only; record and spec agree on content. | `specification` (nit). |
| `feature-metrics.md:264` "The family-count pins read 24" has been false since GH-295, on a page this change edits and rewrites two of whose three count sites. | Pre-existing drift, not falsified by this change; the page obligation names only the present-tense count sites. | owner decision / optional phase-2 sweep. |
| The `149 entries` whole-form leftover scan can flag the title at `tests/structure/error-table.test.ts:2493` ("… 149 entries / 148 delivered / 65 allowlist …"), while the plan permits a title to keep a historical number. | Loud, inside a declared file; the coder must move the title. | `test_planning` (nit). |
| Plan phase 1's acceptance line maps `TC-BIN-067` to `AC-F2-3`, while §7.2 places that case in the phase-2 family-array move. | The case is declared and owned; only the acceptance parenthetical is loose. | `delivery_planning` (nit). |
| `chg-GH-346-pm-notes.yaml` records `clarify_scope.started 16:53:00Z` against `completed 16:09:23.758Z`. | Persistent since iteration 2; the registry is authoritative and all four artifact phases are complete; the mirror must not be hand-edited. | observation. |

## Facet Summary

- spec_completeness: **PASS** — all nine ticket tasks and six acceptance clauses trace (§17); the doc-set incompleteness reported in iterations 3–4 is closed.
- ac_quality: **PASS** — 34 ACs are independently testable; AC-F8-2 now states the declared limit and names the wrong-name case as not an arm; AC-F16-1 is enforceable by the declared page/case pair including the ordinal-stays clause.
- plan_coverage: **PASS** — 34/34 ACs and 84/84 cases have exactly one owning phase; phase file counts 20 + 67 + 28 + 22 + 7 + 10 = 154; `plan validate` returns `valid` / `readyForDevelopment=true`.
- test_traceability: **PASS** — §3.1 / §3.1.1 / §3.2 / §3.3 and §5.1 remain bidirectional; the only two extra ids are GH-320 references. (Arm (g) is traceable; its content is the finding.)
- cross_artifact_consistency: **FAIL** — finding 1: the record field and the reported identity in arm (g) contradict F-8/DM-2 and the arm's own status clause.
- decision_capture: **PASS** — OQ-TP-9/TR-11 resolved into TDR-0040 §4 and mirrored in spec §12/Appendix F; all five TDRs remain `Proposed` for PR acceptance. The missing amendment header is a nit.
- system_spec_consistency: **PASS** — every delivered page the change falsifies is owned, phased, and (for the ungated class) phrase-pinned; the count/ordinal split now matches the delivered pages.
- plan_doc_update_coverage: **PASS** — the twelve documentation paths of §16 split 5 (phase 2) + 7 (phase 6); the entrypoint page and its phrase table are one edit-set; the residual is the unowned *leave-alone* clause for three true ordinals (nit).
- plan_code_area_coverage: **PASS** — every code, suite, fixture, script and page is declared by its owning phase; the ten `DOMAIN_KINDS` tail offsets are now named (plan 1406–1411), closing an iteration-4 nit.
- dod_defined: **PASS** — AC-F16-1 plus §16's obligations, NFR-14/NFR-17 and the G0–G7 battery are testable and traceable.

## Verified, not findings

- **Plan artifacts are valid, from the working tree.** `delivery-os plan validate GH-346` → `verdict=valid`, `readyForDevelopment=true` (run with the uncommitted diff applied).
- **The uncommitted plan diff changes no verdict, and carries the one finding.** It updates the header to spec/test plan v1.5 and "TDR-0040 as amended at iterations 4 and 5", restates (j) as the presence-only predicate with arm (g) as a proceed, adds the declared-limit guardrail (1059), and rewrites phase 3's ordered set to the four missing-name causes. Its only defect is the same arm-(g) wording (152, 594, 1032, 1832–1838, 1998) — the pre-diff and post-diff text carry it identically, so the diff neither creates nor closes the finding.
- **The three iteration-4 repairs are real, not textual.** Walked cell by cell above: the limit table, the ordinal table, the entrypoint-claim table.
- **Arm (f1)/(f2) are non-vacuous.** Each refuses because `current` names P rather than the destination's artifact, with `previous` present (P and destroyed Q respectively), so neither refusal can be explained by a missing name — the discrimination the iteration-5 rewrite was meant to preserve, and it does.
- **`TC-INST-026` / `TC-INST-042` still partition the ordered set.** `TC-INST-026` owns the two slot arms and states the next gate and its one unknowable leg; `TC-INST-042` owns the four record causes, the declared-limit proceed and the empty-daemon-log arm.
- **The fixture set covers arm (g).** `tests/fixtures/install/records.ts` declares the present non-occupant record beside a destination holding A and a slot holding P, plus the (f1)/(f2) pair ("no fixture carries a slot digest, because the record schema has none") — so the arm is constructible in phase 3; only its expected outcome is wrong.
- **Counts and ids hold.** 12 `TC-BIN` + 72 `TC-INST` unique ids (84), two GH-320 references, 34 ACs; §3.4's integrity table matches.
- **The count-bearing page moves are named site by site.** Ceremony (three sites), metrics (three sites + the count), supervision (two allowlist sites + three ordinals kept) — matching the delivered lines at 241/285 (allowlist) and 9/241/287 (ordinal), and `feature-metrics.md:390` (count 25, `+115`).
- **The reservation around iteration 1's blockers still holds.** The Appendix B step-4 agreement stop, the step-5 skip, the `ownsInstallation` seam, the alias refusal's invoked identity / owning role / remedy, and the `runningArtifactPath` seam are unchanged and implementable.

## Minimum change set for READY

1. **`test_planning`** (blocking)
   - `TC-INST-042` arm (g) step 7: assert the claim lands in `current` (`current` = X verbatim, `previous` = A, the displaced destination); replace "reports P's identity" with "reports the claim X as the destination identity and A as the displaced slot" and keep the slot-identity-from-the-record clause consistent with `previous` = A; add the one-line consequence (`install status` afterwards reports `record-stale` against the true running identity while the slot identity reads A). Keep the structural assertions, the three discriminators, the run's zero-equality, and the case count at 84.
2. **`delivery_planning`** (blocking)
   - Phase 3's arm (g) paragraph (1832–1838) and the three gate-signal restatements (152, 594, 1032/1998): the same field/identity correction; the ordered set, the four causes, the daemon-log arm and the gate lines are otherwise unchanged.
3. **`specification`** (recommended, not required to reach READY)
   - One sentence in F-8 (echoed in DEC-13) stating what a **proceeding** rollback writes and reports in the declared-limit case, so the arm has a normative source to be checked against.

No `delivery` finding exists. The hard gate stays closed until finding 1 lands and this gate re-runs. The override route remains unavailable: this is a behavioural change with contract and documentation impact.

## Iteration note

This is iteration 5, past the nominal cap of ~3, called explicitly by the PM (recorded in `chg-GH-346-pm-notes.yaml`) on convergence evidence: blockers 2→0, MAJOR findings 3→2→0, and every iteration closed what the previous one raised. This iteration confirms that trend: three of three iteration-4 findings closed, no finding repeated, and one new defect whose blast radius is one record field and one reported value inside a single arm. It is not a stalemate, but it is also not a pass: the arm as written cannot go green on a correct implementation, and the wrong reading it invites writes a false record and a false status line with no gate behind them. One authoring pass over one case in two artifacts closes it; nothing else in the set needs to move.
