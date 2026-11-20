# M4 — Jaiship-native delivery (planning draft)

Status: **draft for review** (planning PR GH-333). Owner directive 2026-11-17.
Scope source: `backlog.md` (this pack). Depends on: **M3** (harness and tracker
integrations).

## Goal

The installed Jaiship binary performs all delivery for this repository and for
every managed project — no coupling to the source tree, no shell orchestrator
doing lifecycle work, and models used only where judgment is required. New
iterations are delivered by the installed binary; the source repository is
built and re-installed only at explicit, decided points. The shell entry
points remain only as thin compatibility wrappers that call `jship` under the
hood.

## Exit criteria (verified on the installed binary)

- **EC-1 Installed-binary delivery.** Versioned, self-contained install
  performs all delivery; repository edits have zero effect until an explicit
  upgrade; install/upgrade/rollback follow [install-model.md](install-model.md)
  and use only Jaiship namespaces.
- **EC-2 Namespace migration.** No `delivery-os` identifiers remain in the
  product surface (binary, config/state directories, environment prefix,
  package/CLI names in docs and prompts); conformance scan prevents
  reintroduction; idempotent migration for existing installations.
- **EC-3 Command conformance.** `merge`, `dispatch`, `queue`, `closeout`,
  `phase`, `commit`, `status`/`brief`, `history` pass the documented
  conformance battery on the installed binary, with a regression test per
  named defect (merge primitive, dispatch admission race, resume
  short-circuit, phase artifact/registry divergence, commit subject and
  commitlint probe, merge-queue conflicts).
- **EC-4 Declarative provider policy.** Quota watch targets, peaks, chains,
  pacing goals (intensify unused subscription quota before reset; judgment on
  subscription; execution on pay-per-token; exhausted -> pay-only),
  per-project overrides, and budgets/alarms live only in Jaiship
  configuration; delivery needs no shell hook.
- **EC-5 Project-scoped queues.** A project is a named set of repositories
  with its own backlog view, priorities, queue, and pacing overrides; projects
  deliver in parallel; every event carries project identity; history filters
  by project or list.
- **EC-6 History and statistics export.** Versioned machine-readable contract
  (ticket start/end, phase timings, outcomes, spend, durations; planned,
  in-flight, delivered) via CLI/JSON, additive-only evolution.
- **EC-7 Agents on Jaiship primitives.** Prompts call Jaiship commands only;
  no shell-orchestration imperatives; conformance scan prevents regression.
- **EC-8 Dogfood window and shell entry-point rewrite.** Delivery runs
  exclusively through the installed binary for the evidence window (>= 20
  dispatches or 7 days, all 11 result classes, zero unresolved divergence,
  zero shell fallback). The shell entry points (`deliver-ticket.sh`,
  `ceo-loop.sh`) are rewritten as thin wrappers over `jship` and are not used
  internally for development.

## Decisions recorded (owner directive 2026-11-17)

- **D1.** M2 is finalized first (S16 #293 stays in M2); M3 (integrations)
  precedes M4.
- **D2.** Rename depth: everything moves to the Jaiship identity — package
  scope, environment prefix, configuration and state directories, docs and
  prompts. The GitHub repository name is unchanged.
- **D3.** "Getting rid of deliver-ticket.sh" means it is no longer the internal
  delivery engine: it is rewritten to call `jship` under the hood and remains
  only as a compatibility wrapper. Removal is a later decision (M5).
- **D4.** History/statistics are CLI/JSON output and files with a versioned
  contract; no embedded server or presentation layer in this repository.
- **D5.** Project model: a project owns its issue trackers plus queue and
  pacing state (owner decision 2026-11-17).
- **D6.** Install model: local user install from the cloned repository for
  now — one self-contained binary in `~/.jaiship/bin/jaiship`, config in
  `~/.jaiship/`, state in `~/.jaiship-state/`, project-local config in
  `<repo>/.jaiship/`; no legacy pre-Jaiship paths. Design:
  [install-model.md](install-model.md).

## Sequencing

- Wave 1: M4-S1 + M4-S2 (install model + namespace migration).
- Wave 2: M4-S3 + M4-S4 (command repair/conformance + provider policy).
- Wave 3: M4-S5 + M4-S6 (projects, then the history contract).
- Wave 4: M4-S7 + M4-S8 (agent prompts, then dogfood + wrapper rewrite).

## Delivered stories

| Story | Ticket | Delivered surface |
|---|---|---|
| M4-S1 Installable, versioned binary | GH-346 | The `build:binary` artifact, the `install` lifecycle family, the state-format compatibility check, and the removal matrix. |
| M4-S10 CEO loop supervision inside jaiship (flip stage F3) | GH-348 | The `loop start\|stop\|status\|log\|reset` family as a composition profile over the delivered supervision engine under `loop-main`, with the two-signal stuck verdict, the durable stop, the declared backoff, the bounded log, and the offline parity battery. Current truth: [feature-loop-supervision.md](../../../../spec/features/feature-loop-supervision.md); reference page: [commands/loop.md](commands/loop.md). `scripts/ceo-loop.sh` stays present and executable as the documented fallback. |

Prompt re-pointing (M4-S7 / flip stage F5, GH-351) and the dogfood window with
thin wrappers (M4-S8 / flip stage F6, GH-352) remain owned by those stories in
`backlog.md` and `flip-plan.md`.

## Non-goals

- Presentation-layer, hosted-service, billing, or multi-tenant work.
- GitHub repository rename.
- Removing the compatibility wrappers (a later decision).

## Risks

| Risk | Mitigation |
|---|---|
| Rename churn across docs/tests/prompts | One mechanical change + conformance scan |
| Installed-vs-source confusion | Build identity in every envelope; documented PATH precedence; dev builds isolated |
| State migration breakage | Idempotent migration, dry-run, backup |
| Quota API instability | Conservative pacing fallback, cached decisions |
| Command-hardening scope creep | Bounded regression tests per named defect |

## Open questions

None at present. Install channel and project model are decided (D5, D6);
package-manager channels and per-project planning documents remain out of
scope for M4.
