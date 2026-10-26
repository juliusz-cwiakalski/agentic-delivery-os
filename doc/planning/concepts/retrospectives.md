# Concept: retrospectives

Status: Draft (2026-10-26). Design of the ADOS retrospective subsystem:
levels, triggers, process, memory integration, action follow-through,
and the autonomy model. Retrospectives are the consolidation engine of
the memory model (memory-lifecycle.md) and the improvement loop of the
delivery system. Tracker anchors: issues #43 (retrospective agent) and
#64 (decision retro lifecycle). Grounded in the pilot workspace's proven
retro machinery, ADOS's existing retro touchpoints, and the 2026-10
external research corpus.

## What exists today

- PM notes carry typed `retro` notes per change (the primary delivery
  retro input); phases record failures, reopens, and lessons.
- The coordinator keeps append-only local retrospective notes.
- Bootstrapper runs per-phase retrospectives during inception (issue
  #137, shipped) plus tribal-knowledge harvest at onboarding.
- Decision records carry a Structured Retrospective section and a
  review date (issue #64 tracks the verification loop).
- The pilot workspace (design partner deployment) runs the mature
  version: a retro command with stable scope keys and idempotent notes,
  a watermarked evidence collector, a coverage registry (merged-but-not-
  reviewed), a generated index over hundreds of notes, a meta-learning
  file where the procedure improves itself, a long-term research program
  with reusable extractors, and daily-ceremony wiring where every step
  is verified by its artifact.

The research corpus adds the failure catalog (15 documented reasons
retros fail to produce change) and the confirmation that no public
fully-autonomous retro loop exists - automated evidence, drafting, and
analysis with human sampling is the state of the art. ADOS aims one
step further: autonomous retro operation with human sampling and veto,
consistent with the memory autonomy model.

## Levels and triggers

Hybrid trigger model: scheduled cadence for learning, event and
severity triggers for incidents, accumulation triggers for sessions,
lifecycle triggers for projects. Triggers are declared in advance
(an incident without a pre-declared trigger rule is itself a finding).

```mermaid
flowchart TD
    subgraph triggers
        T1[always: change merged]
        T2[session end / importance threshold]
        T3[severity event: rollback, owner rescue, failed delivery, gate bypass, budget breach, poisoning suspicion]
        T4[schedule: daily window, sprint rollover]
        T5[milestone / inception phase exit]
        T6[schedule + corpus: fleet cadence]
    end
    T1 --> L1
    T2 --> L2
    T3 --> L3
    T4 --> L4
    T5 --> L5
    T6 --> L6
    subgraph levels
        L1[L1 change closeout<br/>scope: the capsule]
        L2[L2 session retro<br/>scope: one agent session]
        L3[L3 incident retro<br/>scope: the event]
        L4[L4 window retro<br/>scope: project, time-boxed]
        L5[L5 project retro<br/>scope: milestone or inception]
        L6[L6 fleet retro<br/>scope: cross-repo]
    end
    L1 --> O1[memory promotions V2 to V0/V1<br/>rare ticket candidates]
    L2 --> O2[private lessons, V3 promotions<br/>incident triggers]
    L3 --> O3[blameless findings, actions,<br/>checklist and gate additions]
    L4 --> O4[cross-change patterns, lesson promotion,<br/>action follow-through verification]
    L5 --> O5[project memory consolidation,<br/>tribal knowledge graduation]
    L6 --> O6[common-mode failure detection,<br/>fleet memory and policy promotion]
```

| Level | Trigger | Runs | Frequency |
|---|---|---|---|
| L1 change closeout | Every merged change | Closeout ceremony (memory step) | Always |
| L2 session | Session end, or accumulated significance | The agent itself, inline | Per session |
| L3 incident | Pre-declared severity thresholds | Coordinator + involved agents | Event-driven |
| L4 window | Daily / sprint cadence | Coordinator (curator role) | Scheduled |
| L5 project | Milestone end, inception phase exits | Coordinator + human gate | Lifecycle |
| L6 fleet | Fleet cadence + corpus analysis | Fleet curator; human samples | Scheduled |

Meta-retro is a property of every level, not a level: each procedure
variant records what produced insight versus wasted effort in a
meta-learning file, and the procedure edits itself through the normal
change process (the pilot's proven pattern; research calls this
double/triple-loop learning and shows it is the rarest, highest-value
loop).

## The process (five stages, follow-through first)

1. **Verify prior actions.** The first item of every L4+ retro: inspect
   each open action's verification artifact (test, metric, PR, ticket),
   not the owner's status claim. Applied / partial / violated-with-
   consequence; violated fresh rules feed the self-error audit.
2. **Collect evidence mechanically.** One collector per source (git,
   tracker, CI, telemetry event log, owner comments), writing an
   immutable evidence ledger with trace ids; collectors are GET-only,
   watermarked, bounded; a collector finding is evidence, not a
   verdict. Pipeline-truth checks catch vacuous green (a pipeline with
   zero jobs never ran).
3. **Generate insights.** Mandatory gate before decisions (the
   documented anti-pattern is jumping from data to start/stop/continue).
   Separate observed facts (each linked to evidence) from inferences
   (each carrying confidence). Analysis dimensions with proven value
   from the pilot: self-error audit (my own errors and near-misses,
   including violations of existing rules - a violated rule needs an
   enforcement change, not a restatement), owner-caught escapes
   (defects that survived all my checks - highest signal), adversarial-
   review escapes, expensive loops and cost anomalies, vacuous checks,
   tool-mechanics failures, delivery friction metrics (phase reopens,
   review iterations, branch-open duration) where clusters across
   tickets indicate systemic gaps and one-offs usually do not.
4. **Decide.** Two distinct outputs, never conflated:
   - **Memory promotions**: per the memory model routing table, to
     exactly one canonical home, evidence-gated.
   - **Actions**: at most 1-3 per window (improvement WIP limit), each
     with the five-field contract plus proof: named owner (agent role
     or human), verifiable verb (add/remove/change/test/deploy - never
     "review" or "improve"), measurable outcome, real tracker entry,
     due date, verification artifact. Team-owned actions are invalid.
5. **Close.** Write the note (fixed schema, machine-readable
   frontmatter: level, trigger, window, scope key, participants,
   evidence refs, facts, interpretations, wins with mechanism, gaps,
   candidate lessons, actions, confidence), update the coverage
   registry, rebuild the index, single commit, bounded summary. Scope
   keys make reruns idempotent; reruns append addenda, never rewrite.

## Memory and action integration

- Every level's promotions flow through the memory model's write gate;
  the retro is the promotion engine, not a parallel system.
- The action registry is the retro's follow-through memory: actions age
  (nudge at 14 days, escalate at 30 or on second miss), close only
  explicitly (done with artifact, deprioritized with reason, or
  superseded), and surface on the board next to owner asks - visible
  aging, never silent drift. "A postmortem without subsequent action is
  indistinguishable from no postmortem."
- Process-class lessons close by standardization: the playbook,
  checklist, or agent definition is updated (kaizen rule: no
  improvement without updating the standard), through the change
  process - the strongest channel, per the memory model.
- Decision records close their own loop (#64): review dates trigger a
  decision retro comparing predicted versus actual outcomes; the
  structured retro section and calibration dimensions are the L4/L5
  input.

## Autonomy model

Consistent with memory-autonomy-and-visibility.md: agents own evidence
collection, drafting with citations, classification, routine L1/L2
closeouts, indexing, and recurrence detection. The human owns
meta-retro schema and trigger changes, promotion of lessons that change
safety behavior, high-severity/novel findings, and final fleet reports.
Sampling: 100 percent review for high-severity, novel, or irreversible
cases; 10-20 percent random sampling of routine notes once quality is
established (start at 100 percent); every playbook safety-rule change.
Escalation triggers: ambiguity, conflicting agent goals, destructive or
irreversible action, repeated failure signature, low lesson confidence,
owner request.

Blameless across human and agent actors: findings describe conditions
at the system level - the harness, prompt, checklist, gate, or tooling
that made the action reasonable - never "agent X was careless". The
agent is a stochastic policy; the harness is the design surface.
Accountability is forward-looking (named owner of the fix), blame is
backward-looking and banned from notes.

## Failure modes and defenses

| Documented failure | ADOS defense |
|---|---|
| Actions with no owner / vague verbs / no tracker entry | Five-field contract + verification artifact; invalid actions cannot be filed |
| No follow-up; action graveyard | Follow-through-first agenda; aging nudges; board visibility; WIP limit 1-3 |
| Opinion-only discussion | Evidence ledger; facts vs interpretations split; no-artifact claims stay hypotheses |
| Skipping insight generation (Wheel of Fortune) | Insights are a gated stage; decisions cite insights |
| Blame; hidden facts | Blameless system-level findings rule |
| In-the-soup topics | Scope classification: outside-control findings route to owner escalations, not actions |
| Recurring topics mistaken for progress | Recurrence is explicitly reported; recurring-unresolved escalates |
| Metrics as targets (Goodhart) | Metrics are retro inputs, never agent targets; paired tension metrics |
| Hallucinated or surface-attributed synthesis | Every fact links evidence; sampling audits; low-confidence synthesis flagged |
| Playbook context collapse from repeated summarization | Incremental dated deltas; dedup by merging with provenance; never wholesale rewrite |
| Unverified lessons encoding wrong behavior | Evidence gate before promotion; lessons carry first-seen and last-validated dates |
| Agent conformity: many agents, same mistake | L6 aggregates by failure signature across the fleet; common-mode = harness defect, not N agent defects |
| Retro theater (writing rewarded, closing not) | Closure rate and time-to-close are the process meta-metrics; document-only actions invalid |

## Story mapping

- Issue #43 (retrospective agent / automated change retros) is the
  tracker anchor; the M2-S3 ceremony runner already carries the retro
  evidence pass, sprint rollover, and testing-session assessment.
- M2-S3 AC extends with: declared trigger model, follow-through-first,
  the note schema, and idempotent scope keys.
- New M2-S10: the action registry and follow-through enforcement
  (five-field contract, aging, board surface, closure rules).
- The `ados retro` command family (registry) runs levels on demand;
  ceremonies schedule them; the doctor audits the corpus (index
  coverage, schema, dangling evidence links).
- Long-term retro research (corpus mining with reusable extractors,
  per-question analyses, findings) is a fleet capability on the pilot's
  blueprint; candidate for the post-M4 research track.
