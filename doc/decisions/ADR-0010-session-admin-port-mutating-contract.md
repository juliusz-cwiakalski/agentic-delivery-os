---
id: ADR-0010
decision_type: adr
status: Proposed
created: 2026-10-31
decision_date: null
last_updated: 2026-10-31
summary: "Keep ADR-0003's SessionStore read-only and add a separate public SessionAdminPort (extends the read surface with prune and reboot) on the already-admitted adapters ./session subpath; the opencode CLI is the only access path, deletes go one official command per leaf/cold/non-live candidate, reboot is one bounded WAL checkpoint with zero live sessions and no process kill, and every field remains metadata-only under ADR-0003 C-11."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os CLI session-database administration
decision_scope: repo
review_date: null
business_impact: "Gives the operator one typed, dry-run-by-default admin path to reclaim unbounded session-store growth without a second ad-hoc SQL path, and keeps the published metadata-only guarantee intact."
customer_impact: "No behavior change for read-only consumers of SessionStore; operators gain prune and reboot on the existing `ados db` command family."
classification:
  domains: [architecture, privacy, security, operations]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: medium
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-180)"
  decider: "Juliusz Ćwiąkalski (human; owner acceptance and the ADR-0003 C-11 privacy sign-off are pending at the GH-180 PR)"
  contributors:
    - "@spec-writer (GH-180 spec §4.1–§4.2, §5, DEC-D3/DEC-D4)"
    - "@readiness-reviewer (GH-180 readiness iter-1 finding M5)"
    - "@decision-advisor (analysis and record)"
  reviewers:
    - "@reviewer"
    - "Owner (human acceptance; privacy sign-off under ADR-0003 C-11)"
  performers:
    - "@coder (GH-180 implementation)"
    - "@doc-syncer (phase-7 reconciliation reference)"
  informed:
    - "ADOS operators"
    - "M1-S11 harness adapters"
    - "Session lifecycle consumers"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "The owner decides the ADR-0003 C-11 privacy sign-off at the GH-180 PR: record the outcome and any conditions on SessionAdminPort output fields."
  - "A consumer needs descendant-aware pruning, retention scheduling, automatic pruning, or a process restart: those are out of scope here and require a new decision."
  - "The opencode CLI changes or removes `db path`, `db \"<SQL>\" --format json`, `session delete`, or the WAL-checkpoint behavior, or its delete cascade differs from the pinned expectation: revisit DC-3/DC-4, not the port split."
  - "The session store schema changes the current message/part store (for example `session_message` becomes current): revisit the read set and DM shapes."
  - "Liveness needs a PID, lock-file, or host probe, or a window other than 15 minutes: reopen DC-4 rather than adding an out-of-band probe."
  - "The packages leave private 0.0.0 and the first public release lands (ADR-0009): confirm the additive surface ships as a minor and that any later removal is treated as breaking."
  - "A second session backend or a non-opencode harness needs the same admin surface: revisit whether the port or its implementation is the reusable boundary."
links:
  related_changes: ["GH-180"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-10/2026-10-31--GH-180--db-session-admin-port/chg-GH-180-spec.md"
    - "doc/spec/features/feature-adapter-ports.md"
    - "doc/spec/features/feature-session-database-admin.md"
  contracts:
    - "packages/core/src/contracts/session.ts"
    - "packages/adapters/src/session/index.ts"
  diagrams: []
  decisions: ["ADR-0003", "ADR-0009"]
  experiments: []
  metrics: []
  roadmap_items: []
---

# ADR-0010: Separate Mutating `SessionAdminPort` from the Read-Only `SessionStore`

## Context

ADR-0003 DEC-6 defines `SessionStore` as "read-only access to foreign session databases for `db` administration; never a mutation path", and C-11 makes the metadata-only guarantee a public API obligation because `packages/adapters` is published. ADR-0003 also requires an explicit privacy sign-off before the `db` administration engine ships.

GH-180 delivered that engine. The opencode session store had grown to roughly 120 GiB with several thousand sessions and hundreds of thousands of messages, and there was no supported admin surface: bloat was managed by ad-hoc scripts, and hand-written deletion risked damaging live work because `session.parent_id` has no foreign key and descendants do not cascade.

The delivered change keeps `SessionStorePort` read-only (`size`, `list`) and adds a sibling `SessionAdminPort` that extends the read surface with `prune` and `reboot`. Both live in `core ./contracts`; the implementation lives in the already-admitted `adapters ./session` subpath and reaches the database only through the opencode CLI. Production code contains no direct SQLite binding for the session store, no process kill, and no sidecar deletion.

The change also introduces a semver-visible additive surface on a published subpath. Prior decisions name `SessionStore` but not a mutating sibling, so an explicit record is required. This record is the additive reconciliation of ADR-0003 DEC-6/C-11; ADR-0003 is not rewritten.

- The readiness gate (GH-180 readiness iter-1, finding M5) required an ADR-0003 reconciliation or a decision-record proposal for the mutating admin port, including its public-contract/semver impact and the C-11 gate.
- The `db` command family ships dry-run by default and mutates only with `--apply`.
- The ADR-0003 C-11 privacy sign-off is recorded in GH-180 as an owner merge gate; no approval is claimed.

## Problem Framing (Clarified)

The problem is not "how do we delete rows". It is: **how does a public, published I/O contract gain a mutating capability without (a) turning the read-only contract into something that can mutate, (b) weakening the metadata-only privacy guarantee, or (c) inventing a second, schema-coupled access path?**

Three forces collide:

1. **Contract honesty.** A consumer that receives a `SessionStore` must be able to reason that it cannot delete or checkpoint. If mutation is added to the same surface, that reasoning becomes false and the previously stated "never a mutation path" guarantee is silently withdrawn.
2. **Privacy obligation.** C-11 binds every field surfaced by session inspection to a metadata-only whitelist. A new mutating path that echoes candidate rows is still an output surface and must inherit the same bound.
3. **Schema authority.** The session schema is owned by opencode, not by ADOS. Deleting rows or checkpointing through a local SQLite binding would make ADOS responsible for opencode's cascade, migration, and locking semantics.

The clarified decision question: *where does mutation live, and through which path, such that the read-only contract stays true and the published privacy guarantee stays enforceable?*

## Constraints (Hard Requirements)

### C-1: The read-only session contract stays read-only

- **Statement:** `SessionStorePort` (the delivered form of ADR-0003's `SessionStore`) must expose only `size` and `list`; no mutating operation may be reachable through the read-only port or its type.
- **Source:** prior decision — ADR-0003 DEC-6.
- **Verification:** code review plus contract type test.
- **Negotiable:** no.

### C-2: Metadata-only output

- **Statement:** Every field surfaced by either session port is on the ADR-0003 C-11 whitelist (identifiers, counts, byte sizes, timestamps, booleans, the runtime-resolved database path, declared flags and counts). No titles, prompts, message bodies, part data, transcripts, credentials, environment values, command arguments, or raw rows beyond the whitelist.
- **Source:** prior decision — ADR-0003 C-11 metadata-only clause.
- **Verification:** tests (canary-secret zero-occurrence and field-whitelist assertions) plus recorded privacy sign-off.
- **Negotiable:** no.

### C-3: The C-11 privacy sign-off gate is preserved

- **Statement:** The `db` administration engine does not ship without the explicit ADR-0003 C-11 privacy sign-off; no record, spec, or agent may claim that sign-off on the owner's behalf.
- **Source:** prior decision — ADR-0003 C-11.
- **Verification:** audit of the owner sign-off before merge.
- **Negotiable:** no.

### C-4: One access path and a port home

- **Statement:** Product code reaches the opencode session store only through the opencode CLI (`db path`, `db "<SQL>" --format json`, `session delete <id>`, `PRAGMA wal_checkpoint(TRUNCATE)`); no direct `node:sqlite`, `bun:sqlite`, `better-sqlite3`, or equivalent binding for the session store. Core stays runtime-neutral, and every engine I/O operation lands behind a core port implemented in an admitted adapters subpath.
- **Source:** prior decision — ADR-0003 DEC-1/DEC-6; GH-180 spec NG-D4/DEC-D3.
- **Verification:** boundary checks (`depcruise`, ambient-globals, secret-read boundary), the content-inventory marker check, and code review.
- **Negotiable:** no.

### C-5: Packaging envelope unchanged

- **Statement:** No new package, subpath, entry point, dependency, lockfile change, or runtime-API location. `@delivery-os/adapters/session` and the core `./contracts` subpath are the only homes used.
- **Source:** prior decision — ADR-0003 DEC-1/DEC-6.
- **Verification:** `exports-parity` check, dependency-cruiser rules, and package manifest review.
- **Negotiable:** no.

### C-6: Destructive-operation bounds

- **Statement:** `prune` deletes only leaf, cold, non-live sessions, one `opencode session delete <id>` per candidate, with candidate conditions re-asserted immediately before each delete; it never rewrites or deletes the database, WAL, or SHM, and never issues raw `DELETE`/`DROP`/`TRUNCATE`/`VACUUM`/DDL. `reboot --apply` performs at most one bounded WAL checkpoint and only when zero live sessions exist; it never kills, signals, suspends, or restarts a process.
- **Source:** GH-180 acceptance criteria and spec §5.4; NG-D2/NG-D3.
- **Verification:** behaviour tests (per-candidate delete, leaf guard, live gate, single checkpoint) plus code review.
- **Negotiable:** no.

### C-7: Additive public contract

- **Statement:** Existing public exports are not removed or semantically changed; a consumer of the read-only port keeps compiling and behaving identically.
- **Source:** internal standard — release/versioning policy (ADR-0009 lockstep line); GH-180 `version_impact: minor`.
- **Verification:** `exports-parity`, typecheck, and review of the fixed-group minor changeset.
- **Negotiable:** no.

> **Table-stakes (acknowledged once):** all surviving alternatives are git-native, commit no secrets, add no proprietary license, introduce no cloud surface, and deliver through a pull request to `main-tools`.

## Decision Drivers

Prioritized (highest first). These are continuous preferences, not pass/fail gates.

**Safety drivers**
1. **D-1 — Never damage live work.** A deletion or checkpoint must not harm a session a human or agent is actively using; when in doubt, do less.
2. **D-2 — Least-privilege reasoning.** A consumer holding a read-only handle must be able to prove it cannot mutate.

**Contract drivers**
3. **D-3 — Contract clarity.** Mutation should be discoverable as a distinct capability, not inferred from a boolean or a side effect.
4. **D-4 — Minimal additive surface.** Grow the published API only where a real consumer needs it; keep the increment semver-minor and reversible in one revert.

**Architecture drivers**
5. **D-5 — Single schema authority.** Let opencode own its schema, cascade, and locking; ADOS owns policy and presentation.
6. **D-6 — Privacy by construction.** Make the metadata-only bound a property of the types and the seam, not a discipline applied at each call site.

**Operational drivers**
7. **D-7 — Operability and cognitive load.** One command family, dry-run default, one injected seam, deterministic output, easy to test with fakes.
8. **D-8 — Testability and reversibility.** Pure policy in core, I/O behind an injected seam, no real database in tests.

## Decision Rights (DACI)

| Role | Party |
|------|-------|
| Driver | `@decision-advisor` (GH-180) |
| Decider / Approver | Juliusz Ćwiąkalski (owner) — acceptance and the C-11 privacy sign-off pending at the GH-180 PR |
| Contributors | `@spec-writer` (spec §4.1–§4.2, §5, DEC-D3/DEC-D4); `@readiness-reviewer` (finding M5); `@decision-advisor` (analysis) |
| Required reviewers | `@reviewer`; owner (privacy sign-off, C-11) |
| Performers | `@coder` (implementation, already delivered); `@doc-syncer` (phase-7 references) |
| Informed | Operators; M1-S11 harness adapters; session lifecycle consumers |

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| `SessionStorePort` exposes only `size` and `list`. | FACT | `packages/core/src/contracts/session.ts` | C-1 would be violated at the type level. | High |
| `SessionAdminPort extends SessionStorePort` and adds only `prune` and `reboot`. | FACT | `packages/core/src/contracts/session.ts` | Mutation surface would exceed the decision. | High |
| The adapter reaches the store through `opencode db path`, `opencode db "<SQL>" --format json`, `opencode session delete <id>`, and one `PRAGMA wal_checkpoint(TRUNCATE)`, via `execFile`. | FACT | `packages/adapters/src/session/index.ts` | C-4 would be violated. | High |
| No session-store SQLite binding and no kill/signal call exist in the session adapter or the `db` command. | FACT | grep of `packages/adapters/src/session/index.ts`, `packages/cli/src/commands/db.ts` (2026-10-31) | C-4/C-6 would be violated. | High |
| ADR-0003 DEC-6 states `SessionStore` is read-only and "never a mutation path". | FACT | ADR-0003 §DEC-6 | The reconciliation target would be wrong. | High |
| ADR-0003 C-11 requires an explicit privacy sign-off before the `db` administration engine ships. | FACT | ADR-0003 §C-11 | C-3 would be unfounded. | High |
| No prior decision names a mutating session-admin port. | FACT | `doc/decisions/**` scan (2026-10-31) | A duplicate decision already existed. | High |
| The packages are `private: true` at version `0.0.0`; the additive surface is semver-visible when the package line publishes. | FACT | `packages/*/package.json`; ADR-0009 | The semver impact would be overstated or understated. | High |
| A fixed-group minor changeset covers the increment. | FACT | `.changeset/db-session-admin-minor.md` | Release grouping could drift from the decision. | High |
| `opencode session delete` cascades message/part/session_message/session_share/session_input/session_context_epoch/todo rows. | ASSUMPTION | GH-180 spec §3.4; the change relies on opencode's own implementation | Orphaned rows would accumulate and repeats would not converge as claimed. | Medium |
| `PRAGMA wal_checkpoint(TRUNCATE)` through `opencode db` is safe when zero sessions are inside the activity window. | ASSUMPTION | GH-180 spec §3.5 | A checkpoint could contend with an active-but-quiet writer. | Medium |
| Activity-based liveness (15-minute window, no PID/lock probe) is an adequate definition of "live" for prune and reboot. | ASSUMPTION | GH-180 spec §3.4 (RSK-D12) | An open-but-idle session older than the threshold could be pruned. | Medium |
| No pre-publication consumer depends on the absence of a mutating port. | ASSUMPTION | No external consumers exist at 0.0.0 private | The change would be breaking rather than additive. | Medium |
| The exact scope and conditions of the C-11 privacy sign-off. | TO-CONFIRM | Owner decision pending at the GH-180 PR | Ship/no-ship gate remains open. | Low |
| Long-term stability of the opencode CLI command surface and its delete cascade. | TO-CONFIRM | No opencode version pin in this decision | Coupling could break on an opencode upgrade. | Low |
| Behavior when a second opencode host writes while `prune` or `reboot` runs. | TO-CONFIRM | Not exercised by this change | A concurrent writer could invalidate the pre-delete re-check assumptions. | Low |

No external data was sent to a model or researcher for this record; all evidence is repository-local.

## Mental Models & Techniques Used

- **First principles:** separate capability (read) from effect (mutate) because they carry different risk and different reasoning burdens.
- **Inversion:** ask what would make this unsafe — mutating through the read handle, a direct DB path, an unbounded delete, or a process kill. Each is excluded by a constraint.
- **Second-order thinking:** a second access path would eventually fork schema knowledge and privacy enforcement; a single CLI path concentrates the coupling in one seam.
- **Systems thinking:** the port split is a boundary in the type system, the privacy whitelist is a boundary in the output, and the CLI is a boundary in the process model; all three must align.
- **Opportunity cost:** every extra public interface is a permanent compatibility cost; only `prune` and `reboot` earn a place.
- **KISS / cognitive load:** dry-run default, one command family, one injected seam, no scheduler, no PID probe.
- **Premortem (light):** the plausible failure is an idle-but-open session pruned under activity-based liveness, or an opencode upgrade changing delete/checkpoint semantics; both are recorded as residual risks and revisit triggers.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 | C-2 | C-3 | C-4 | C-5 | C-6 | C-7 |
|---|---|---|---|---|---|---|---|
| Alt 0 — Do nothing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Alt 1 — Mutate through `SessionStore` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Alt 2 — Direct SQLite binding | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Alt 3 — Separate `SessionAdminPort` (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Alt 4 — Independent admin port, no extension | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Alt 5 — CLI-internal mutation, no public port | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |

Legend: ✅ = passes · ❌ = fails.

### Alternative 0 — Do Nothing / Keep the Ad-Hoc Scripts

- **Eligibility:** Eligible (passes C-1 … C-7).
- **Summary:** Ship no admin port; leave pruning and inspection to hand-written `opencode db` / `opencode session list` scripts, as today.
- **Constraint compliance:** Passes C-1 … C-7 trivially — there is no new public surface, no mutation capability, and the sign-off gate is not triggered. The metadata-only obligation remains unowned for ad-hoc script output.
- **Driver fit:** Fails D-1 (hand-written deletion can orphan children when a parent is removed), D-3 (no typed capability), D-6 (no enforced metadata bound), D-7 (repeatable, operator-specific scripts), and D-8 (untestable).
- **Pros:** Zero surface growth; zero new coupling; nothing to sign off.
- **Cons:** The 120 GiB problem persists; the schema's lack of foreign keys makes ad-hoc deletion unsafe; the published metadata-only obligation has no enforcement point; every operator reinvents the path.
- **Why rejected/chosen:** It solves nothing that triggered the decision and leaves the highest-risk operation (deletion) in the least-governed place. Rejected on D-1 and D-6.

### Alternative 1 — Mutate Through `SessionStore`

- **Eligibility:** Not eligible (fails C-1 and C-7).
- **Summary:** Add `prune` and `reboot` to the existing `SessionStore`/`SessionStorePort` interface.
- **Constraint compliance:** Fails C-1 directly — ADR-0003 DEC-6 states `SessionStore` is "never a mutation path", and the read-only guarantee is a published contract. Fails C-7 because it changes the semantics of an existing public type: an existing consumer's proof that it cannot mutate becomes false. C-2/C-3 could still be honored, and C-4/C-5/C-6 are implementation-independent.
- **Driver fit:** Weak on D-2 (read-only reasoning is destroyed) and D-3 (mutation becomes ambient); nominally strong on D-4 (no new interface) but at the cost of the contract.
- **Pros:** Smallest nominal type count; one handle for an admin caller.
- **Cons:** Reopens an accepted decision's guarantee; breaks least-privilege; every read-only consumer now holds mutating capability; the semver impact is a semantic (breaking) change, not additive.
- **Why rejected/chosen:** Eliminated by C-1/C-7. The apparent surface saving is the exact guarantee the published contract exists to provide.

### Alternative 2 — Direct SQLite Binding

- **Eligibility:** Not eligible (fails C-4 and C-5).
- **Summary:** Open the session database with `node:sqlite`, `bun:sqlite`, or `better-sqlite3` and issue `DELETE`/checkpoint statements directly from an adapter.
- **Constraint compliance:** Fails C-4 — the decision and the change forbid any direct binding for the session store and require the opencode CLI as the only access path. Fails C-5 if a native driver dependency is added (a new dependency and a runtime-specific location; `better-sqlite3` also conflicts with the Bun/Node neutrality rule).
- **Driver fit:** Attractive on D-5 at first glance (fewer process hops) but inverts it: ADOS would become the owner of opencode's schema, cascade, locking, and migration. Strong on D-8 in tests, weak on every safety driver.
- **Pros:** Fastest path; full SQL control; no subprocess.
- **Cons:** Schema and cascade ownership move to ADOS; WAL/locking correctness becomes ADOS's problem; a native dependency; violates the runtime-neutral core rule if placed wrongly; duplicates a schema authority that opencode already provides.
- **Why rejected/chosen:** Eliminated by C-4/C-5 and rejected on D-5: it trades a bounded process boundary for permanent schema ownership.

### Alternative 3 — Separate `SessionAdminPort` Extending the Read Surface *(selected)*

- **Eligibility:** Eligible (passes C-1 … C-7).
- **Summary:** Keep `SessionStorePort` as `size`/`list`; add `SessionAdminPort extends SessionStorePort` with `prune` and `reboot`; implement both in `adapters ./session` over an injected `OpencodeSessionIo` that shells out to the opencode CLI; keep the pure candidate/liveness policy in core.
- **Constraint compliance:** C-1 — the read port is untouched and exposes no mutating method. C-2 — every payload is a closed type on the C-11 whitelist; the seam returns parsed rows that are reduced to typed facts in the adapter. C-3 — the gate is preserved and unclaimed. C-4 — the only path is the opencode CLI, core is data-only, and the I/O sits in an admitted subpath. C-5 — no package, subpath, dependency, or entry-point change. C-6 — leaf/cold/non-live selection with a pre-delete re-check, one delete per candidate, at most one bounded checkpoint, no kill, no sidecar deletion. C-7 — additive: the existing type is unchanged.
- **Driver fit:** Best on D-1 (bounded destructive operations with a re-check), D-2 (read handle still proves no mutation), D-3 (a distinct capability name), D-5 (opencode owns the schema), D-6 (metadata-only expressed in the payload types), D-7 (one command family, dry-run default), and D-8 (pure policy plus an injected seam). Acceptable on D-4: one extra interface, but the smallest increment that is honest about the capability.
- **Pros:** Preserves every prior guarantee; the split is discoverable in the type system; one implementation backs both ports; fakes are trivial; the additive changeset is a minor.
- **Cons:** One more public interface; extending the read surface means an admin consumer also sees `size`/`list` (acceptable — those are safe reads); the surface is coupled to the opencode CLI.
- **Why rejected/chosen:** Chosen. It is the only option that satisfies every constraint without paying a permanent cost in schema ownership or in the read-only guarantee.

### Alternative 4 — Independent Admin Port, No Extension

- **Eligibility:** Eligible (passes C-1 … C-7).
- **Summary:** `SessionStorePort` stays `size`/`list`; a *standalone* `SessionAdminPort` declares `prune` and `reboot` only, and consumers that need both hold two handles.
- **Constraint compliance:** Satisfies C-1 … C-7: no mutation on the read port, the same metadata bound, the same CLI path, the same packaging envelope, the same destructive bounds, and additive-only.
- **Driver fit:** Slightly better than Alt 3 on D-4 (no inherited read methods on the admin handle) and D-3 (the admin type is exactly the mutating capability). Slightly worse on D-7 (every admin consumer must compose and inject two ports, and the adapter must expose two objects or a composite) and on the duplication risk if the two surfaces drift.
- **Pros:** Purest capability separation; the admin type names only effects.
- **Cons:** Two injection points for the same store; read methods must be duplicated or re-injected alongside; more composition wiring in the CLI edge; no behavioral benefit over Alt 3 because the reads it would exclude are already safe.
- **Why rejected/chosen:** Rejected on D-7 and D-3's discoverability trade: inheritance keeps one implementation and one composition while still making the mutating capability explicit. This is a close second and a reasonable successor if a future consumer must be prevented from even reading.

### Alternative 5 — CLI-Internal Mutation, No Public Port

- **Eligibility:** Not eligible (fails C-4).
- **Summary:** Implement `prune`/`reboot` as adapter or CLI functions used only by the `db` command; expose no port in the published contracts.
- **Constraint compliance:** Fails C-4's port-home clause: ADR-0003 DEC-6 requires an engine's I/O to land behind a core port implemented in an admitted adapters subpath; a CLI-internal effect path would be a second I/O home with no typed contract. C-1/C-2/C-3/C-5/C-6/C-7 could otherwise be satisfied.
- **Driver fit:** Strong on D-4 (no public surface) and D-6 if output stays whitelisted; weak on D-3 (mutation is not a discoverable capability), D-7 (the command becomes the only integration point), and D-8 (the effect is harder to fake at the port boundary).
- **Pros:** Smallest published surface; no compatibility obligation for the mutation.
- **Cons:** Breaks the port pattern the rest of the codebase follows; future harness or agent consumers would either re-import internals or duplicate the path; weakens testability at the seam.
- **Why rejected/chosen:** Eliminated by C-4 and rejected on D-3/D-8.

## Decision

- **Decision:** Adopt **Alternative 3**: keep ADR-0003's read-only `SessionStore` semantics in `SessionStorePort`, and add a separate public `SessionAdminPort` on the already-admitted `@delivery-os/adapters/session` subpath that extends the read surface with `prune` and `reboot`.
- **Rationale (tied to drivers):** The split preserves the published read-only guarantee (D-2, C-1) while making mutation explicit (D-3), keeps opencode as the single schema authority (D-5, C-4), inherits the metadata-only bound into the payload types (D-6, C-2), and adds only one interface (D-4, C-7). Destructive operations are bounded by construction (D-1, C-6). The cost is one extra public type and a dependency on the opencode CLI surface — both accepted and recorded below.
- **Decider:** Juliusz Ćwiąkalski (owner). Acceptance and the ADR-0003 C-11 privacy sign-off remain pending at the GH-180 PR; this record does not claim them.
- **Conditions for revisit:** See front-matter `revisit_triggers`; the nearest are the C-11 sign-off outcome, an opencode CLI/schema change, and the first public release.

### DC-1 — Read-only and admin are two ports

`SessionStorePort` exposes `size` and `list` only. `SessionAdminPort extends SessionStorePort` and is the only place `prune` and `reboot` exist. Both are declared in `core ./contracts` as data-only TypeScript interfaces; no behavior enters the contracts tier.

### DC-2 — Mutation is exactly `prune` and `reboot`, dry-run by default

Both mutating operations are dry-run unless `--apply` is present. `prune` selects cold, non-live, leaf sessions; `reboot` performs at most one checkpoint. No other mutating operation is added by this decision, and descendant-aware pruning, retention scheduling, `VACUUM`, and process restart are explicitly out of scope.

### DC-3 — The opencode CLI is the only access path

The adapter reaches the store through `opencode db path`, a single-statement `opencode db "<SQL>" --format json`, one `opencode session delete <id>` per candidate, and `opencode db "PRAGMA wal_checkpoint(TRUNCATE)"`. The executable and environment arrive as injected data; the adapter reads no ambient environment. No direct SQLite binding is used for the session store. The `OpencodeSessionIo` seam is adapter-local and is not a core contract.

### DC-4 — Destructive bounds are part of the contract

A prune candidate is cold (older than the threshold), outside the 15-minute activity window, and a leaf; the conditions are re-asserted immediately before each delete. The database file, WAL, and SHM are never deleted or truncated by `prune`. `reboot --apply` performs one bounded checkpoint and only when zero sessions are inside the window; it never kills, signals, or restarts a process, and never removes a sidecar. Liveness is activity-based only; there is no PID or lock-file probe. That narrowing is a deliberate, owner-visible limitation, not an implementation detail.

### DC-5 — The C-11 metadata-only clause binds the admin port too

ADR-0003 C-11 names `SessionStore` and `HostPort` in its metadata-only clause. This record extends the same clause, by composition, to every field surfaced through `SessionAdminPort`: identifiers, parent identifiers, counts, byte sizes, timestamps, booleans, the runtime-resolved database path, and declared flags/counts. The C-11 privacy sign-off remains a required gate before the `db` administration engine ships.

### Reconciliation with ADR-0003

This record is **additive**. It does not rewrite, supersede, or amend the text of ADR-0003.

- **DEC-6 stays literally true.** `SessionStore` is still read-only and never a mutation path. This record adds a *sibling* capability rather than widening `SessionStore`; the "any widening of what they surface is a semver-visible change" clause is therefore not triggered for `SessionStore` or `HostPort` — neither type changes.
- **The published-surface growth is the new interface, not a widened one.** Adding `SessionAdminPort` to the already-published `adapters ./session` subpath is an additive (minor) change under the lockstep line. Removal after publication would be breaking; nothing here removes or alters an export.
- **C-11's gate is not relaxed.** The sign-off requirement, the field whitelist, and the redaction-before-output rule continue to apply, now explicitly to the admin port as well.
- **The `db` engine composes both ports.** ADR-0003 described `SessionStore` as the read surface "for `db` administration"; it did not claim that a read-only store is the engine's entire contract. The engine now holds a read-only store and, separately, an admin port.

### Constraint Compliance Attestation

The chosen alternative satisfies **C-1, C-2, C-4, C-5, C-6, and C-7** at the contract and implementation level, verified by the delivered type surface, the CLI-only seam, and the destructive-bound tests.

**C-3 is satisfied as a preserved gate, not as a completed condition.** The decision keeps the ADR-0003 C-11 sign-off mandatory, records it as an owner merge gate, and makes no claim that it is granted. No accepted-risk exception is taken: no constraint is violated, and C-3 remains an open owner condition whose outcome will be recorded when decided.

## Trade-offs & Consequences

### Positive Outcomes

- The published read-only guarantee remains true and provable in the type system; a consumer holding `SessionStorePort` cannot mutate.
- Mutation is discoverable as a named capability rather than an inferred side effect.
- ADOS does not take ownership of opencode's schema, cascade, locking, or migration.
- The metadata-only bound is carried by closed payload types and asserted by tests, so privacy enforcement is a property of the seam.
- The CLI becomes the only product-code admin path; no engine grows a private SQL path.
- Dry-run defaults, leaf-only pruning, a pre-delete re-check, and one bounded checkpoint make the destructive surface small and re-run safe.
- The increment is additive (minor) with no package, subpath, or dependency change.

### Negative Outcomes

- One additional public interface (`SessionAdminPort`) and its payload types become permanent compatibility surface.
- Because `SessionAdminPort` extends the read surface, an admin consumer also receives `size`/`list`; this is safe but is not the purest possible capability split.
- Liveness is activity-based only. An open-but-idle session older than `--older-than` is a prune candidate; the "never delete a live session" guarantee holds only under the narrowed definition.
- `reboot` prepares the database (checkpoint) but does not restart the host; the operator still performs a manual restart. This intentionally deviates from the fallback that would have killed/restarted the process.
- The surface is coupled to the opencode CLI's command names and delete-cascade semantics. An opencode upgrade can change behavior underneath a stable ADOS contract.
- No retention policy, scheduler, or automatic pruning exists; growth management remains operator-initiated.

### Residual Risks (for owner acceptance at the GH-180 PR)

| ID | Risk | Why accepted | Mitigation / trigger |
|----|------|--------------|----------------------|
| R-1 | Activity-based liveness can prune an open-but-idle session outside the 15-minute window. | A PID/lock probe would add a host-coupled, unverifiable dependency; the pre-delete re-check and the threshold already bound the common case. | Surfaced in the CLI output and the change spec; revisit DC-4 if a real idle-session deletion is observed. |
| R-2 | `reboot` is checkpoint-only; the operator can still run a host with the old process. | Killing or restarting a process is a larger, harder-to-reverse action than the ticket needs. | The human output states the manual restart step; revisit if operators ask for an automated restart. |
| R-3 | Dependence on the external opencode CLI and its undocumented-in-ADOS cascade semantics. | It is the only schema-authoritative path that keeps C-4 satisfied. | Revisit DC-3/DC-4 on any opencode change; no version pin is asserted here. |
| R-4 | The ADR-0003 C-11 privacy sign-off is not yet granted. | Acceptance is an owner decision; the change supplies the evidence but must not claim the gate. | Owner sign-off at the GH-180 PR before merge; record the outcome in a follow-up update or successor record. |
| R-5 | Concurrent opencode hosts writing during `prune`/`reboot` are not exercised. | The pre-delete re-check narrows the race and skip-on-change is safe. | Revisit if a real concurrent-host incident occurs. |

### Unresolved Questions

- [ ] What are the exact scope and conditions of the ADR-0003 C-11 privacy sign-off? (owner, at the GH-180 PR)
- [ ] Should the opencode CLI version be pinned or a minimum version asserted, given R-3? (owner / future change)
- [ ] Is activity-based liveness sufficient in practice, or does a later change need a host-level probe? (owner / revisit on evidence)
- [ ] The `doc/decisions/00-index.md` inventory does not list ADR-0008 and ADR-0009 (pre-existing; GH-186 scope). This record adds only the ADR-0010 row and does not rewrite other rows. (owner / GH-186)

## Implementation Plan

Delivered by GH-180; this record ratifies and bounds the contract rather than commissioning new work.

1. **Contracts (delivered).** `SessionStorePort` (`size`, `list`) and `SessionAdminPort extends SessionStorePort` (`prune`, `reboot`) in `core ./contracts`, with closed payload types and `as const` vocabulary. No behavior in the contracts tier.
2. **Pure policy (delivered).** Cutoff, live boundary, candidate predicate, ordering, capping, and result assembly in `core` domain, shared by selection and the pre-delete re-check.
3. **I/O (delivered).** `OpencodeSessionIo` in `adapters ./session`, CLI-only, with injected executable, environment, clock, and stat seam; both ports implemented there.
4. **CLI (delivered).** `ados db` grammar validation before I/O, dry-run default, `--apply`-only mutation, single serializer and redaction chokepoint at the edge.
5. **Release shape (delivered).** One fixed-group minor changeset; no package, subpath, entrypoint, or dependency change.
6. **Pending at the PR (not performed here).** Owner acceptance of this record and the C-11 privacy sign-off; the record stays `Proposed` until the owner decides.
7. **Phase-7 follow-through (owned by PM/`@doc-syncer`, out of this record's edit scope).** Reference ADR-0010 from the feature specs and ensure the command registry reflects the delivered `db` surface.

**Guardrails during any follow-up work:** do not widen `SessionStorePort`; do not add a direct SQLite path for the session store; do not add process signals; do not surface a field outside the C-11 whitelist; do not add a scheduler or retention policy without a new decision.

## Verification Criteria

| Signal | Target | Window |
|--------|--------|--------|
| Read-only port purity | `SessionStorePort` has exactly `size` and `list`; no mutating member (contract test + review) | Every PR touching the contract |
| Metadata-only output | Canary secret appears zero times; field-whitelist assertion rejects any extra field; the assertion fails when redaction is removed | Every PR touching the session adapters or `db` command |
| Access-path discipline | No `node:sqlite`/`bun:sqlite`/`better-sqlite3` in session product code; no kill/signal call; boundary and content-inventory checks green | Every PR touching the session adapters |
| Destructive bounds | Per-candidate `opencode session delete`; leaf/cold/non-live re-check; zero sidecar deletions; at most one checkpoint with zero live sessions | Every PR touching `prune`/`reboot` |
| Packaging envelope | `exports-parity` green; no new package/subpath/entrypoint/dependency; fixed-group minor changeset present | At merge and release |
| Additive contract | Existing public exports unchanged; typecheck green for read-only consumers | At merge and release |
| C-11 gate | Owner privacy sign-off recorded before merge | GH-180 PR (none claimed at authoring) |

## Confidence Rating

**Medium.**

The contract-level reasoning is well grounded: the current type surface, the CLI-only seam, and the destructive bounds are repository facts, and the constraint set is inherited from an accepted R3 decision rather than invented. Confidence is capped by three open items: the C-11 sign-off is undecided, the opencode delete-cascade and concurrent-host behavior are external and unpinned, and activity-based liveness is a deliberate narrowing whose real-world adequacy is unproven. No AI-generated confidence is treated as evidence.

## References

- [GH-180 change specification](../changes/2026-10/2026-10-31--GH-180--db-session-admin-port/chg-GH-180-spec.md) — §1 (overview, deviation), §3.4–§3.5 (prune/reboot rules), §4.1–§4.3 (components, ports, seam), §5 (security and boundaries), §10 (DEC-D1…DEC-D11), §9.2 (risks).
- [GH-180 readiness review, iteration 1](../changes/2026-10/2026-10-31--GH-180--db-session-admin-port/readiness-review/readiness-iter-1.md) — finding M5 (decision capture for the mutating admin port).
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — DEC-1/DEC-6 (monorepo layout, adapter contract, `SessionStore`), C-11 (privacy and data-lifecycle baseline, metadata-only clause).
- [ADR-0009](ADR-0009-release-model-v1.md) — lockstep release line and versioning posture that makes the additive surface a minor.
- Contract: [`packages/core/src/contracts/session.ts`](../../packages/core/src/contracts/session.ts) — `SessionStorePort`, `SessionAdminPort`, payload types.
- Implementation: [`packages/adapters/src/session/index.ts`](../../packages/adapters/src/session/index.ts) — `OpencodeSessionIo` and the port implementations.
- Current truth: [adapter ports](../spec/features/feature-adapter-ports.md), [session database administration](../spec/features/feature-session-database-admin.md).
- Release artifact: [`.changeset/db-session-admin-minor.md`](../../.changeset/db-session-admin-minor.md).
