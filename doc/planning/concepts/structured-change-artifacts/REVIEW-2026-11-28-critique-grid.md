---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/REVIEW-2026-11-28-critique-grid.md
---
# Review: structured change artifacts, 2026-11-28

An independent critique of the concept pack in this folder, written for the owner's final read.
The review is read-only: nothing in the pack was changed. Sections 02 to 06, 08, 12 and 13 are
known to describe an earlier model and a rewrite is pending, so this review does not restate that
gap. Where a contradiction lies outside that note, or the note itself is inaccurate, it is reported.
`17-roadmap.md` gained ticket numbers #434 to #439 while this review was running, so the blocking
findings are live against tickets that already exist.

## 1. Verdict

**Not ready for the owner's final read, and not ready for #434 to start.** The direction is right,
the read-path evidence is the strongest material in the pack, and most of what follows is text to
fix rather than a reason to stop. But the authority chain does not say one thing, the light shape
removes a check the study observed, and five designs cannot be cut into tickets as written.

1. The artifact set is stated two ways: decision 8 keeps five facets, decisions 11 and 20 replace
   three with one contract, and the summary table carries both.
2. The decision file decides testing twice: decision 22 says no decision, decision 24 says accepted.
3. The testing design's two load-bearing controls, the criterion-to-proof join and the double run,
   are intent rather than mechanism, and the pack's own example joins a criterion to a test that
   does not prove it.
4. Three agents cannot do their jobs as their definitions stand: the reviewer is read-only yet must
   mutate, the pre-code reader has no ticket in its bundle, and the author is unnamed while the
   obvious candidate cannot write paths.
5. The integrity model assumes a tool-written record is trustworthy, but on one lane nothing makes
   it so: no caller identity, no command policy, a forgeable trailer, and a surface map the
   classified change can edit.

## 2. Findings

BLOCKING means fix before the owner's read or before any ticket is cut. SHOULD-FIX means fix in the
same revision. NIT is wording or a small gap. Each finding names who raised it; "coordinator" means
the cross-file consistency check rather than a specialist. Evidence is labelled OBSERVED (with a
locator), DERIVED (with the derivation), CLAIMED or ASSUMED.

**Blocking at a glance:** CG-01 artifact set, CG-02 testing decided twice, CG-03 entry documents,
CG-05 criterion-to-proof join, CG-06 run record and base leg, CG-08 the two readers, CG-09 author
and state graph, CG-10 the light shape, CG-12 roadmap dependencies, CG-13 telemetry reuse, CG-14
event store, CG-15 migration, CG-19 write transaction, CG-21 surface map, CG-22 record integrity,
CG-23 command policy.

### Area A: the pack's statements about itself

**CG-01 BLOCKING. The change folder is said to hold five artifacts and one; both are presented as
settled.** (`14` decision 8, summary table, decisions 11 and 20; `15` sections 5 and 9.) **Problem:**
decision 8 keeps five facets and the summary row repeats it, while decision 11 merges the test plan
and plan into the contract and decision 20 drops the separate prose file. Nothing retires the
five-facet set (OBSERVED, `14` lines 150, 515, 532; `15` lines 96, 270). **Why:** this decides the
schemas, the bundles, the migration and the ticket scopes; T2's one contract and the five schema
examples cannot both be current. **Change:** retire the five-facet set in decision 8, collapse the
two summary rows, align README and the handover.

**CG-02 BLOCKING. The decision file decides testing twice.** (`14` sections 22 and 24; summary lines
539, 543.) **Problem:** two sections share one title. 22 records the owner as undecided and the
decision as none yet; 24 records it as accepted, with the acceptance author. Neither names the other
as superseded (OBSERVED). **Why:** this file is declared authoritative and read first, so whoever
cuts T5 reaches either conclusion, and two records on one subject under one title break the
append-only convention. **Change:** mark 22 superseded by 24 inline, with what changed and when, and
collapse the rows.

**CG-03 BLOCKING. The entry documents mislead a resuming reader.** (`HANDOVER` "What is still
open"; `README` introduction, review order, settled list, file index; `14` part 5; `11` Tier row.)
**Problem:** the handover lists Q1, Q8, Q9, Q27, Q28 and Q30 as empty or partial and Q17, Q29, Q36
and Q40 as defaults, though all carry answers dated 2026-11-28; it omits Q31 to Q49, gives the slot
budget as 80 words where decision 23 settled 120, and predates the events it records. The README
promises six things and lists ten, skips the glossary, and puts the authority file `14` after `13`;
its settled list keeps the tiering principle and the budgets that decisions 13 and 16 replaced, and
its stale-file note omits `11`, `schemas/` and the handover (OBSERVED, `HANDOVER` lines 8, 62 to 70;
`README` lines 22 to 45, 98, 109, 128 against `09` lines 36, 197, 604, 670). **Why:** the README
tells anyone resuming, including the owner after a break, to read the handover first, and these are
the pack's only signposts. **Change:** regenerate the handover status from `09` and `14`, correct the
README and its review order, make the stale list exhaustive, and mark decision 9's tier table
superseded.

**CG-04 NIT. House style and boundary.** (`01`, `10` Method, `12` The idea, `14` decision 15, `09`
Q46, `HANDOVER` The live lane.) **Problem:** the pack writes of the product's parser and of the
product writing a worktree, and calls the owner's products private projects; the handover names an
operator-local overlay path, a coordinator decision from a non-public register and a provider billing
fact (OBSERVED). **Why:** the repository rule makes Jaiship the tool and a product the thing it
builds, and the operator material breaks the pack's own boundary rule and will be wrong within days.
**Change:** Jaiship or the tool for the binary, lane status only in the handover.

### Area B: testing in a change (section 16)

**CG-05 BLOCKING. The traceability join is green on a test that does not prove the criterion.**
(`16` sections 2, 5, 7; `schemas/spec.yaml` line 30; `schemas/test-plan.yaml` lines 99 to 120.)
Raised by QA-01. **Problem:** coverage is a criterion whose obligation resolves to a test that ran;
nothing binds the assertion to the criterion's stated outcome. In the pack's own example, AC-1's
second proving test asserts only that the prompt inventory lists the push step, and the lint is green
(OBSERVED, `16` line 119). **Why:** the removal check catches an empty test, not a partial one, and a
green-on-base test has no consequence, so every criterion can join a pre-existing green test while
T5's promise looks satisfied; the substitute, mutation, is left out of T5 and justified against
review rounds rather than against held-out scenarios. **Change:** name the observable and predicate in each obligation, run
the removal check per obligation, and allow a green-on-base obligation only with a recorded guard and
an added case.

**CG-06 BLOCKING. The run record cannot express what section 4 requires, and the base leg has no
tree, no provisioning and no merge consequence.** (`16` sections 3 and 4; `17` T5; `03` plan base.)
Raised by QA-02, QA-04 and QA-06, merged. **Problem:** base is undefined (merge-base, branch parent,
integration tip); a new test does not exist on the base tree and its imports do not resolve, which
section 3 makes a blocking ERROR, so the canonical feature red is unobtainable; who runs the base leg
is unstated; the record holds no failing assertion or fingerprint; STALE describes every base run;
WAIVED has no consequence and no expiry (DERIVED from `16` sections 3 and 4, `03` line 81). **Why:**
the escape hatch, recording a reason, exists on every repository and will be used where the base is
least healthy, silently removing the absence proof the proposal rests on. **Change:** define base as
the merge-base by digest, provision a base worktree, add `leg`, `redKind` and a fingerprint, define
staleness per leg and WAIVED as an audited event, and show an unattemptable base leg at merge.

**CG-07 SHOULD-FIX. The protected expectation is protected by a file-touch report; fixtures,
helpers, harness, config, CI and the oracle sit outside it.** (`16` sections 5 and 6.) **Problem:**
the reviewer learns only about files an obligation references, and only security and data changes get
an independently authored test; a shared fixture, a helper, the harness config, an exclusion glob,
the CI workflow, a snapshot or a weaker obligation written through the contract commands all stay
invisible (OBSERVED, `16` lines 61, 112). **Why:** one helper edit weakens every obligation using it
and appears in no report, and a weaker obligation is easy because the coder authoring the revision
satisfies the rule. **Change:** compute a watchlist per obligation from transitive imports, resolved
test config and the CI workflow; restrict oracle writes to the author role at the tool; add a
refactor rule.

### Area C: agents, prompts and the state machine

**CG-08 BLOCKING. The two readers cannot do their jobs, and one has lost its ground truth.** (`15`
sections 5 and 6; `05` readiness row; `reviewer.md`; `readiness-reviewer.md`.) Raised by PE-01 and
PE-02. **Problem:** the reviewer must run the oracle, read the diff, mutate and report typed findings,
but its definition is read-only for source, requires a clean tree, and may append a remediation phase
to the plan, which the one-writer rule forbids; the pre-code reader's bundle is contract, coverage,
plan summary and lint gaps, with the ticket and its non-goals absent (OBSERVED, `reviewer.md` lines
128, 483, 494; `05` line 40; `readiness-reviewer.md` line 62). **Why:** an agent facing an explicit
prohibition silently drops mutation, which `16` makes the substitute for held-out scenarios; without
the ticket the reader's findings concentrate in coverage and format, the categories the study found
largely tool-checkable, so the pack keeps an agent and loses its job. **Change:** make mutation a tool
command that copies the tree, applies a fault set and records the run; add the ticket and non-goals
to the reader's mandatory set with a ticket locator per finding.

**CG-09 BLOCKING. The contract author is unnamed, and no ticket owns the lifecycle state graph.**
(`15` section 5; `14` decisions 11 and 24; `17` T2; `12` states; `spec-writer.md`.) Raised by PE-03
and PE-07. **Problem:** the author has no name, inputs, bundle row or ceiling, and T2 lists two
retired writer agents while decision 24 keeps the test-plan-writer as the acceptance author; the
obvious candidate, the spec-writer, forbids file paths and code-level steps, which are the Work,
paths and verify sections. The state list still has specification, test_planning, delivery_planning
and dor_check, whose agents T2 retires, with no statement of what completing them means afterwards
(DERIVED from `14` lines 298 to 305, 447 to 450; `12` lines 141 to 143). **Why:** T2 installs one
agent as sole writer of every artifact, so six tickets will invent six authors and several meanings
of a phase; this is the one item every later ticket inherits. **Change:** name the author and put its
prompt in T2, correct T2 to one retirement, and add a state, gate, agent and writer table to `15` as
a T2 deliverable.

**CG-10 BLOCKING. The light shape does not follow from the study: it removes a check the study
observed, and the pack over-reads the figure that would justify it.** (`15` sections 2, 3, 5, 6;
`18` What the readers caught; `09` Q48.) Raised by DC-02, with PE-06 on the diagnosis. **Problem:**
the studied light shape kept a light readiness check, which caught 3 of 26 defects; the design's
light shape keeps only the preflight, and gives the pre-code reader to no unflagged change, so the
largest shape by volume loses a pre-code design critique. The 59 percent headline is over all full
changes, not over the small ones the argument rests on: among the 37 small rule-flagged changes only
19 had any failed readiness round, a share of 27 to 51 percent. The PM also has no diagnosis step,
though the study found the first hour of a light change is diagnosis and the pack's own example
needed a code trace (OBSERVED, `18` lines 49, 60, 91 to 96, 115 to 118; `15` lines 65 to 73). **Why:** this is the one
place the pack reduces a safety check, on evidence that points the other way, and it applies to the
majority of changes. **Change:** decide the light reader explicitly and state its cost; restate the
figures as population bounds; give the light card a diagnosis owner or a "ticket carries the
diagnosis" entry condition; reconcile Q48's urgent fix with the flag rule.

**CG-11 SHOULD-FIX. Classification and rounds are not what the pack says they are.** (`15` sections
1, 2, 4, 6; `09` Q21.) Raised by PE-04, PE-05, DC-04, DC-05 and the coordinator. **Problem:** four
defects of the same kind. Materiality, which decides another round and which add-ons attach, is the
reader's own judgment, and a material fact finding both makes a round substantial and, because fact
is a mechanical category, never earns one. Large is three phases and the author writes the phase
list, and the criterion count proxies remaining decisions. Section 4 calls the flags scripted, yet
irreversible, first-of-a-kind, thin-coverage and part of security are not path-derivable, and a
proposed flag can be removed by the PM with no recorded reason. Round 2's close condition states
round 1's, and the escalation category list omits code (OBSERVED, `15` lines 86 to 88, 149 to 166,
185 to 191; `09` Q21). **Why:** the study records that severity labels were unreliable and had to be
assigned by hand, and the round rule is built on that label; on a no-flag change the author alone
decides whether a reader runs. **Change:** let materiality beat the mechanical category, derive
materiality mechanically where possible, require a falsifier for non-material design findings,
define shape on tool-observable inputs, record removed flags, and align the tables and category
lists.

### Area D: roadmap and migration

**CG-12 BLOCKING. The roadmap's consistency claims fail: three prefixes run with one check fewer than
today, two tickets depend on later work, and one ticket changes four things.** (`17` T2, T3, T4, T5,
prefix table; `08` Principles.) Raised by DC-01 and the coordinator. **Problem:** T2 retires the
independent test author and the test plan, and every named replacement (the pre-code reader, the
recorded runs) arrives in T4 or T5, so T1+T2, T1+T3 and T1+T4 each run with less verification than
the pack leaves behind. T5 lists T4 nowhere, though T4's flags trigger its acceptance author, and T2
contains a T4 concept, since the PM can only write a light card once shapes exist. The flag table in
`15` section 2 also omits the acceptance author that sections 5, 6 and 16 invoke. T2 violates `08`'s own two rules, that no slice mixes lifecycle and tooling and that no schema ships without the
bundle command. T3 claims to change only the read path but also changes state writes, handovers and
commit composition. DERIVED from `17` lines 16 to 21, 28 to 37, 41 to 50. **Why:** the owner
confirmed the roadmap on every prefix leaving a consistent solution and no safety check lost; this is
the row where one is lost rather than degraded, and in T3 four causes share one ticket so a
shortfall cannot be attributed. **Change:** move the recorded runs to directly after T2 and keep the
test-plan-writer until they exist, add a per-prefix table that lists each of today's checks as
present, replaced or absent, split T3 into read and state, give each ticket one numeric kill
criterion from `01` and `08`, and re-check every row before #435 is dispatched.

**CG-13 BLOCKING. T1 rebuilds telemetry the repository already ships.** (`17` T1; `15` section 8;
`14` decision 15.) **Problem:** T1 records sessions and tokens per role at every boundary and prints
cost per phase, while the repository already has a harness adapter seam with telemetry extraction,
five-dimension attribution including seat and resolved model, present-zero distinguished from
omitted, baseline records, and aggregates-only privacy; T1 does not mention it (OBSERVED,
`feature-telemetry-v2.md` and `feature-harness-adapters.md` summaries against `17` line 16). **Why:**
this is the first ticket, meant to make every later question answerable by data; built twice it
creates two sources for one number, the failure the pack exists to remove, and built on the seam it
is probably a fraction of the size. **Change:** rewrite T1's cost half as exposing the existing
telemetry per change, phase and role, adding the phase and gate dimensions it lacks.

**CG-14 BLOCKING. The event store that state folds over is unnamed and conflicts with two shipped
streams.** (`17` T1; `15` sections 7 and 8; `14` decisions 14, 15 and 29; `AGENTS.md`.) Raised by
DE-01 and DE-04. **Problem:** one History row holds transitions, sessions, tokens per agent, rounds,
findings, gate results and evidence references, and state is a fold over them, but no file names the
store, its kinds, writers, bounds, version or gating rule. The change capsule is a closed
eleven-kind, four-writer stream with a 2 MiB cap, a lock and non-gating appends, and the state layer
says the ledger is host-local and telemetry never enters the capsule; the pack puts tokens with the
change as events. Read telemetry appends an event per bundle, so every read would dirty the worktree,
and a refused append would silently lose a step. The four-kind split also leaves flags, validation,
waivers and migrations with two homes (OBSERVED, `feature-capsule.md` lines 106, 120;
`feature-state-layer.md` lines 19, 96). **Why:** T1 is the first ticket and is exactly cost events; a
wrong choice becomes a version bump on an append-only file, tokens committed into public
repositories, or a definition of done that CI cannot evaluate. **Change:** add a store matrix to
`15` section 7 (kind, store, writer, gating, version, bound, privacy), keep read telemetry local,
make state-bearing appends gating, name which committed kinds CI reads, and add a fact-home table
with one home per fact.

**CG-15 BLOCKING. Migration is undefined, and `delivery.plan.v2` breaks every current reader.**
(`08` Compatibility and slice 1; `04` migration; `03` plan schema; `09` Q22, Q29; `17` prefix table.)
Raised by DE-03. **Problem:** the pack never says which shapes ship: `03` and `08` write v2 into the
existing plan file with an additive rollback, while `15` and `17` make the Work section of one
contract the target. The current plan reader accepts exactly one schema version and refuses any
other, and v2 replaces the scope keys with `affectedPaths` and drops leases, so `plan validate`,
`plan diff`, `plan overlap` and the commit primitive's scope computation all refuse it; `08`'s claim
that the old reader stays is therefore false. Q29 removes the compatibility reader when no open
change uses the old files, while `08` and `04` still say two milestones, and nothing covers a loss
rule for sections with no free-text slot, a rollback that survives the squash and branch cleanup,
pm-notes progress becoming step events, or a mid-lane tool upgrade (OBSERVED, `03` lines 79 to 92;
`08` lines 63, 181 to 185; `09` lines 499, 646). **Why:** data loss on in-flight work and a hard
break of current consumers hidden behind an additive label, inside the ticket that also changes the
artifact format. **Change:** add one shapes-in-flight table (shape, schemaVersion, reader, writer,
introduced, removed), make the contract the only new shape, refuse a migration that would drop
content and name what has no slot, keep legacy files until the change lands, replace the
two-milestone rule with Q29, and state the mixed-version read rule.

### Area E: classification and rounds

**CG-16 SHOULD-FIX. No lever is sized, so the return the owner is optimising for is unknown.**
(`17` T4; `15` section 2; `18`.) Raised by DC-06. **Problem:** the gain depends on how often the
eight flags fire and on add-ons the study never measured: the old rule sent 37 of 42 small changes to
the full shape, which suggests the new one may flag most service work, and no figure exists for the
concurrency rehearsal, the hostile run, the second seat or the mutation battery. Reclassifying small
changes is worth about 5 percent of total delivery minutes on the study's own medians, while rounds
on full-size changes are unsized (DERIVED from `18` lines 55 to 64, 92 to 95). **Why:** four add-ons
are tokens without a measured return, and the owner named a cost at which the work should be
reconsidered (Q30). **Change:** before T4 is built, replay the 150 small diffs against draft surface
maps and report the flagged share; make each add-on a typed obligation so T1 reports catches per
add-on; re-size T2 to T5 after T1 has ten changes.

**CG-17 SHOULD-FIX. The removal test replaced a measurable ceiling with a self-judged one, and T2's
headline metric has no lever.** (`15` section 7; `14` decision 16; `09` Q8; `17` T2.) **Problem:** the
removal test is answered by the author about its own text, and the only enforcement named is a lint
for duplication, while T2's success signal is that artifact lines fall by half (DERIVED, `15` lines
225 to 227). **Why:** nothing can falsify a claim to need more, so the metric T2 is judged on
measures an unenforced rule. **Change:** keep the test as intent and add measures that stand in for a
ceiling: duplicate line share, sections never fetched per role, facts per token, and a per-change
bound that warns.

### Area F: evidence

**CG-18 SHOULD-FIX. The study does not reconcile, and its headline comparison is selection-biased.**
(`18` Method, Cost by shape, small changes, Population; `15` section 1.) Raised by DC-03 and the
coordinator. **Problem:** the table is headed 386 ledgers and its rows hold 124 and 249, so thirteen
are unaccounted; sessions are reported as 27 of 581 ledgers, a total that matches no other count;
70 blocking findings are reported while the category rows sum to 74; the small-change table covers
150 of 373, and 43 in-period changes have no ledger with no reason given; the twelve changes with
failed rounds are the deep sample while the 59 percent is the population; and the small-change
comparison puts light changes (145 lines, 77 minutes) against full changes sent there by a risk rule
(419 lines, 173 minutes), so it measures the selection, while `15` opens with a claim the note has no
table for (DERIVED, `18` lines 27 to 64, 68 to 92). **Why:** the note is the only place a reader can
check the numbers behind 15 to 17, it goes public as the basis for T4, and the model that replaces
size opens on an unsupported sentence. **Change:** add one line of reconciliation per percentage and
the disposition of the 43 and the 13, report 19 of 37 beside the 13, keep the catch evaluation as the
support, and label the minutes comparison as confounded.

### Area G: data model and storage

**CG-19 BLOCKING. The write pipeline has no transaction, so writes can be lost or misattributed,
and the record does not survive the merge.** (`04` write pipeline; `13` form; `15` section 7; `14`
decisions 5, 29; `12` closeout.) Raised by DE-02, DE-07, DC-08 and the coordinator. **Problem:**
only the form carries `basedOnRevision`; field-level commands read, compute and overwrite without an
expected-revision check, no per-change lock spans read to commit, there is no idempotency key, and
the existing completion and commit primitive stage the whole change folder, so a facet renamed but
not yet committed lands without the trailer. A file that differs from HEAD is committed as found, so
a hand edit is laundered. Audit facts stay with the change but bodies live in a local store with no
reference scheme, retention or tombstone, while the audit context is an engineer after an incident on
another host; and nothing says where cost events live after the squash and the worktree removal
(OBSERVED, `04` steps 1 to 3; `15` lines 235 to 240; `12` line 227). **Why:** every write is a commit,
so a lost write is a lost provenance record; a reference that outlives its body is a broken
reference; and T1's value depends on reading cost for a change a month after it landed. **Change:**
give every write a per-change lock, an expected revision and an idempotency key; refuse when the
blob differs from HEAD; compare the staged blob with what was written; stop staging the whole change
folder; make a reference a content hash plus kind, size and run identity, with retention, purge
records and redaction; and make post-merge readability a T1 acceptance criterion.

**CG-20 SHOULD-FIX. The examples do not validate against the rules, and there is no machine-readable
schema.** (`03`; the five schema examples; `02`.) Raised by DE-08 and PE-08. **Problem:** the files
are examples, not schemas, and field by field they fail `03`: `title` and `sizeBudget` are
undeclared, `extensions` sits inside a criterion while the cap is per facet, a decision references a
record the plan only adds in a later phase, `status` has four values with no entry path to draft or
committed, the phase title in every example is a noun phrase the lint refuses, and the examples mint
`PRE-`, `ACT-` and `RF-`, which decision 25 forbids and `15` renames. Lint step 1 has only prose
tables to validate against (OBSERVED, `schemas/spec.yaml` lines 8, 31 to 36, 62; `03` lines 14 to
28). **Why:** T2 builds lint over these rules, so without a schema validation is a re-reading, and
without a canonical emission rule a hand edit cannot be detected by re-emission. **Change:** ship
real schema files with required fields, defaults and no additional properties, validate the examples
in CI, derive the `03` tables from them, purge the forbidden prefixes, and state the canonical
emission rule (key order, quoting, width) so an unchanged facet re-emits byte-identical.

### Area H: trust boundaries

**CG-21 BLOCKING. A change can edit the surface map that classifies it.** (`15` sections 2 and 4;
`09` Q43; `14` decisions 6 and 13.) Raised by SEC-04. **Problem:** the surface map and the protected
list are repository files maintained through normal changes and read at intake, at validation and at
review; nothing says the read uses the merge base rather than the change's own tree, so a change that
narrows a pattern is scored against its own edit, and nothing flags a diff that touches the map
(OBSERVED, `15` lines 48 to 53, 82 to 84). **Why:** this is the policy input for every flag and low
risk is the default, so the incentive and the mechanism point the same way; one light-shape change
could switch off the security and data add-ons for that change and every later one. **Change:**
evaluate against the merge base, in the lane and again in CI; always raise a policy flag with owner
sign-off; let an agent-delivered change widen a pattern but never narrow it.

**CG-22 BLOCKING. The tool-written record is not trustworthy: the trailer is a label and the door
does not know its caller.** (`01` vision item 4; `04` write pipeline, provenance, "for their role";
`12` one lane one change; `14` decisions 2 and 4; `16` section 5.) Raised by SEC-02, SEC-03 and
DE-06. **Problem:** the trailer and `generatedBy` are strings an agent can write and lint only checks
that they agree; a typed write commits the whole file at the pathspec, so a pre-edited facet rides
into a tool commit; repair commits agent content without checking that the artifact was broken; the
CI rule covers every file under the change folder, including memory candidates the agents write; the
squash and branch cleanup delete the per-write trail the audit rests on; and every lane agent calls
the same CLI as the same OS user, with no rule for how it learns the caller's role, so a coder can
run the review verdict and be recorded as a tool (OBSERVED, `04` lines 91 to 101, 149 to 159, 189).
**Why:** `16` builds observed over claimed on these records, and decisions 11 and 24 rest on the
reviewer being independent of the coder; after this a bypass looks legitimate, and the signing
question looks answered. **Change:** say what the trailer proves, refuse a write when the file
differs from HEAD, require repair to start from a failing artifact, verify the events append in CI,
scope the CI rule to files that carry `generatedBy`, and bind writes to the session and role.

**CG-23 BLOCKING. The tool executes commands the contract cites, and no rule bounds them.** (`15`
sections 4 and 5; `16` sections 2 and 4; `17` T2 and T5; `09` Q49.) **Problem:** the preflight runs
every cited command once and T5 has the tool run obligations on base and candidate, while a light
card is largely a transcription of ticket hints that include the checks expected; there is no
allowlist of command shapes, no `cwd` confinement, no environment rule and no sandbox, `04` says the
CLI runs outside the agents' permission scope, and nothing records whether a statement, path or check
in a contract came from the tracker, an author or the tool (OBSERVED, `15` line 141; `17` line 20). **Why:** a
string that starts in a public tracker issue can reach a deterministic executor holding the lane's git
and tracker credentials, with no model step left to refuse; this is the pack's largest unreviewed
privilege boundary and it is new in T2. **Change:** add an allowlist of argv prefixes, no shell, `cwd`
confined after `realpath`, a minimal environment without credentials, hints limited to known gates
and existing test paths, and every tool-run command and its origin in the reviewer bundle.

**CG-24 SHOULD-FIX. No content or parsing rule for what enters the committed change folder.** (`15`
section 7; `14` decision 29; `04` repair and migrate; `13` form; `07` globs.) Raised by SEC-06 and
SEC-07. **Problem:** the pack says where evidence bodies live, not what may enter them, and it adds
six untrusted-input parsers with no YAML subset, size cap, canonical form for hashing, or one pinned
parser shared by the CLI and CI; tokens, credential-bearing URLs and customer records used as vectors
commit and merge without a scan (OBSERVED). **Why:** such content cannot be removed without rewriting
history, the single writer is the one place a scan could be complete, and aliases, custom tags and
duplicate keys are parser-level attacks that two parsers reading two values would let through.
**Change:** scan every persisted string and refuse with a named field; build summaries from status,
counts and durations; commit security findings by reference; specify YAML 1.2 core with duplicate
keys rejected, a byte cap, canonical serialisation and one pinned parser.

### Area I: identifiers

**CG-25 SHOULD-FIX. The identifier rules are contradicted by the pack's own examples and grammar.**
(`15` sections 7 and 10; `09` Q4 and Q18; `../id-prefix-catalog.md` R2, R5.) Raised by TW-09.
**Problem:** section 7 uses `P2` and `P2-S3` while section 10 registers `PH-` and uses `PH-02_S03`,
and the catalog allows one hyphen and a two-letter prefix, so `P2-S3` is neither; R5 forbids a prefix
confusable with an existing one, including a strict prefix, and `F-` is a strict prefix of `FACT-`
and `FIND-`, though Q4 cites R5 to reject `ACT-` and not here; section 10 also gives two prefixes
allocators other than the contract, against R2 and decision 25 (OBSERVED, `15` lines 231, 286 to
292). **Why:** the contract is the allocator and steps are referenced across bundles and events, so
two grammars mean a wrong key on every reopen, and a later prefix rename migrates every artifact.
**Change:** keep `PH-<nn>_S<nn>`, lengthen to `VFACT-` and `RFIND-` or record an explicit waiver, and
make the contract the only allocator.

## 3. What is good and must not be lost

- The read-amplification measurement, its method, and its honest note that shell reads are not
  counted, so the true figure is higher. This is the pack's strongest evidence.
- The GH-416 corruption story as a design driver, and the explicit defeat condition for the thesis:
  if agents still read whole files, nothing changes.
- The flag table's not-a-flag test, and the finding that a wording-keyed rule sent harness and
  documentation work through the heaviest shape.
- Rounds earned by category and materiality, and the rule that a severity word never escalates,
  grounded in the packaging finding that was top severity and still light.
- One author, two readers, with the lost-and-covered table: stating what is given up is what makes
  the argument checkable.
- The preflight, which is also the pack's newest privilege boundary: keep it, and bound it (CG-23).
- The handover as tool-drafted, coder-confirmed, evidence by reference, with the coder's judgment
  kept and the quota removed.
- Projection rather than stripping, facts per token, the exception budget of three, and the Limits
  section with what the study does not show.
- The prefix-consistency table, whose two wrong rows should be repaired rather than dropped.

## 4. What the rewrite of sections 02 to 13 must not forget

1. One contract file with seven sections (goal and scope, criteria, verified facts, decisions,
   oracle, work, flags); the separate test plan and plan examples disappear.
2. Every criterion has a proof obligation naming the observable and predicate; identifiers come from
   the catalog, so purge `PRE-`, `ACT-` and `RF-` and pick one phase and step form.
3. Drop the fixed budgets and the refusal semantics, or the rewrite restores decision 16's rule.
4. Replace S, M, L with the three shapes, reconciled with the `lite` variant: six pinned phases, no
   inference from omission.
5. Five facets become three stored artifacts; the glossary's Facet row and every bundle row change.
6. 05's matrix loses `test-plan-writer`, `plan-writer` and `readiness-reviewer`, gains the author,
   the pre-code reader and the acceptance author, and adds the ticket to the reader's set.
7. 04 collapses into one contract family, plus the command policy (CG-23), the caller binding
   (CG-22) and a named owner for the evidence store.
8. 06: A, B and E collapse into one author; H is deferred; add the light shape end to end and a flag
   earned after coding starts.
9. 08's slices become T1 to T6, and slice 0's compatibility writer is reconciled with the capsule.
10. 12 encodes the shapes, including which phases light skips and whether the docs phase survives,
    and stays consistent with `lite`.
11. 13 shows the contract's real sections, tags every row with its origin, drops the tier header, and
    matches Q40.
12. Every file's Status line names the authority that governs it.

## 5. Questions only the owner can answer

1. May the light shape run with no Definition of Ready? The study's light changes kept a light
   readiness check that caught 3 of 26 defects, so the choice is one pre-code pass per change or the
   preflight plus the reviewer alone.
2. Do you want the double run for every obligation, given that a true base leg is a second gate? If
   not, which obligations earn it?
3. May T1 be cut down to exposing the existing telemetry, and should cost live there or in the
   capsule?
4. Is a claimed tool trailer enough as proof, or do you want the merge commit signed or a tool-held
   key?
5. May the contract author settle an open question with a default on your behalf, and who is
   accountable when the default is wrong?
6. Does the light shape still reconcile the current-truth docs? No file says where the docs phase
   went, and today's conformance test expects it.

## 6. Method

**Read in full:** `README.md`, `01-analysis.md` to `18-delivery-study.md`, `HANDOVER-2026-11-28.md`,
the five `schemas/*.yaml` examples, and `../id-prefix-catalog.md`. **In part:** `AGENTS.md`,
`doc/guides/change-lifecycle.md`, `doc/guides/delivery-modes.md`, `doc/spec/features/feature-capsule.md`,
`feature-state-layer.md`, `feature-telemetry-v2.md`, `feature-harness-adapters.md`, and the
`reviewer`, `pm`, `spec-writer` and `readiness-reviewer` agent definitions.

**Critics that contributed**, each blind on one risk dimension: a prompt and agent-behaviour review
(CG-08, CG-09, CG-11), a testing review (CG-05, CG-06, CG-07), a security and trust review (CG-21 to
CG-23, CG-24), a documentation review (CG-01, CG-03, CG-25), a decision and evidence review (CG-12,
CG-11, CG-10, CG-16, CG-18, CG-19), and a data model review (CG-14, CG-19, CG-15, CG-20). Findings
are merged where they share a cause and a fix; the coordinator added the artifact-set, telemetry and
removal-test findings and ran the cross-file checks.

**Pack state:** the pack was edited during this review (`17-roadmap.md` at 12:10 gained ticket numbers
#434 to #439, and several files changed at 12:05); the key line references were re-checked against
the files at close.

**Not checked, and why:** no schema example was validated with a parser, because the review was
read-only and did not execute code, so a field-level mismatch beyond those named may remain. The
study's figures cannot be re-derived, so CG-18 is an internal-consistency check. Tracker issue numbers
were not opened. No test, gate or CI result was executed or observed.

---

*This review was produced by **CritiqueGrid**, an evidence-driven review panel. It is an
independent critique of a draft, not an approval.*
