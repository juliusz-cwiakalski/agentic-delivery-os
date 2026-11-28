---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/06-workflows.md
---
# 06. Workflows: mental experiments

Status: governed by `14-review-decisions.md` (decisions 11, 12, 18, 20, 35, 37 to 39) and by
`15-classification-and-rounds.md`.

Each experiment lists the actors, the commands, what each agent sees, and the failure paths.
Two changes run through them: `GH-77`, the `--json` output of the export command, a light
change (`schemas/contract.yaml`), and `GH-416`, the `push <ref>` command, a phased change
with the `data` flag. Commands are those of `04-cli.md`; the `--role`, `--expect-revision`
and `--idempotency-key` that every write carries are left out.

## A. Intake to preflight, light change

**Actors:** PM, coder.

```bash
# PM
jaiship change classify GH-77
# proposal: contract, from src/cli/export.ts against the surface map; kind feature; shape light

# PM: the diagnosis, recorded before the card
jaiship contract add GH-77 --section facts --id VFACT-1 --statement "The export command prints its progress through the shared logger, which writes to stdout." \
  --check read --target src/cli/export.ts#run --observed "three log.progress calls"
jaiship contract add GH-77 --section facts --id VFACT-2 --statement "No JSON renderer for the export summary exists in src/cli." \
  --check command --argv git grep -n render-json src/cli --observed "No match."

# PM: the flags, one by one
jaiship change classify GH-77 --remove contract \
  --reason "The export command is used by a person at a terminal; no service or client consumes its stdout."

jaiship contract form GH-77 > /tmp/contract-form.yaml
# the PM fills the goal, the criteria, the oracle, the work and the slot, then writes the card
jaiship contract set GH-77 --from-file /tmp/contract-form.yaml
jaiship lint change GH-77
# pass: every criterion has an obligation
jaiship preflight GH-77
# pass: every cited path exists or is declared an addition; 3 commands ran under the policy
jaiship workflow next
# state: delivery, phase PH-01, step PH-01_S01, agent coder
jaiship context bundle --for coder --phase PH-01
```

**What each agent sees.** The PM sees the ticket with its hints, the proposed flags and the
code it traced. The coder sees the ticket and the card (`05-context-bundles.md`). No reader
session runs: the preflight and the coder cover the change.

**Failure paths.** A proposed flag the PM removes takes a reason, and the proposal stays on
record. The lint refuses a criterion without an obligation and names the field. The preflight
names each miss and writes nothing (experiment B). A ticket with a typed block has each of
its checks matched to an obligation.

## B. A failed preflight, and a typed finding that returns the card

**Actors:** PM, coder.

```bash
# PM: the first draft of the card
jaiship preflight GH-77
# exit 1, nothing written. Mechanical findings, resolved by the tool after their fix:
#   RFIND-1, fact: src/cli/export-summary.ts is cited as a modify path and does not exist
#   RFIND-2, process: AC-3 has no obligation
#   RFIND-3, process: `node bin/export.js --help | grep json` needs a shell (`change.command.not-allowed`)
jaiship contract form GH-77 > /tmp/contract-form.yaml
# the PM corrects the path, gives the command an expected output, adds PROOF-3
jaiship contract revise GH-77 --reason "preflight" --from-file /tmp/contract-form.yaml
jaiship preflight GH-77
# exit 0

# coder, the first reader: the ticket's last paragraph asks for a change the card lacks
jaiship context bundle --for coder --phase PH-01
jaiship review finding add GH-77 --round 1 --category contract --materiality material \
  --ticket "last paragraph" \
  --summary "The ticket asks for the same flag on the import command; the scope excludes it."
# RFIND-4. The card returns to its author.
jaiship workflow next
# state: contract, agent: pm, reason: RFIND-4

# PM: trace the import command, then include it or record why it is out of scope
jaiship contract form GH-77 > /tmp/contract-form.yaml
jaiship contract revise GH-77 --reason "RFIND-4" --finding RFIND-4 --from-file /tmp/contract-form.yaml
jaiship lint change GH-77
jaiship preflight GH-77

# coder, a new session
jaiship context bundle --for coder --phase PH-01
# a new revision, with RFIND-4 and the scope or the non-goal that answers it
```

**What each agent sees.** The coder sees the ticket and the card side by side; its finding
names the ticket paragraph. The PM sees the findings, the card and the preflight's output,
never the coder's session. The second coder session sees the card at its new revision.

**Failure paths.** A material finding returns the card. A finding that is not material is
recorded, the coder starts, and the PM fixes it in the next revision. A finding the PM
disputes becomes a typed question (`jaiship blockers publish GH-77 --question "..." --default
"..."`), and the lane parks until the CEO or the owner answers. A card returned twice for the
same gap goes to the CEO the same way; the lane does not write a third card for it.

## C. A flagged change: the pre-code reader

**Actors:** pre-code reader, contract author, PM.

```bash
# pre-code reader, round 1. The contract passed the lint and the preflight.
jaiship context bundle --for pre-code-reader
jaiship review finding add GH-416 --round 1 --category design --materiality material --cites AC-2 \
  --path packages/core/src/app/dispatch-lane-push.ts \
  --summary "The append follows a failed act with no fence check; two lanes can append one ref."
# RFIND-1
jaiship review finding add GH-416 --round 1 --category coverage --materiality useful --cites AC-3 \
  --summary "No boundary case for a cause token at the edge of the vocabulary."
# RFIND-2. The lint minted RFIND-3 (fact): VFACT-2 cites a test by a path that moved.

# contract author: the contract returns with the findings
jaiship context bundle --for contract-author --findings RFIND-1,RFIND-2,RFIND-3
jaiship contract add GH-416 --section decisions --id DEC-3 --question "When is the record appended?" \
  --choice "Only after the fence accepts the ref; a refusal records the cause and nothing else."
jaiship contract revise GH-416 --reason "RFIND-1 to RFIND-3" --finding RFIND-1 --from-file /tmp/contract-form.yaml
jaiship lint change GH-416
# pass: the lint re-sweeps the whole contract in the same round
jaiship preflight GH-416
# pass
jaiship review rounds allowed GH-416
# allowed: true. Round 1 was substantial. Ceiling 3: the change has four phases.

# pre-code reader, round 2
jaiship context bundle --for pre-code-reader
jaiship review finding add GH-416 --round 2 --category design --materiality useful \
  --non-material-reason "The fence check runs before the append." --summary "..."
# RFIND-4: not material
jaiship review rounds allowed GH-416
# allowed: false. Round 2 had no material finding.
jaiship workflow next
# state: delivery, phase PH-01, step PH-01_S01, agent coder
```

**What each agent sees.** The reader sees the ticket, the non-goals, the seven sections, the
lint and preflight results and the flags with their add-ons (`05-context-bundles.md`). The
contract author sees the findings and the sections they cite. The reader of round 2 sees the
contract at its new revision and what changed since round 1.

**Failure paths.** A round with no material finding closes the gate while useful findings
are still open; they are fixed in the next revision and never earn a round. Past the ceiling
with a material finding open, the PM or the CEO decides between the positions and records
the reason. A finding in design, contract, security or data that is marked not material
carries a reason. A third round needs a large change, a substantial round 2 and a goal or a
decision that changed in between.

## D. A phased change: delivery per phase

**Actors:** coder (PH-02), coder (PH-03, a fresh session), doc-syncer, PM.

```bash
# coder, PH-02
jaiship context bundle --for coder --phase PH-02
jaiship step done GH-416 PH-02_S01
jaiship handover draft GH-416 --phase PH-02 > /tmp/handover-PH-02.yaml
# the tool drafts from the events: steps done, files changed, gate results
# the coder keeps what PH-03 needs and what the contract does not yet state
jaiship step done GH-416 PH-02_S02 --handover /tmp/handover-PH-02.yaml
# the last step of the phase takes the handover; the handover and the event land together

# coder, PH-03, a fresh session
jaiship workflow next
# state: delivery, phase PH-03, step PH-03_S01, agent coder
jaiship context bundle --for coder --phase PH-03
# the bundle carries the PH-02 handover, not the PH-02 transcript

# doc-syncer, after the last step of PH-04: the contract lists a feature page under docs:
jaiship context bundle --for doc-syncer

# PM
jaiship pm brief
jaiship workflow next
# state: review, agent reviewer
```

**What each agent sees.** The PH-02 coder sees its phase, the criteria and obligations of the
phase and what PH-03 expects. The PH-03 coder sees the PH-02 handover and its own phase. The
PM sees the handover's summary and the state, never a transcript.

**Failure paths.** A handover is refused while a step of the phase is open. A handover line
that claims a run the tool did not record is refused: the draft comes from events, and every
`done` line carries an evidence reference. A deviation that changes the contract is a typed
finding to the contract author, who writes a new revision with the finding as the reason, for
the sections still ahead (Q20). A phase that continues in the same session needs no handover
(Q19). A reopened step keeps its identifier (`step reopen`).

## E. Review: findings, rounds and mutation

**Actors:** reviewer, coder, contract author, PM.

```bash
# reviewer, round 1
jaiship context bundle --for reviewer
jaiship obligation run GH-416 --leg candidate
jaiship obligation mutate GH-416 --id PROOF-1 --fault-set push-twice
# the tool copies the tree, applies the fault set, runs the obligation, records the result
# result: 1 of 3 faults survives: the test stays green when a second push is not refused
jaiship review finding add GH-416 --round 1 --category coverage --materiality material --cites PROOF-1 \
  --path tests/behaviour/dispatch-lane-push-command.test.ts \
  --summary "PROOF-1 stays green with the second-push fault: nothing counts transport calls."
# RFIND-1
jaiship review finding add GH-416 --round 1 --category format --materiality cosmetic --summary "Help text wraps at 70 columns."
# RFIND-2
jaiship review rounds allowed GH-416
# allowed: true. Round 1 was substantial.
jaiship review verdict GH-416 --round 1 --verdict fail

# coder: a fix bundle with the findings it must satisfy
jaiship context bundle --for coder --findings RFIND-1
jaiship review finding resolve GH-416 --id RFIND-1 \
  --evidence "obligation mutate PROOF-1 push-twice: 3 of 3 faults caught"
# RFIND-2 is fixed in the same pass; the lint verifies it

# reviewer, round 2: the fixes and what they touch
jaiship context bundle --for reviewer
jaiship review finding add GH-416 --round 2 --category code --materiality useful --summary "..."
# RFIND-3: not material
jaiship review rounds allowed GH-416
# allowed: false. Round 2 had no material finding.
jaiship review verdict GH-416 --round 2 --verdict pass
jaiship workflow next
# state: gates
```

**What each agent sees.** The reviewer sees the framing sections of the contract, the
recorded runs on both legs, the deviations of the handovers, the commands the tool ran with
their origin and the watchlist hits; it reads the diff from git. The coder sees the findings
it must fix and the criteria, obligations and paths they cite. The reviewer of round 2 sees
the fixes, what they touch and the findings of round 1.

**Failure paths.** A finding that changes the contract goes to the contract author as a new
revision with the finding as the reason, and the review waits. A finding whose fix fails
twice goes to the PM; the lane does not attempt a third fix. A finding the coder disputes
becomes a typed question. A mutation is refused outside the command policy: an allowlisted
prefix, no shell, a working directory inside the worktree, an environment without
credentials. A refused round is raised by the PM or the CEO with
`jaiship review rounds allowed GH-416 --allow --reason "..."`.

## F. A flag earned after coding started

**Actors:** coder, reviewer, PM, contract author, pre-code reader.

```bash
# coder, GH-77: the progress lines must change stream, so PH-01_S02 writes the shared logger
jaiship step done GH-77 PH-01_S02
# the diff writes src/cli/logger.ts, which the Work section declares as a read

# reviewer, round 1. At review the tool computes the flags again, from the surface map read
# from the merge base: src/cli/logger.ts is on the `contract` surface, a flag the PM removed
# at intake. The round cannot close until the PM decides.
jaiship context bundle --for reviewer
jaiship review finding add GH-77 --round 1 --category process --materiality material \
  --path src/cli/logger.ts \
  --summary "The diff writes a surface the card does not flag: a misclassification."
# RFIND-1. It adds the flag with its add-ons.

# PM
jaiship pm brief
# pending decision: the proposed flag `contract`, with the path that earned it
jaiship change classify GH-77 --confirm contract
# recorded: the change takes the flagged shape. Nothing of the light shape is removed.

# contract author: the card passes to the author, who grows it where the add-ons need it
jaiship contract add GH-77 --section oracle --id PROOF-4 --criterion AC-2 --method rehearsal \
  --observable "The stdout of two other commands while --json is not passed." \
  --predicate "Every progress line still reaches stdout."
jaiship contract revise GH-77 --reason "RFIND-1" --finding RFIND-1 --from-file /tmp/contract-form.yaml
jaiship lint change GH-77
jaiship preflight GH-77

# pre-code reader, round 1: the add-on of the flag, on the contract and the diff so far
jaiship context bundle --for pre-code-reader
jaiship review finding add GH-77 --round 1 --category contract --materiality useful \
  --non-material-reason "..." --summary "..."
# RFIND-2: not material
jaiship review rounds allowed GH-77
# allowed: false

# coder, then the reviewer: round 2 is earned by RFIND-1
jaiship workflow next
# state: delivery, phase PH-01. The coder meets PROOF-4 before the phase can close.
```

**What each agent sees.** The reviewer sees the proposed flag beside the diff. The PM sees
one pending decision with the path that earned it. The contract author sees the card, the
flag and the diff. The coder sees the new obligation in its bundle.

**Failure paths.** The PM removes a proposed flag only with a reason. The same computation
runs when the contract is validated, before merge and in CI, so a flag missed in the lane
escalates the same way later. A diff that touches the surface map itself takes the policy
flag and needs the owner's sign-off; an agent-delivered change may widen a pattern and never
narrow one.

## G. A park and resume

**Actors:** PM, coder.

```bash
# before the peak window: the coder closes the step it finished and stops at the boundary
jaiship step done GH-416 PH-03_S01
jaiship pm brief
# next action: resume at PH-03_S02 after the window. The lane parks.

# after the window
jaiship workflow next
# state: delivery, phase PH-03, step PH-03_S02, agent coder, parked: no
jaiship context bundle --for coder --phase PH-03
# the bundle carries the PH-02 handover and the state folded from the events
```

**What each agent sees.** The PM sees the next action and the handover's summary. The coder
sees the PH-03 bundle with the PH-02 handover. Neither reads a session history: the state is
a fold over committed events, and the handover is the only cross-phase memory.

**Failure paths.** A park that expires with the branch behind fails the first write with
`change.branch.behind`; the PM syncs and retries, and a write never rebases. A park that
expires with an open blocker keeps the lane parked; the brief shows the blocker. A step left
open at the park is open at the resume; nothing is inferred from an absent event. A lane is
dispatched only to a boundary it can reach before a window.

## H. Parallel lanes from typed paths

**Actors:** scheduler (the queue), PM, coder A, coder B.

```bash
# the queue compares the Work sections before it dispatches
jaiship plan conflicts GH-416 GH-503
# verdict: serialize
# reason: both write packages/cli/src/production.ts

jaiship plan conflicts GH-416 GH-504
# verdict: parallel
# reason: GH-504 reads packages/core/src/contracts/push.ts and GH-416 writes it; no write overlap
# note: GH-504 re-syncs at its next state boundary if GH-416 lands first

# in the lane of GH-503, the second lane
jaiship context bundle --for coder --phase PH-03
# order note: serialized behind GH-416; rebase after it lands; the shared write path

# at the pull request
jaiship change audit GH-416 --base origin/main-tools
# 2 undeclared paths, recorded; 1 path outside the scope: the audit fails
```

**What each agent sees.** The scheduler sees the path sets and the conflict class. The
second coder sees the order note and the shared path. The PM sees the decision and its
reason.

**Failure paths.** An undeclared path is recorded; a path outside the change's scope or in a
protected area fails; one on a flagged surface escalates as in experiment F. A contract that
over-declares serializes everything, and the retrospective measures the misprediction rate.
A rename or a generated file serializes. This experiment runs on T6 (`17-roadmap.md`); until
it lands, an undeclared scope serializes.
