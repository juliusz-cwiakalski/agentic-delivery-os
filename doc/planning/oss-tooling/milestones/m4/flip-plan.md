# Jaiship-only delivery flip — critical path

Status: active (owner directive 2026-11-18). Owner of record: CEO agent under
user-delegated autonomous authority.

## Definition of done

A real ticket is delivered end-to-end with jaiship commands only:

- no `deliver-ticket.sh` and no `ceo-loop.sh` on the path;
- provider selection, quota handling, and peak-window parking come from
  Jaiship policy, not shell profiles or a pre-iteration hook;
- merge and closeout run through the primitives, not a platform CLI;
- the installed binary is a stable artifact, not a shim into a worktree;
- the agent prompts mandate the primitives, and the old entry points are thin
  wrappers that internal delivery does not use.

## Why this is its own track

M3 gives the harness port and the adapter contracts, but the internal delivery
path still shells out to `deliver-ticket.sh`, `ceo-loop.sh`, shell provider
profiles, and a pre-iteration hook. The engine already carries most of the
machinery (`dispatch` with `--harness`/`--resume-prompt`/attempts, `daemon`,
`coordinator-loop`, `lanes`, `supervise`, `merge`, `closeout`, `queue`,
`provider resolve|quota|parks|profile|watch`, `spend`). The flip is wiring,
parity, and repair — which is why it can land ahead of the remaining adapter
set instead of waiting for M3 to close.

## Current gap

| Concern | Today | Target |
|---|---|---|
| Spawn and supervise one ticket | `deliver-ticket.sh` shells out to the harness | `jaiship dispatch <ref>` |
| Outer loop and liveness | `ceo-loop.sh` | `jaiship loop` (over the delivered supervision engine) |
| Provider, quota, peak, cost | shell profiles plus a pre-iteration hook | `jaiship` provider policy in configuration |
| Merge | `gh pr merge` plus manual recovery | `jaiship merge` |
| Issue close, worktree prune, queue removal | manual | `jaiship closeout --apply` |
| Installed entry point | dev shim execing a file in a lane worktree | `jaiship install` with build identity and a rollback slot |
| Agent instructions | mandate the shell entry points | mandate the primitives |

## Stages and tickets

| Stage | Story | Ticket | Depends on |
|---|---|---|---|
| F0 | Installable, versioned binary | GH-346 (M4-S1) | — |
| F1 | Dispatch parity (one command replaces the lane) | GH-347 (M4-S9) | F0, M3-S1 |
| F2 | Provider policy: quota, peak, cost routing | GH-350 (M4-S4) | F0, M3-S1 |
| F3 | CEO loop supervision inside jaiship | GH-348 (M4-S10) | F1 |
| F4 | Merge, closeout, queue repair | GH-349 (M4-S11) | F0 |
| F5 | Agent prompts on Jaiship primitives | GH-351 (M4-S7) | F1, F2, F3, F4 |
| F6 | Jaiship-only dogfood, thin wrappers | GH-352 (M4-S8) | F1-F5 |

F1 and F2 both sit on the harness port (M3-S1) because both need per-spawn
resolution: F1 for supervision, F2 for provider/model injection. F3 and F4 are
disjoint surfaces and may run in parallel once F0 and F1 are settled.

## F1 parity contract

The dispatch result taxonomy is the contract the loop and the classifier
already depend on. The parity battery must replay all eleven classes:
`merged`, `pr-open`, `pr-open-unverified`, `blocked`, `failed`, `finished`,
`max-restarts`, `state-unverified`, `partial`, `noop-lane-permission`,
`noop-lane-nothing-to-do`. Three known defects are on this path and are fixed
inside F1: concurrent admission (two dispatches, one dies with attempts=0),
resume short-circuit when the recorded attempt is pr-open, and classifier poll
exhaustion that reports success or PARTIAL on unverified tracker state.

## F2 cost and provider policy requirements

- Prefer sunk-cost subscription quota over pay-per-token providers when both
  are eligible.
- Park on declared peak windows (weekday 06:00-10:00Z today) instead of burning
  quota or paying peak rates; the policy engine evaluates this per spawn.
- Never retry against an exhausted provider: park with a typed reason and the
  next eligible timestamp, and verify balance live because cached balances lag
  top-ups.
- Attribute spend per ticket, phase, lane, role, and model so a delivery can be
  compared across providers.
- Budgets and alarms park the lane rather than overspend.
- Credentials stay env-only: configuration stores environment variable names,
  never values.
- Migration reads the legacy shell profiles and the hook once as a
  compatibility input and then removes the runtime dependency.

## Sequencing amendment

- M3-S5 (GH-339, conformance and parity suite) stays in flight; it is the
  harness the flip's parity work builds on.
- M3-S2 (GH-336 Jira), M3-S3 (GH-337 GitLab), and M3-S6 (GH-340 multi-tracker)
  start after the flip gate (F1-F4) is green, or when a lane is free and no
  flip work is ready. They are not on the flip's critical path.
- M4-S2 (namespace), M4-S5 (projects), and M4-S6 (history export) follow the
  flip; they do not block it.
- The milestone gate is amended for this period: flip work in M4 runs
  concurrently with the open M3 milestone, recorded here and in the M3 ranking.

## Verification bar per stage

| Stage | Bar |
|---|---|
| F0 | clean-profile install; dirty or mid-change repository still delivers; upgrade reversible; version+commit reported; worktree target refused |
| F1 | eleven-class replay battery; two concurrent dispatches admit; resume over a pr-open attempt continues; poll exhaustion never reports success |
| F2 | policy simulation reproduces documented routing; a delivery runs with the hook and profiles disabled; spend attributable per dimension |
| F3 | loop start/stop/status/log/reset parity; durable stop across restarts; single instance; stuck session restarted |
| F4 | merge lands with crafted metadata without a platform CLI; DIRTY/BEHIND returns a typed sync-required result; closeout is idempotent |
| F5 | prompt conformance scan green; shell-orchestrator imperatives absent |
| F6 | 10 dispatches or 5 days, at least 8 of 11 result classes, one resume, one blocked, one parallel pair, zero shell fallbacks |

## Risks and mitigations

- **Parallel CLI conflicts.** F0 touches build/install; F1 and F2 both touch
  dispatch composition. Run F0 alone, then F1 and F2 serially, then F3 and F4
  in parallel.
- **Classifier parity is the hardest part.** Fixture replay first, live
  observation second; no result class is claimed green without a recorded
  fixture or run.
- **Policy migration creep.** The legacy profiles are read once as input and
  are never written; the hook is removed from the path, not from disk.
- **Prompts are the real gate.** Until F5 lands, the shell path remains
  authoritative for the agents, so F5 must ship before F6's evidence window
  starts.
