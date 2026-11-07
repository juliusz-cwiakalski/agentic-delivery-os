---
ados_distribution: internal
id: SPEC-COMMIT-PRIMITIVE
status: Current
created: 2026-11-06
last_updated: 2026-11-06
owners: ["engineering"]
service: delivery-os
summary: "The delivered commit primitive: a `commit` command that computes a conventional commit from the working tree plus change context (deterministic skeleton, precise staging, deterministic safety, one constrained message call behind an ordered transport seam with a marked template fallback), default-on atomic record-plus-commit inside `phase complete` with per-call and per-project opt-outs, total four-state re-run convergence over durable commit-intent evidence, the `commit.telemetry` state-layer record kind, the typed `commit.phaseCommit` configuration key, and the five `commit.*` error identities."
links:
  related_changes: ["GH-227"]
  related_decisions: ["ADR-0003", "ADR-0005", "TDR-0005"]
  contracts:
    - "packages/core/src/contracts/commit.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/core/src/state/commit-telemetry.ts"
---

# Feature: Commit Primitive

## Overview

The commit primitive turns the commit act into one tool capability. `commit [<ref>] [--phase <phase>] [--dry-run]` computes a conventional commit from the working tree plus change context: the ref, type candidate, scope, staging set, exclusions, and safety verdicts are computed facts; only the language part of the message comes from exactly one constrained model call, and even that call degrades to a deterministic, visibly marked template when no inference transport is available. `phase complete <ref> <phase>` lands the ledger transition and the conventional commit as one act by default, with `--no-commit` and the project-level `commit.phaseCommit` key as the opt-outs.

Four properties define the surface. Staging is precise: tracked pending work is staged with scope drift disclosed, untracked work is staged only inside a declared scope, and untracked material outside every declared scope is a stray that is never staged. Safety is deterministic and never AI: the security scan, forbidden-path exclusions, and the binary size guard run over the candidate staging set before any transport is selected and before anything is staged, and a scan that cannot run refuses the operation. Convergence is total: a re-run classifies the durable delta between the persisted transition record (which for an atomic completion carries the landed commit SHA) and the persisted commit telemetry event, and completes exactly the missing side. Telemetry is durable and non-gating: one `commit.telemetry` record per landed commit carries the commit identity, message provenance, transport, and token spend.

The primitive is a CLI surface. It performs local staging and local commit-object creation only, never pushes, and refuses to run inside a delivery session. It consumes the [result contract](feature-result-contract.md) envelope, error table, and `{0, 1, 2}` projection; the [phase command family](feature-pm-notes-lint-and-phase-transitions.md) write path and its nine-row idempotency matrix; the [machine-readable delivery plan](feature-plan-schema.md) for declared phase scope and phase summaries; the [state layer](feature-state-layer.md) for the verified ledger and the additive telemetry record kind; the [configuration layer](feature-config-layer.md) for the typed disable key; and the [provider engine](feature-provider-engine.md) availability facts behind the core-owned inference transport.

## Business Context

### Problem Statement

- **Problem:** The commit act is agent-managed. A subagent loop performs many git round-trips with diff output echoed through context every turn, so the mechanical majority of a commit — ref resolution, type, scope, staging, safety, the commit itself — is paid for in tokens and latency. Commit discipline (message shape, ref fidelity, staging precision) depends on the agent's care, and a phase transition and its commit are separate acts performed by different roles, so a transition can land without its commit and a stray untracked file can reach history.
- **Affected users:** Lifecycle agents and humans landing phase work, the delivery engine that reads the phase ledger, and later spend reporting that needs per-commit evidence.
- **Value:** Commits become deterministic, cheap, conventional, safety-scanned, and auditable. A phase transition and its commit land together or neither lands, and message quality, transport failover, and per-commit spend become durable, reportable facts.

### Goals & Success Metrics

- **Primary goal:** Let a caller land a precise conventional commit — and complete a phase atomically — without agent authorship of the message or the staging set.
- **KPIs:** exactly one model call per commit attempt (zero when the staging set is empty, fully excluded, or the template is taken); 100% of landed subjects at or under 72 characters; zero untracked strays staged; zero empty commits; zero duplicate ledger records from re-runs; every landed commit carries one telemetry event.

## User Experience & Functionality

### Command surface

`commit` is a top-level command. `phase complete` is the transition-centric entry to the same atomic act.

| Invocation | Outcome | Exit |
|---|---|---|
| `commit [<ref>]` | Lands one computed conventional commit for the stageable pending work of the working tree. The ref comes from the argument when given, otherwise from the embedded ref resolver (the production composition derives it from the branch name). | `0` committed; `1` staging blocked, commitlint failure, safety STOP, session refusal; `2` platform fault |
| `commit [<ref>] --phase <phase>` | Atomic record-plus-commit for that phase's pending work: the staging scope is the plan phases the lifecycle phase maps to (`delivery` covers every delivery-kind plan phase, `delivery_planning` the planning-kind phases; other lifecycle phases have no plan-phase correspondence and degrade with `plan-absent`), and the invocation runs the same atomic primitive as `phase complete`. | `0` landed; `1` as above; `2` atomic abort (neither side landed) |
| `commit [<ref>] --dry-run` | Prints the computed message, staging set, and exclusion disclosures; stages nothing, commits nothing, appends no ledger record, emits no telemetry. | `0` |
| `phase complete <ref> <phase>` | Default-on atomic ledger transition plus conventional commit. | `0` completed (with or without a commit); `1` invalid phase, safety STOP, staging blocked, commitlint failure, session refusal; `2` atomic abort, safety scan unavailable, ledger unreachable |
| `phase complete <ref> <phase> --no-commit` | Records the transition alone with durable intent `record-only` and basis `opt-out-flag`. | `0` |

Grammar resolves through `input.value.rejected` (exit `1`) before any runtime call: an unknown phase id, a ref that does not match the work-item shape, or a surplus positional argument. `--phase` composes with `--dry-run`; `--dry-run` belongs to the `commit` surface only.

The `commit` success envelope carries `changeRef`, `subject`, an optional `body` (present only when one was produced), `stagedFiles`, `excluded` (`forbiddenPaths`, `oversizedBinaries`, `untrackedNotStaged`, `noiseStripped`, `scopeDrift`), an optional `commitSha`, `messageSource` (`model` or `template`), `transport` (`core-inference`, `harness-one-shot`, or `none`), `atomic` (true in phase mode), `safety` (`completed` plus the finding classes), `telemetry` (`emitted` plus an optional `detail`), an optional `ledgerTransition`, an optional `dryRun`, an optional `commitSkipped: "skipped-no-pending-work"` (a phase-mode dry run previewing a transition-only outcome), and an optional `degradedScope: "plan-absent"`. In phase mode a compiled phase runtime supplies `ledgerTransition` as `{ phase, timestamp }` from the landing; an invocation that computes the phase act without that path (a dry run, or an embedded composition without the phase runtime) cites `{ phase, noOp: true }`.

Human output renders the same facts deterministically: the dry-run banner, the subject and body, the staged paths, one group per exclusion class, the scope-drift group, the message source, the transport, the commit identity when present, the atomic marker, and a telemetry note when the event was not recorded. Path ordering uses an explicit `en` collation; no path, ordering, or byte depends on a clock, the environment, or the process locale.

A phase-mode invocation that lands the transition alone or is an already-completed no-op returns success with no `commitSha`, and its `ledgerTransition` cites the phase. A phase-mode dry run over a tree with no stageable work is a success that discloses `commitSkipped: "skipped-no-pending-work"` and the empty staging set, previewing the real transition-only outcome rather than refusing.

### Deterministic context and skeleton

The tool resolves the ref and reads the change context: the current phase folded from the verified ledger (the `delivery` lifecycle phase when a plan artifact exists and no completion is recorded yet), the plan's per-phase declaration (title, summary, declared scope paths), the working-tree status (`porcelain=v1 -z` with all untracked files expanded), budget-capped diff hunks, and the last five commit subjects for tone. Tree reads stay bounded: binary detection inspects only the first 8000 bytes of each file, and tracked pending diffs are retrieved in one batched `git diff` split per path instead of one child process per file. Generated noise (lockfiles, minified files, `dist/`, `vendor/`, `node_modules/`) is stripped from the model bundle deterministically; a file over the per-file diff cap contributes name-status metadata only, up to eight stageable files are diffed in full while the input budget lasts, and the total bundle stays inside the shipped input budget.

The skeleton is computed, never generated: the resolved ref, the ref source (`argument`, `branch`, or `change-folder`), the type candidate from the phase/type table, the scope (always the ref), the breaking default (`false`), and the phase id when phase-centric. The phase/type table ships as core data across the canonical lifecycle vocabulary — delivery → `feat`, review_fix → `fix`, system_spec_update → `docs`, dor_check/quality_gates/dod_check/pr_creation → `chore`, and `docs` for the planning phases — with `chore` as the documented default for a phase outside the table. An empty or fully excluded staging set makes no model call at all.

### Message generation and validation

Exactly one constrained model call carries the bundle. Its output is schema-constrained to `{subject, body, breaking}` with temperature `0.1`, an output cap of 512 tokens, subject cap 72 characters, and body cap 1200 characters. The model may omit the body; a body is required when the staging set spans more than one top-level area (more than one distinct first path segment), because a multi-area change is auditor-relevant.

Validation is deterministic plus the repository's own rules. It checks that the subject parses as a conventional header, that the type is in the allowlist and equals the computed candidate, that the scope equals the resolved ref, that the breaking marker matches the message flag, that the subject and body stay inside their caps, and that no tracker reference other than the resolved ref survives — fabricated references are stripped mechanically before validation. When the repository configures commitlint, its verdict is consulted and its errors count as validation errors; absent configuration degrades to the deterministic checks only. A failed attempt is retried exactly once with the validation errors fed back into the next call. A second failure falls back to the deterministic template `<type>(<ref>): <plan-phase summary, first staged path, or "update the change workspace">`, capped at the subject limit. A template that still violates the repository's commitlint configuration aborts the commit with `commit.commitlint-failed`; nothing is staged or committed.

### Inference transports and the template fallback

The single model call runs behind a transport port, tried in order. Core-owned inference is tried first: it sends the bundle through the shared provider HTTP edge with credentials resolved through the credential port, consuming injected availability facts, and a quota-parked route falls through without waiting. The harness one-shot is tried second: a CLI-level headless invocation in a freshly created empty project directory whose only input is the prompt file, with a sanitized environment and no delivery-session facts, removed after the attempt including on failure. When neither transport is available or every available transport fails, the deterministic template is used and the outcome records `messageSource: template` with `transport: none` and zero token spend. Every failover is classified with a reason and carried in the telemetry event. The CLI composition injects the transport ports and availability facts; the shipped default composition declares no available route, so an installation without a configured transport still lands a marked template commit instead of stalling.

A template commit is a success (`exit 0`) whose data and event carry `messageSource: template`. It is never a failure identity.

### Precise staging and deterministic safety

The staging set is computed from the working-tree facts, never guessed:

- Tracked pending work is staged, including work outside the declared scope; scope drift is disclosed in `excluded.scopeDrift` so it stays observable rather than silently dropped or silently committed.
- Untracked files are staged only when they fall inside the declared scope (the plan phases the target lifecycle phase maps to in phase-centric mode, the union of every declared plan-phase scope in standalone mode). `delivery` maps to every delivery-kind plan phase and `delivery_planning` to the planning-kind phases; a lifecycle phase with no declared correspondence degrades to the `plan-absent` scope instead of borrowing another phase's scope. Untracked material outside every declared scope is a stray: excluded as `stray` and disclosed in `excluded.untrackedNotStaged`.
- Forbidden paths (`tmp/`, `.ai/local/`, `.env` files, private key filenames) and oversized binaries (over 1 MiB) are excluded and disclosed as `forbiddenPaths` and `oversizedBinaries`.
- Without a plan artifact the scope source is `plan-absent`, the scope is empty, and the envelope discloses `degradedScope: "plan-absent"`: tracked work is staged with drift disclosed and untracked work is not staged.

The deterministic safety pass runs over the candidate staging set before any transport is selected and before anything is staged. It scans content and filenames for secret-shaped material and checks the forbidden-path and binary guards. A suspected secret — confirmed or not — STOPs the operation with `commit.safety.secret-suspected` (exit `1`), reporting finding classes and paths but never the material, and the identity is not retryable so no caller can blind-retry it. A safety pass that cannot execute fails closed with `commit.safety.scan-unavailable` (exit `2`). Forbidden-path and oversized-binary findings are staging exclusions, not STOP classes. Only content that passed the scan enters the bundle, so secret-suspected material never reaches a provider or the headless one-shot.

A standalone invocation whose staging set is empty — everything pending is stray, forbidden, or excluded — refuses with `commit.staging-blocked-untracked` (exit `1`) without selecting a transport. A phase completion in the same situation lands the transition alone; it never creates an empty commit.

### Atomic phase completion

`phase complete` performs the ledger transition and the conventional commit as one act by default when the composed runtime includes the commit extension. The ordering is binding: compute the staging set, run the safety pass, build the bundle from scanned content, select a transport, generate and validate the message, stage precisely, create the commit object, append the transition record with durable intent `atomic` in the same ledger append, then write the pm-notes entry and replace the derived projection. The commit object and the ledger append are the atomic pair: a failed commit object or a failed append resets the checkout to the pre-act head with a mixed reset and returns `commit.atomic-abort` (exit `2`, `not_landed`), so neither side lands and a re-run converges through the normal path; a failed staging returns the same identity with no commit object and no record.

Opt-outs keep the caller's control:

| Opt-out | Durable intent | Envelope disclosure |
|---|---|---|
| `phase complete <ref> <phase> --no-commit` | `record-only` / `opt-out-flag` | `commitSkipped: opt-out-flag` |
| Project configuration `commit.phaseCommit: false` | `record-only` / `config-disabled` | `commitSkipped: config-disabled` |
| Completion with no stageable pending work | `record-only` / `skipped-no-pending-work` | `commitSkipped: skipped-no-pending-work` |

A per-call flag relaxes the default only; it never overrides an explicit project disable. A no-op completion of an already-completed phase appends no record and creates no commit; its envelope carries `commitSkipped: no-op`, which is envelope-only and never written durably.

### Re-run convergence

Every completion record carries the landing's durable commit intent as fields of its own ledger append: `commitIntent` (`atomic` or `record-only`) and, for record-only landings, `commitIntentBasis` (`opt-out-flag`, `config-disabled`, or `skipped-no-pending-work`). An atomic completion record also carries `commitSha` — the landed commit's identity known at append time because the commit object precedes the record — so the record is the authoritative evidence carrier, not merely the intent carrier. The telemetry event's emission is non-gating, so it corroborates commit presence; it is never the sole evidence. A re-run reads durable evidence only — the persisted transition record for the phase (after any reopen, with its commit SHA) and the persisted telemetry event for that phase whose transition identity matches the record (or, for a commit-only state, whose landing is after the last reopen). A record-bound SHA counts as commit-present when the commit object exists; a failed or torn telemetry read with no record-bound SHA classifies as a platform fault, never as commit-absent. Commit presence is never inferred from the current HEAD: a later phase's commit moving HEAD leaves an earlier phase's landed evidence intact. The delta is total over the four (record × commit) states:

| Record | Commit | Outcome |
|---|---|---|
| absent | absent | Normal path: atomic completion, or the record-only opt-out when configured or flagged |
| present, intent `atomic` | absent | Complete the missing commit from the phase's pending work; no new record; `reconciliation.completed: commit` disclosed. With no pending work left, converge as a no-op disclosing `commitSkipped: interrupted-atomic-no-pending-work`. |
| present, intent `record-only` | absent | Intentional record-only: no-op convergence citing the stored basis (`reconciliation.completed: intentional-no-op`); no commit and no new record |
| absent | present | Append the missing transition through the existing write path, carrying the known commit SHA in that record; no re-commit (`reconciliation.completed: transition`) |
| present | present | No-op citing the existing completion (`commitSkipped: no-op`, `reconciliation.completed: existing-completion`); no record and no commit |

A both-landed phase re-run is the row-2 no-op no matter how many later commits have moved HEAD. The stale derived projection is never consulted for idempotency, and no-op completions never manufacture a commit.

### Commit telemetry

Every landed commit — standalone, atomic, or reconciled — emits one telemetry event: an additive `commit.telemetry` record kind inside the existing state schema with payload schema `delivery.commit.telemetry.v1`, appended through the state port under the store-scoped key `commit.telemetry:<REF>` with one freshly acquired fence. The payload carries the change ref, the phase id when phase-centric, the commit identity, message source, transport, token spend (zero for the template), the landing timestamp, the transition identity for atomic completions, and any recorded failovers. Payloads are metadata only: never message bodies, diff content, or secret material. Emission is non-gating — a failed append is disclosed in `data.telemetry` and never fails the landed commit. Verified reads return one change's history with the state layer's evidence; the events corroborate convergence (the record-bound SHA is primary), and no derived projection document exists.

### Configuration

The configuration catalog declares one typed `commit` branch: `commit.phaseCommit` (boolean, default `true`). Setting it to `false` disables the atomic commit for the project; `commit.phaseCommit` resolved from any layer participates through ordinary origin reporting.

### Error identities

Six rows sit under the `commit` domain kind in both the machine error table and the documented table, sync-bound by the same invariant as every other kind:

| Code | Category | Retryable | Exit | Fires when |
|---|---|---|---|---|
| `commit.staging-blocked-untracked` | user | false | `1` | Nothing stageable remains for the requested commit (all pending material is stray, forbidden, or excluded) |
| `commit.commitlint-failed` | user | false | `1` | Neither the retried model message nor the deterministic template satisfies commitlint |
| `commit.safety.secret-suspected` | user | false | `1` | The secret scan flagged candidate content or a filename on suspicion; human review required |
| `commit.safety.scan-unavailable` | platform | true | `2` | The deterministic safety pass could not run; nothing is staged or committed |
| `commit.atomic-abort` | platform | true | `2` | The atomic act aborted; the clean abort restored both sides to neither-landed |

### Session context

The commit surface runs inside a delivery session: `commit`, `commit --dry-run`, `commit --phase`, and `phase complete` with or without `--no-commit` proceed under the primitive's normal grammar, safety, staging, and atomicity rules. The startup path injects no delivery-session facts into `commit` or `phase complete`, and the retired session-refusal identity is not returned. The harness one-shot still runs in its own sanitized, temporary empty project context with no delivery-session facts, and that context is removed after the attempt. `phase list` and `phase reopen` are unaffected.

## Technical Architecture & Codebase Map

| Path | Responsibility |
|---|---|
| `packages/core/src/contracts/commit.ts` | The runtime-neutral vocabulary: commit intents and bases, message sources, transports, the telemetry kind and schema id, the five error codes, conventional types, the phase/type table, constrained-output caps, diff-budget and noise/forbidden data, exclusion and safety classes, skeleton/bundle/staging/message/safety/transport/envelope/telemetry types, and the git, safety, commitlint, transport, and session-fact ports. Types and `as const` data only. |
| `packages/core/src/domain/commit-skeleton.ts` | Pure skeleton computation: phase→type candidate, scope = ref, breaking default, documented default type. |
| `packages/core/src/domain/commit-staging.ts` | Pure staging-set computation and disclosures: tracked-with-drift, declared-scope untracked, strays, forbidden paths, oversized binaries, scope source. |
| `packages/core/src/domain/commit-bundle.ts` | Deterministic model bundle: noise stripping, per-file cap, top-N full diffs, total input budget, normalized and sorted paths. |
| `packages/core/src/domain/commit-safety.ts` | Safety verdict classification: secret suspicion STOPs; a scanner failure is fail-closed; finding classes never carry material. |
| `packages/core/src/domain/commit-message.ts` | Sanitization, invented-ref stripping, deterministic validation (header, type, scope, caps, body criterion, commitlint), message rendering, and the deterministic template. |
| `packages/core/src/domain/commit-transport.ts` | Ordered selection and classified failover over injected availability facts and transport ports; zero calls when the template is selected. |
| `packages/core/src/domain/commit-converge.ts` | Total four-state delta classification over durable evidence. |
| `packages/core/src/domain/commit-act.ts` | The single shared act: staging, safety, bundle, transport, validation, staging execution, commit object, transition append, abort reset, and telemetry emission over injected ports. |
| `packages/core/src/state/commit-telemetry.ts` | The `commit.telemetry` ledger: store-scoped key, fenced append, verified history read, payload validation; no runtime API and no projection. |
| `packages/core/src/state/registry.ts` | The delivery registry: intent-carrying `phase.transition` append (one append), presence-tolerant verified reads, pure fold, atomic projection replace. |
| `packages/adapters/src/git/commit.ts` | The git commit seam: fixed-argv, no-shell, local-only child processes with bounded timeouts; tree facts with an 8000-byte binary probe, batched tracked-file diffs, budget-capped hunks, pathspec staging, commit-object creation, head read, and mixed reset for abort. |
| `packages/adapters/src/file/secret-scan.ts` | The deterministic scanner over committed content and filename patterns and the forbidden/binary guards; a read failure reports unavailable. |
| `packages/adapters/src/file/commitlint.ts` | Repository commitlint discovery and the bounded `--edit` probe; absent configuration reports `absent`. |
| `packages/adapters/src/session/commit-one-shot.ts` | The harness one-shot transport: temporary empty project directory, prompt file only, sanitized environment, bounded invocation, temp removal including on failure. |
| `packages/adapters/src/session/delivery-session-facts.ts` | Edge-injected delivery-session facts over declared environment keys. |
| `packages/adapters/src/inference/index.ts` | The core-owned inference transport: provider HTTP edge plus credential port, schema-constrained response parsing, classified failures, token-spend extraction. |
| `packages/cli/src/commands/commit.ts` | The `commit` command: grammar, session guard, ref resolution, context read, skeleton and scope selection, the shared act, and the success envelope. |
| `packages/cli/src/commands/phase.ts` | The phase family with the atomic completion extension: grammar-first validation, staged lint, durable evidence read, convergence, atomic act, pm-notes write, projection replace, and the completion envelope. |
| `packages/cli/src/output/commit-text.ts` | Deterministic human rendering of a commit outcome from the same data. |
| `packages/cli/src/edge.ts` | Composition root: git seam, scanner, commitlint probe, transports and availability, session facts, the phase commit extension, telemetry append/read, and the `commit` command registration. |
| `packages/testkit/src/commit/**` | Dev-only harness: temporary real git repositories, transport fakes, and an in-process runner. |

### Invariants

- Tier: contracts are data-only; the domain tier is runtime-neutral and imports contracts only; the state tier imports contracts and its own modules. Runtime and I/O access live only at the declared edges — the git seam, the file scanner and commitlint probe, the session adapter, the inference subpath, the CLI build, and the dev-only testkit harness — each as an exact, reason-bearing entry.
- Ordering: the staging set, the safety pass, and the bundle are computed before any transport is selected, and nothing is staged before the safety pass completes.
- Safety is never AI and is fail-closed: a suspicion STOPs, an unavailable scan refuses, and no model output can approve, suppress, or perform a safety decision.
- Every verifiable message part is computed and validated; generated text cannot change the type, the scope, or the ref, and fabricated tracker references are removed.
- Staging precision: no untracked stray is staged, no forbidden path is staged, no oversized binary is staged, and no empty commit is created.
- Atomicity and convergence: the commit object and the ledger append land together or neither lands on the clean-abort path; re-runs converge over durable evidence with no duplicate record and no manufactured commit.
- Telemetry is additive, metadata-only, and non-gating; emission failure never fails a landed commit.
- Exit projection: success → `0`, user validation and STOP → `1`, platform faults and aborts → `2`. Handlers never choose exits or write streams; the CLI edge owns rendering and projection.
- Brands arrive through the injected identity; no product or binary name literal exists in the delivered modules or docs.

## Non-Functional Requirements

| Concern | Current guarantee |
|---|---|
| Model-call economy | Exactly one constrained call per generation attempt (a failed attempt is retried once with the validation errors); zero calls when the staging set is empty or fully excluded, and zero when the template is selected. |
| Constrained output | Subject ≤ 72 characters, body ≤ 1200 characters, breaking flag required; decoding at temperature `0.1` with a 512-token output cap. |
| Latency | Dry-run p95 under 2 s and template-fallback p95 under 5 s on the reference environment; a model-transport commit is bounded by the provider call. |
| Determinism | Identical tree state, context, and injected dependencies yield identical dry-run output; paths are normalized and sorted, and rendering reads no clock, environment, or locale. |
| Privacy | Only safety-scanned content enters a model bundle; generated noise is stripped before any model sees it; the one-shot loads no project context; telemetry carries metadata only. |
| Bounds | Diff bundles stay inside the shipped input budget; git children are bounded and killed on timeout; the commitlint probe caps reported errors. |

## Related

- [PM-Notes Lint and Phase Transitions](feature-pm-notes-lint-and-phase-transitions.md) — the phase command family, the nine-row idempotency matrix, and the transition record the atomic completion extends.
- [Result Contract and Error Table](feature-result-contract.md) — the envelope, the five `commit` rows, the classification chain, and the binding sync check.
- [Machine-Readable Delivery Plan Schema](feature-plan-schema.md) — per-phase declared scope and summaries, the skeleton and staging scope input.
- [State Layer](feature-state-layer.md) — the ledger substrate, verified reads, fences, and the additive record-kind contract behind `commit.telemetry`.
- [Configuration Layer and Inspection](feature-config-layer.md) — the typed `commit.phaseCommit` branch and origin reporting.
- [Provider Engine](feature-provider-engine.md) — the availability facts and provider HTTP edge behind core-owned inference.
- [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md) and [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md) — the runtime-edge allowances for the commit seam and the inference transport.
- [Branding Seam and Working Name](feature-branding-seam.md) — the injected identity behind the CLI surface.
- [Glossary](../../overview/glossary.md) — commit primitive, skeleton, transport seam, message source, staging set, stray, atomic completion, and convergence terms.
