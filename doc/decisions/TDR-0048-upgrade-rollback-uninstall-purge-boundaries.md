---
id: TDR-0048
decision_type: tdr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-18
summary: "Install replaces the artifact atomically through one same-directory staging rename plus one rollback-slot swap, so a failed install always leaves a working install; upgrade is an explicit install of a different compiled artifact with no download and no in-place mutation; `rollback` is an involutive swap of the single `jaiship.previous` slot that refuses anything that is not a compiled artifact and refuses unless the install record can name the artifact it would install; `uninstall` removes the artifact, the slot, the install record, and only the PATH block it owns, always printing exactly what `purge` would delete, while `purge` additionally removes the two Jaiship roots behind an explicit confirmation; every write path has a dry-run that prints the exact plan and writes nothing; and the shell installers keep their own artifact class — binary ownership belongs to `jaiship install`, repository-artifact ownership to `scripts/install.sh`/`scripts/uninstall.sh`, and neither deletes the other's artifacts."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os install surface (operation semantics) and local install tooling"
decision_scope: repo
review_date: null
business_impact: "The install model is only a product model if a failed install cannot break a working one and an operator can go back one step. M4 EC-1 requires explicit, reversible, version-reported upgrades; without these boundaries the installed binary becomes another thing operators are afraid to touch."
customer_impact: "An operator can reinstall the same build without churn, move to a new build and back, remove the command without losing their configuration or delivery history, and see the exact list of what a purge would delete before deciding."
classification:
  domains: [operations, tooling, contracts]
  archetype: policy
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-346: the change specification is blocked on the lifecycle boundaries)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-346 PR review; AI does not accept this R2 record"
  contributors:
    - "@decision-advisor (repository analysis and this record)"
    - "@pm (GH-346 clarify_scope: upgrade explicit/reversible/version-reported; uninstall reports what purge deletes)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-346 PR review — purge is destructive and this record defines its boundary)"
  performers:
    - "@coder (GH-346 delivery: replace, rollback, uninstall/purge, PATH block, dry-run, install record, tests)"
    - "@doc-syncer (local-install guide, doc-distribution page, install-model correction)"
  informed:
    - "M4-S2 namespace migration (the `--migrate` hook resolves into its implementation)"
    - "M4-S8 shell entry-point rewrite (wrapper installation is the shell installers' class)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "An in-place download channel is decided (M4 out of scope today): decide checksum verification and signature policy together, rather than adding a fetch to an operation that currently performs no network access."
  - "More than one rollback step is needed: supersede the single slot with a versioned artifact directory and a retention policy, and state what the delivered slot becomes, rather than keeping two rollback mechanisms."
  - "M4-S2 lands the migration: the `--migrate` typed refusal in §8 becomes a delegation, and the refusal identity is retired in the same change."
  - "Any lifecycle operation must run without a writable home (for example a container image build): decide an explicit destination parameter, which C-5 of TDR-0046 currently forbids."
  - "The shell installers are retired by M4-S8: fold their remaining artifact classes into the family, and delete the two-uninstaller split in §9 rather than leaving a documented empty owner."
links:
  related_changes: ["GH-346", "GH-320"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/guides/local-install.md"
    - "doc/spec/features/feature-doc-distribution-marker.md"
    - "doc/spec/features/feature-cli-entrypoint.md"
    - "doc/planning/oss-tooling/milestones/m4/install-model.md"
  contracts:
    - "packages/cli/src/entrypoint.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "scripts/install.sh"
    - "scripts/uninstall.sh"
  diagrams: []
  decisions: ["TDR-0044", "TDR-0045", "TDR-0046", "TDR-0047"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S1", "M4-S2", "M4-S8"]
---

# TDR-0048: Upgrade, Rollback, Uninstall and Purge Boundaries

## Context

- **FACT:** `install-model.md` fixes the layout (`~/.jaiship/bin/jaiship`, one `bin/jaiship.previous`, `install.json`, `config.yaml`; state in `~/.jaiship-state/`), the atomic-replace shape ("copy to a temporary, then `mv` over the target; keep the prior binary as `jaiship.previous`"), the upgrade model ("rebuild from the desired commit and re-run the installer"), the uninstall/purge split (`--uninstall` removes the binary and `install.json`, `--purge --yes` additionally removes both roots), and the daemon safety rule ("refuse to replace a running daemon unless `--stop-daemon`") (read 2026-11-18).
- **FACT:** No `install.json` exists anywhere in the repository today, and nothing in the product writes or reads it (repository survey, read 2026-11-18).
- **FACT:** The delivered installer writes the launcher idempotently: it compares the rendered content with the existing file and returns without writing when they match; a different source repoints; the write is `staging` → `chmod 755` → `mv -f` in the destination directory (`scripts/install.sh` `install_local_launcher`, read 2026-11-18).
- **FACT:** `scripts/uninstall.sh` removes **repository artifacts** in two modes (global agent/command files and the cloned home, local project copies), documents its own exit codes `0/2/3/4/5`, supports `DRY_RUN`, and contains no binary, launcher, or `~/.jaiship` handling (read 2026-11-18).
- **FACT:** The install-set documentation states, as a property of the launcher step, that "no uninstall path exists" and that the launcher is an operator-owned artifact removed by hand (`doc/spec/features/feature-doc-distribution-marker.md` §The launcher registration in the install set; `doc/guides/local-install.md` "Removing a registered launcher is an operator action", read 2026-11-18).
- **FACT:** The delivered daemon exposes a status read that can determine whether a live instance holds the binary's state (instance record plus heartbeat with a staleness window) and a stop path; the composition receives the daemon entry path for re-entry and for the installed service unit (`packages/cli/src/daemon-compose.ts`, `packages/cli/src/production.ts`, read 2026-11-18).
- **FACT:** `install-model.md`'s destructive forms are flags (`--rollback`, `--uninstall`, `--purge --yes`); TDR-0044 §1 turns them into subcommands and keeps `--dry-run`, `--add-to-path`, `--migrate`, `--stop-daemon` as flags.
- **FACT:** GH-346's AC requires "upgrade is explicit, reversible, and version-reported" and "uninstall removes the entry point and reports exactly what purge would delete" (ticket body, read 2026-11-18).
- **FACT:** Replacing a running executable on POSIX is safe (the inode survives), but a *live daemon* continues to run the previous build after a replace, so a replace without a daemon decision yields two versions in one delivery path.
- **FACT (the defect this record's amendment corrects):** the first wording of §2 step 4 stopped only when the destination identity equalled the running identity **and** the record matched, while §3 called the same run a no-op **by identity comparison**. Two independent faults met in that sentence. The conjunction is one: the reachable step-7-crash state is exactly the state where the clauses disagree — the destination already holds the running artifact, the slot holds the previous artifact, and the record still describes the previous artifact — so step 4 fails, step 5 renames the destination onto the slot, and the still-valid previous artifact is destroyed, silently removing the one rollback step AC-F9-3 and the ticket's "reversible" clause promise. The comparison is the other: an artifact's injected identity is a **compile-time constant inside the binary** (TDR-0045 §2), so "the destination's identity equals the running identity" is not a test any process can perform. Source: Definition-of-Ready iteration 1 on GH-346, `readiness-review/readiness-iter-1.md` finding 1, plus TDR-0045 §2/§4 (read 2026-11-18).

## Problem Framing (Clarified)

Four operations are described by one sentence each in the model, and each sentence hides a decision:

1. **Replace.** "Copy to a temp then `mv`" is only atomic if the temp is on the same filesystem *and* the previous artifact is preserved before the destination is overwritten. The order of the two renames decides what a crash leaves behind: a lost binary with a good slot, or a good binary with a stale slot. One of those is recoverable by re-running install; the other is not obviously recoverable at all. That ordering is a decision, not an implementation detail. A third question hides behind the same step: **what the stop condition is made of.** If the no-op test includes the record, then the one state a crash creates — destination already replaced, record not yet written — is precisely the state in which the test is false, and "recover by re-running install" quietly costs the rollback slot. If the test is "the destination's identity equals the running identity", it is not a test at all: the identity is a compile-time constant inside the artifact. The stop condition must therefore be artifact agreement on content, and the record must be repaired rather than used as a gate.
2. **Upgrade.** "Rebuild from the desired commit" describes a *build*, while the surface that installs is the *artifact*. Under TDR-0045's self-install model the decision is easy — you run the artifact you intend to install — but the wording must be settled, or someone will implement a build inside `install` (which C-7 of TDR-0044 forbids).
3. **Rollback.** One slot is simple until you ask what happens on the *second* rollback, and what the slot may hold. A slot that can hold a launcher restores the defect TDR-0046 removes (that record already forbids it); a slot that is not swapped on rollback stops being a rollback after one use.
4. **Uninstall vs purge.** The only genuinely dangerous operation in the whole story. The model is clear about *what* is removed and silent about *how the operator knows*, which is exactly what the AC requires.

The second half of the problem is ownership. Two installers and two uninstallers would be a documentation failure before it is a code failure: the operator has one machine and needs one answer per artifact class. The delivered shell installer and shell uninstaller own repository artifacts and have a documented, tested contract; the new family owns the binary. The boundary must be stated as a rule, not left to prose in two guides.

## Constraints (Hard Requirements)

### C-1: A failed install never breaks a working install

- **Statement:** Every step before the destination swap is failure-safe (the working artifact and its record are intact), and the destination is only ever replaced by a rename of a fully staged, verified file on the same filesystem.
- **Source:** GH-346; `install-model.md` Safety ("Failed builds never replace a working install"); delivered launcher's staging pattern.
- **Verification:** Test — failures injected at each step leave the destination byte-identical and the record unchanged; a staged file is never left at the destination.
- **Negotiable:** no.

### C-2: Exactly one rollback slot, holding only a compiled artifact

- **Statement:** One `jaiship.previous` exists; rollback swaps it with the current artifact; the slot never holds a bash launcher, and rollback refuses when the slot is absent or lacks an injected build identity.
- **Source:** `install-model.md` Layout; TDR-0046 §5; TDR-0045 §3.
- **Verification:** Test — rollback twice returns to the original artifact; a launcher in the slot is refused; a missing slot is refused.
- **Negotiable:** no.

### C-3: Upgrade is explicit, offline, and version-reported

- **Statement:** An upgrade happens only when the operator runs a different compiled artifact's `install`; no operation downloads, no operation builds, and both the before and after identity are reported.
- **Source:** GH-346 AC; M4 out-of-scope (package-manager channels, auto-update); TDR-0044 C-7.
- **Verification:** Test — an install from the same artifact reports the identity and rewrites nothing; a different artifact reports both identities; a structure assertion proves no network client and no build spawn.
- **Negotiable:** no.

### C-4: `uninstall` never deletes configuration or state

- **Statement:** `uninstall` removes the artifact, the slot, the install record, and only the PATH block this product owns; configuration and state roots survive untouched.
- **Source:** GH-346 AC; `install-model.md` Uninstall; least privilege.
- **Verification:** Test — after `uninstall`, both roots exist with byte-identical content and the PATH block is gone.
- **Negotiable:** no.

### C-5: `uninstall` reports exactly what `purge` would delete

- **Statement:** Every `uninstall` prints the exact residual set `purge` would remove — absolute paths, computed from what exists at that moment — whether or not `--dry-run` was requested.
- **Source:** GH-346 AC ("reports exactly what purge would delete").
- **Verification:** Test — the printed set equals the set `purge --dry-run` prints at the same moment, and equals what `purge --yes` actually removes.
- **Negotiable:** no.

### C-6: `purge` is explicit, confirmed, and never implicit

- **Statement:** `purge` requires an explicit confirmation input; absent it, `purge` refuses with a typed error naming the two roots and the confirmation flag. No other operation removes a config or state root.
- **Source:** C-4/C-5; `install-model.md` (`--purge --yes`).
- **Verification:** Test — `purge` without confirmation refuses and removes nothing; with confirmation removes both roots and reports each path.
- **Negotiable:** the flag's spelling is negotiable; the requirement for an explicit input is not.

### C-7: Every write path has a dry-run that writes nothing

- **Statement:** `install`, `install rollback`, `install uninstall`, and `install purge` each accept `--dry-run`, print the complete plan with absolute paths, and perform no write, no directory creation, and no daemon action.
- **Source:** GH-346 ("dry-run report"); `install-model.md`; the delivered installer's plan-only preview precedent.
- **Verification:** Test — a filesystem snapshot (paths, sizes, mtimes) is unchanged after each dry-run, and the printed plan names every path the real run would touch.
- **Negotiable:** no.

### C-8: One owner per artifact class

- **Statement:** The binary, its slot, and its record belong to `jaiship install *`; repository artifacts (docs, agents, commands, plugin projection, and the legacy launcher when no managed binary exists) belong to `scripts/install.sh` / `scripts/uninstall.sh`; neither surface deletes the other's artifacts, and each names the other when the operator is looking in the wrong place.
- **Source:** Delivered installer/uninstaller scopes; TDR-0044 C-6; GH-346 conventions.
- **Verification:** Test — the shell uninstaller run against a managed install removes no binary and no `~/.jaiship` path; the family never removes a project artifact.
- **Negotiable:** no.

### C-9: Additive persistence

- **Statement:** The only new persisted artifact is the install record (one file inside the config root); no state record kind, no configuration key, and no secret is added, and the record never holds a credential.
- **Source:** GH-346 constraints; `install-model.md` Safety ("never store secrets in `install.json`").
- **Verification:** Review and test — the record schema is asserted; the secret-scan boundary check stays green; no state contract changes.
- **Negotiable:** no.

## Decision Drivers

1. **Recoverability.** A crash at any point must leave an install that still runs.
2. **One step back.** Reversibility is the AC; more than one step is a retention policy this increment does not need.
3. **Operator clarity.** One owner per artifact class, and one printed list before anything destructive.
4. **No surprise deletion.** Configuration and delivery history outlive the command.
5. **Quiet idempotence.** Re-running the same artifact must not churn files, timestamps, or the daemon.
6. **Least privilege.** Writes stay inside the Jaiship namespaces and the operator's shell profile block this product owns.
7. **Paved road.** The delivered launcher's staging-and-compare pattern and the delivered shell scripts' scopes are reused, not replaced.

*(Overlap check: failure safety, single slot, offline explicitness, and the uninstall/purge boundary are gates C-1…C-9; they appear here only as ranking values — "how much recoverability per unit of retained complexity". The gates decide eligibility; the drivers rank the survivors.)*

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-346: the specification is blocked on the lifecycle semantics).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-346 PR review. AI does not accept this R2 record.
- **Contributors:** `@pm` (ticket AC and conventions); `@decision-advisor` (analysis and record); `@spec-writer` (carries the algorithm, the matrix, and the dry-run contract into the change spec and test plan).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`; the owner for acceptance (purge is destructive).
- **Performers:** `@coder` (replace, rollback, uninstall/purge, PATH block, dry-run, record, tests); `@doc-syncer` (local-install guide, doc-distribution page, install-model correction).
- **Informed:** M4-S2 (migration behind `--migrate`), M4-S8 (wrapper installation remains the shell installers' class).

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| The model fixes the layout, one slot, the record, the atomic shape, and the daemon safety rule. | FACT | `install-model.md`, read 2026-11-18 | These would be new decisions rather than preserved mechanics. | High |
| No install record exists today; nothing reads or writes one. | FACT | Repository survey, read 2026-11-18 | The record format would already be a contract. | High |
| The delivered launcher write is staged, chmod-ed, then `mv`-ed in the destination directory, and is content-idempotent. | FACT | `scripts/install.sh` `install_local_launcher`, read 2026-11-18 | The atomicity and idempotence pattern would have to be invented. | High |
| `scripts/uninstall.sh` handles repository artifacts only and documents its own exit codes. | FACT | `scripts/uninstall.sh`, read 2026-11-18 | The ownership split would be a new boundary rather than a preservation. | High |
| The install-set documentation currently states that no uninstall path exists. | FACT | `feature-doc-distribution-marker.md`, `doc/guides/local-install.md`, read 2026-11-18 | No documentation correction would be required. | High |
| A live daemon can be detected through its recorded instance and heartbeat staleness window, and stopped. | FACT | `packages/cli/src/daemon-compose.ts`, read 2026-11-18 | The replace would have to ignore a running daemon, and two builds would coexist. | High |
| Replacing a running executable is safe on POSIX; the running process keeps its inode. | FACT (platform behaviour) | POSIX rename/unlink semantics | A replace would have to stop every process first. | High |
| The destination and the staging file share a filesystem because both live in the install directory. | FACT (by construction of the algorithm) | §2 | A cross-device rename could fail and leave a partial state; the algorithm stages beside the destination precisely to avoid it. | High |
| The operator's shell profile is writable and identifiable when `--add-to-path` is requested. | ASSUMPTION (bounded by the refusal) | — | An unidentifiable shell must refuse typedly, which §5 requires. | Medium |
| A single rollback slot is sufficient for this milestone. | FACT (scope) | `install-model.md`; GH-346 | More slots would need a retention policy (revisit trigger). | High |
| The installer's legacy launcher content can be distinguished from a compiled artifact at the destination. | FACT | Launcher shape (bash stub, `TARGET=`), TDR-0046 §5 | The disposition table would be undecidable. | High |
| Every identity a lifecycle operation writes must come from the process itself or from the record: an injected identity is a compile-time constant no process can read back out of a file. | FACT | TDR-0045 §2, §4; §1, §2.1 | A rollback after a lost record could name the artifact it installs, and §4's record precondition would be unnecessary. | High |

## Mental Models & Techniques Used

- **First principles:** What must be true for an install to be recoverable? At every instant at least one runnable artifact must exist at a known path. That single invariant fixes the rename order and rules out in-place overwrite.
- **Inversion:** How does this fail? A crash between the two renames leaving no destination; a rollback that restores a launcher; a purge that runs without confirmation; an uninstall that quietly deletes the delivery history; two installers fighting over one path; a dry-run that creates a directory. C-1…C-9 and §2's crash table exclude each.
- **Second-order thinking:** Swapping `previous` on *each* install (rather than only on upgrade) means rollback always goes back exactly one install — including back across an uninstall-then-install sequence, which is the case an operator actually hits.
- **Systems thinking:** Four consumers read the install record (status, rollback, uninstall residual report, and the next install). A record written by one and interpreted differently by another is the failure mode, so §1 fixes the fields and their meaning once.
- **Least privilege:** four write locations, all named, all inside Jaiship namespaces plus one delimited profile block.
- **Paved road:** staging + compare + rename is the delivered launcher pattern; the uninstall/purge split is the delivered model's.
- **Reversibility:** every operation is a file operation inside the operator's home, so the whole lifecycle is reversible by hand if the product is ever unavailable.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 safe replace | C-2 one slot | C-3 offline explicit | C-4 uninstall keeps state | C-5 residual report | C-6 confirmed purge | C-7 dry-run | C-8 one owner | C-9 additive |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 overwrite in place | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 stage + swap order, one slot (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 versioned artifact directories + symlink switch | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 download-based upgrade | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-4 single destructive verb (uninstall deletes all) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ⚠️ | ✅ | ✅ |
| ALT-5 shell-script lifecycle (install-model as written) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only in a degenerate sense.

### Alternative 0 — Overwrite the Destination in Place

- **Eligibility:** Not eligible (fails C-1, C-2, C-5).
- **Summary:** Write the new bytes over `~/.jaiship/bin/jaiship` (or `cp` them), keep no slot.
- **Constraint compliance:** A crash mid-write leaves a truncated, unrunnable artifact with no recoverable predecessor; no rollback exists; the uninstall residual report has nothing to compute from.
- **Driver fit:** Fails 1, 2, 5.
- **Pros:** One file operation.
- **Cons:** The classic broken-install failure mode, on the one command that must always work.
- **Why rejected:** It violates the single invariant this operation exists to protect.

### Alternative 1 — Stage Beside the Destination, Preserve Before Replacing (chosen)

- **Eligibility:** Eligible.
- **Summary:** Stage the artifact as a hidden file in the destination directory, verify it, move the existing artifact to the slot, then rename the staged file into place; swap the slot on rollback so rollback is involutive.
- **Constraint compliance:** C-1 by the crash table in §2; C-2 by the slot rule; C-3 by installing the running artifact only; C-4/C-5 by the removal matrix and the residual computation; C-6 by the confirmation input; C-7 by the dry-run contract; C-8 by the ownership table; C-9 by the single record file.
- **Driver fit:** Best on 1, 2, 5, 7.
- **Pros:** Two renames, both atomic; the recovered state at every crash point is a working install; idempotence comes free from comparing identities.
- **Cons:** Two crash windows must be reasoned about and tested, and the slot's identity must be recorded to be reportable.

### Alternative 2 — Versioned Artifact Directories Behind a Symlink

- **Eligibility:** Eligible, ranked below ALT-1.
- **Summary:** `~/.jaiship/versions/<identity>/jaiship` plus a `current` symlink swapped atomically; retention prunes old versions.
- **Constraint compliance:** Fails C-2 as written (one slot), not because it is unsafe: it supports many rollbacks, which requires a retention policy (how many, when pruned, what `uninstall` leaves behind) — a new operational surface this milestone explicitly does not design, and a second path scheme beside the model's layout.
- **Driver fit:** Best on 2 in the long run; fails 6 (a new directory tree and a prune policy) and 7 (the model fixes the layout).
- **Pros:** Multiple rollbacks; no rename ordering subtlety; easy version inspection.
- **Cons:** Retention, pruning, and a symlink indirection that TDR-0046 §5 must then reason about ("write-through" risk); more paths to leak into a record.
- **Why rejected:** It solves a problem the milestone does not have, at the cost of a policy it would then have to own.

### Alternative 3 — Download-Based Upgrade

- **Eligibility:** Not eligible (fails C-3).
- **Summary:** `upgrade` fetches a release artifact and verifies a checksum.
- **Constraint compliance:** Introduces network access, a trust decision (signature policy), and a failure taxonomy into the delivery path, all of which the milestone defers to M4-S2 and beyond.
- **Driver fit:** Good on 5; fails 3 badly.
- **Pros:** The operator-facing shape everyone eventually wants.
- **Cons:** A trust boundary decided in the wrong change.
- **Why rejected:** Out of scope, and it would pre-empt M4-S2's release channel.

### Alternative 4 — One Destructive Verb

- **Eligibility:** Not eligible (fails C-4, C-5, C-6).
- **Summary:** `uninstall` removes the binary *and* both roots; there is no purge.
- **Constraint compliance:** Deletes delivery history on a routine operation, and has no residual report because there is no residual.
- **Driver fit:** Fails 3, 4.
- **Pros:** One operation, one help page.
- **Cons:** An operator who wants the command gone but the history kept has no path; the AC's "reports exactly what purge would delete" has no subject.
- **Why rejected:** It is the AC inverted.

### Alternative 5 — The Model's Shell Lifecycle as Written

- **Eligibility:** Not eligible (fails C-8 as a lifecycle surface, and superseded by TDR-0044 on surface).
- **Summary:** `scripts/install-jaiship.sh` performs install/upgrade/rollback/uninstall/purge with its own flags.
- **Constraint compliance:** The *mechanics* pass; the ownership rule fails, because the shell installer would then own both the launcher step and the binary lifecycle, and the guard in TDR-0044 §4 would have no meaning.
- **Driver fit:** Good on 1, 7; fails 3.
- **Pros:** Familiar shape.
- **Cons:** Two owners of one path; the typed-error AC unmet.
- **Why rejected:** TDR-0044 decides the surface; this record decides the semantics, and the semantics live where the surface is.

## Decision

- **Decision:** Adopt ALT-1. The four operations are defined by one atomic replace algorithm, one artifact-agreement no-op rule with in-place record reconciliation, one rollback slot, one rollback record precondition, one removal matrix, one dry-run contract, and one ownership rule.

### 1. The install record (`install.json`, schema v1)

- **Location:** `<config root>/install.json` (`~/.jaiship/install.json` for the primary identity), beside the operator's configuration and never inside a state root.
- **Fields (all required, none secret):**

  | Field | Meaning |
  |---|---|
  | `schemaVersion` | the record's own version (`install.record.v1`) |
  | `version`, `commit`, `builtAt`, `dirty`, `channel` | the installed artifact's injected identity (TDR-0045 §2) |
  | `stateSchemaVersion` | the store-format identifier the artifact accepts (TDR-0047 §5) |
  | `sourceCheckout` | the checkout the artifact's identity was built from, or absent when the build had no git metadata; **only ever an admissible path** (TDR-0046 §2) |
  | `installedAt` | when the current artifact was put in place |
  | `previous` | the rollback slot's identity as last recorded; absent when the slot is empty, or when no readable record names its occupant (§1, §2.1 — the slot's condition is still reported, its identity is not guessed) |
  | `launcherDisposition` | what was found at the destination before the first managed install (`none` | `launcher-discarded` | `symlink-replaced`), with the reported detail |
  | `pathBlock` | the profile file and block marker the product appended, or absent |

- The record is written **atomically** (staged + renamed), never partially, and never containing a credential: once by a replacing install (step 7), once by a rollback, and once by the artifact-agreement reconciliation of §2.1. No other path writes it.
- **`previous` is swapped on every replacing install**, not only when the identity differs: rollback always goes back exactly one install. A no-op install swaps nothing, because the slot already names the previous install (§2.1). The displaced artifact's identity is the one the readable record's `current` names — the same source §2.1's reconciliation uses — so a replacing install over a `current` record always records a named `previous`; when step 5 is skipped the slot was never touched and the readable record's `previous` carries over; and when no readable record names the occupant, `previous` is absent and reported unknown.

### 2. Atomic replace (the seven normative steps)

The numbering is normative because the crash matrix and the change specification address the steps by number; the execution order for an agreement run is stated below the table.

| Step | Action | Failure consequence |
|---|---|---|
| 1 | Admission and identity gates (TDR-0046) and the daemon check (§4) | Nothing written; exit typed |
| 2 | Stage the running artifact's bytes into `<install dir>/.<binary>.tmp.<pid>` (same filesystem) | Destination and record untouched; temp removed |
| 3 | Verify the staged file (exists, non-empty, executable bit, content equal to the running artifact — a complete copy) | Destination and record untouched; temp removed |
| 4 | **Artifact-agreement gate and record reconciliation.** Read the destination. If it is a regular, non-empty, executable compiled artifact — never a symlink — whose **content equals the running artifact's**, then the destination *is* the running artifact: stop, with no staged copy, no destination rename, no slot swap, and no daemon action; then reconcile the record when it is not `current` (§2.1) | On the agreement path the destination and the slot are untouched; a reconciliation that cannot write leaves the record stale, is reported, and costs nothing else |
| 5 | Rename the destination into `<install dir>/<binary>.previous` **only when the destination is a regular compiled artifact whose content differs from the running artifact** (replacing any existing slot). A delivered bash launcher is **discarded with a report** naming its recorded target, and the existing slot is **left unchanged**. A **symlink** is replaced (never written through) and is **not promoted**, so the existing slot is left unchanged and the link's recorded target is untouched. **Skipped when the destination is absent** | Destination gone, slot holds the previous artifact: **recoverable by re-running install**. On a launcher or a symlink the slot is unchanged and the link's target is untouched; the destination itself is still replaced at step 6, so no rollback step is created or lost |
| 6 | Rename the staged file to the destination | Destination present again, slot intact: **a working install exists at every instant** |
| 7 | Write the record (staged + renamed) | Destination and slot are both valid; the record is stale until the next install, and §4's status reports the mismatch as `record-stale` rather than pretending |

- **The numeric order is the order of a *replacing* run.** Step 4's gate is a read of the destination, so an agreement run evaluates steps 1 and 4 only: it creates no staging file (steps 2–3), performs no rename (steps 5–6), and performs no step-7 write. A no-op run therefore writes no artifact byte and leaves no temporary file; its only possible write is §2.1's record reconciliation.
- **The stop condition is artifact agreement — content, never the record, and not "identity" as a file test.** An artifact's injected identity is a compile-time constant inside the binary (TDR-0045 §2), so it cannot be read back from a file: "the destination's identity equals the running identity" is not something a process can test. Content agreement is the test: it is the only read-only proof that the destination *is* the running artifact, identity equality follows from it, and it needs no record. The record has exactly one role here — supplying what to write during reconciliation (§2.1) — and never the role of a gate. Reading the destination's identity by executing it was rejected: that is a side effect and a trust boundary, and `--version` does not carry the full identity.
- **A rename never targets the slot when the destination is already the running artifact.** That is the invariant that keeps exactly one rollback step across a step-7 crash.
- **Step 5 is skipped when the destination is absent** (the step-5 crash state). The slot already holds the displaced artifact, so step 6 completes the install and the slot is preserved rather than overwritten by the recovery.
- **Only step 5→6 has a window in which the destination is absent**, and in that window the slot holds a runnable artifact at a known path. No step leaves a truncated destination.
- **No cross-device move:** staging happens in the destination directory, so the rename cannot fail with `EXDEV`.
- **No in-place byte writing** to the destination at any step.

#### 2.1 The artifact-agreement states — no-op and record reconciliation

Content agreement establishes that the destination *is* the running artifact. What is left is the record, and the reachable combinations have one action each:

| Destination content equals the running artifact | Record condition | Action | What is written |
|---|---|---|---|
| yes | `current` — readable, and its identity fields equal the running identity | stop; report the identity and that nothing changed | nothing |
| yes | readable, its identity fields differ (`record-stale`) | stop; reconcile; report the repair and the previous identity the record supplied | the record only |
| yes | `unreadable` or `absent` | stop; reconcile; report the repair, and that the previous identity and the managed block are unknown | the record only |
| no — a symlink, a launcher, an absent destination, or any other content | any | proceed to steps 5–7: a **differing regular compiled artifact** becomes the slot; a launcher is discarded with a report naming its recorded target and the **slot is left unchanged**; a symlink is replaced without write-through and **not promoted**, so the **slot is left unchanged and the link's target is untouched**; an absent destination is created | per steps 5–7 |

- **The slot fate in the last row is §2 step 5's rule, stated once and inherited here.** Only a differing regular compiled artifact is promoted into the slot; a discarded launcher and a replaced symlink both leave the existing slot **unchanged** — and a replaced symlink leaves its target untouched — so §2 and §2.1 cannot disagree about what either non-agreeing destination does to the rollback step.

- **The record is at most one successful install behind the disk, and that is what makes the repair possible.** A record write is the last step of every replacing install (and of every rollback), so in the step-7-crash state the stale record's `current` identity names exactly the artifact the crashed run moved into the slot at step 5. The reconciliation therefore writes `previous` from a readable record's `current` identity when the slot holds a compiled artifact, and writes `previous` **absent** when no readable record supplies that claim — never a guess, and never the record's own `previous`, whose artifact step 5 overwrote.
- **The other fields come from what the run can prove.** The `current` identity is the running identity, which agreement proves is what sits at the destination. `installedAt` is preserved from the readable record **only when that record's current identity is the running identity** (a stale record for another reason, such as a drifted block); when the record names a different artifact — the crash case — `installedAt` is the destination file's modification time, which is when that artifact was renamed into place. `launcherDisposition` and `pathBlock` are preserved from a readable record, and written absent — reported as unknown — when no readable record exists.
- **One writer, one atomicity rule.** The reconciliation uses the same writer, the same staged-and-renamed atomic write, and the same `install.record.v1` shape as step 7. There is no second record format and no second write path.
- **Why this preserves the rollback step:** after a step-7 crash the slot holds the predecessor and the record's `current` names it, so the repair restores exactly the record a successful install would have written (`current` = running identity, `previous` = the predecessor). The crash costs a record write and nothing else; the older slot entry step 5 overwrote is the same one-step loss a *successful* upgrade would have cost, not an additional one.
- **Reporting.** The run prints one line naming the repaired record and the previous identity it recorded, and says so when no readable record supplied one. `install status` stays read-only and never repairs; it determines `recordState` by comparing the record's identity with the running identity — a comparison of two records, never a content read (TDR-0045 §4) — so it detects the crash and a hand-edited record, and the next `install` is what establishes agreement and corrects the destination. That is a **reporting** comparison, and it is deliberately not §4's rollback precondition: `recordState` is the record against the running identity, while the precondition is the record against what is on disk (`current` against the destination, `previous` against the slot), so the two can disagree — a candidate-artifact invocation is `record-stale` for reporting yet proceeds for rollback (§4).
- **A reconciliation that cannot write** leaves the record untouched and the run reports `record-stale` with the reason at exit `0`: the destination is exactly what was asked for, and neither the destination nor the slot changed. The next run retries — which is why the reconciliation is idempotent and writes nothing when the record is already `current`.
- **Cost.** The gate costs one pass over each file; a size check rejects the common different-artifact case immediately, and the agreement path still costs far less than the staged copy it replaces.
- **`--dry-run` prints this arm and performs none of it** (C-7): "destination is this artifact; record would be repaired (<condition> → `current`, previous = <identity|unknown>)".

### 3. Upgrade

- **Upgrade = running a different compiled artifact's `install`.** The operator builds (or receives) a new artifact and runs *it*; the artifact installs itself, so the identity on disk is exactly the identity that was executed.
- **No download, no build, no in-place mutation** (C-3). The "desired commit" in the model is realized as "build from that commit in an admissible location and run the artifact".
- **Reported both ways:** the output names the previous identity (from the record/slot) and the new identity; `install status` and `--version` answer the same question afterwards.
- **Same-artifact re-install is a no-op by artifact agreement** — content, not timestamp, and **never conditioned on the record**: no destination byte is written, no staged copy is made, the slot is not swapped, and the daemon is not disturbed. The only write a no-op may perform is the record reconciliation of §2.1, and only when the record is not `current`; a run whose record was already `current` writes nothing at all. Content is the test — not identity — because a compiled artifact's identity is a compile-time constant that cannot be read back from the file (TDR-0045 §2): byte agreement is the read-only proof that the destination *is* the artifact being installed, and identity equality follows from it. A rebuild of the same commit carries a different build instant and is therefore a different artifact — an upgrade, installed rather than skipped.
- **A daemon running the previous build is stopped before the swap, not after** (§4), so a delivery path never observes two builds.
- **This is also the route back when `rollback` refuses for want of a record (§4).** The slot is a runnable compiled artifact at a documented path, and running it *is* an install of a different artifact under this section's rule and through the same seven steps. The operator's one step back therefore survives the refusal: the process knows its own identity, so the record that run writes has a `current` that is known and a `previous` that is absent and reported unknown — `previous` is "the slot's identity as last recorded" (§1), and no record recorded the artifact just displaced. A second run of the artifact now in the slot returns the other one, which is the same involutive property by hand. The refusal is also temporary: the next replacing install that displaces a destination the record names writes a named `previous` again (§1), so `rollback` becomes available after one more install rather than staying refused for good.

### 4. Rollback and the daemon

- **`install rollback`** swaps the slot and the destination (two renames in the reverse order of §2), updates the record, and reports both identities — the record precondition below is what lets that report be unconditional. **Rollback is involutive:** rolling back twice returns to the artifact that was installed before the first rollback, because the displaced artifact becomes the new slot.
- **Refusals (typed), evaluated in this order:** no slot (`install.slot.absent`); a slot that is not a compiled artifact, or whose bytes are unreadable (`install.slot.invalid`); and — because a rollback writes the record — a record that cannot name both artifacts the swap inverts (`install.record.unreadable`). The precondition is a **pair inversion**: the swap writes the slot's occupant as the new `current` and the destination's occupant as the new `previous`, so it needs the record's `current` to name the artifact at the destination and the record's `previous` to name the artifact in the slot. Four causes refuse: the record is **absent**; **unreadable**; **`record-stale`** — its `current` does not name the destination (the post-crash shape, where `current` names the slot's occupant and `previous` names an artifact step 5 already destroyed); or it is **readable and `current` but supplies no `previous`** while a slot is present (the slot's occupant unnamed — a name that is **wrong** rather than **missing** is the declared limit below, not a refusal). A refused rollback writes nothing: no rename, no record write, no daemon action.
- **Two comparisons, deliberately distinct.** The precondition above compares the record with **what is on disk**: its fields mean the destination (`current`) and the slot (`previous`) — §1 — and the question is whether the record names both occupants the swap exchanges. `install status`'s `recordState` compares the record with the **running** identity instead (§2.1; TDR-0045 §4), which is a reporting concept and never a content read. The two coincide when rollback is invoked through the installed artifact and diverge without contradiction, in both directions: a **candidate-artifact invocation** (running C, destination A, slot S, record `{current: A, previous: S}`) is `record-stale` for reporting because C ≠ A, yet the record names both artifacts the swap inverts, so rollback **proceeds** — the swap installs S in place of A and writes `{current: S, previous: A}`; a **post-crash record** (destination B, slot A, record `{current: A, …}`) is `record-stale` and **refuses**, because its `current` names the slot's occupant rather than the destination. So a `record-stale` report is neither a refusal by itself nor a bar to proceeding: `recordState` answers "does the record describe the process that is running?", and this precondition answers "can the record name the two artifacts this swap exchanges?".
- **Why the record is a precondition here and a repair source there.** Both facts the swap produces are record fields — the new `current` is the slot's occupant, the new `previous` is the destination — and no process can read an injected identity out of a file (TDR-0045 §2), so both names can come only from the record, whose fields mean exactly that (`current` = destination, `previous` = slot occupant). `install` never faces this inversion: the process *is* the artifact being installed, so the identity it must write as `current` is known by construction, and the artifact it cannot name is the one it displaced — a `previous`, which §1 lets be absent and reported unknown. Rollback inverts the two roles, so "proceed" would make the unknowable artifact the **`current`**, the one identity field with no unknown allowance. It would therefore either invent that identity or hollow the field out; a record whose `current` cannot be compared with a running identity is not a weaker claim but a different kind of file, and the hole would be copied into `previous` by the next install and lost from the chain permanently.
- **Refusal rather than a best-effort swap, for two further reasons.** An absent record and an unreadable one carry the same information, so refusing the second while proceeding on the first makes deleting `install.json` the way around the refusal — a documented incentive to exchange an auditable state for an unauditable one. And the capability is not lost: §3's "install a different artifact" returns the operator one step, at the cost of typing a path instead of a subcommand.
- **The refusing `record-stale` arm is a routing decision, not a representability limit.** In the post-crash shape the stale record's `current` does name the slot's occupant, so a rollback that re-interpreted the fields could write a conformant record. This record declines that second interpretation of the record inside the most state-sensitive operation: repair already has one owner and one operation — §2.1's in-place reconciliation, performed by the next `install`, which renames nothing and restores `previous` to the slot's true occupant — and the following `install rollback` proceeds normally.
- **Declared limit, unchanged.** Rollback takes the record's `previous` at its word, because DM-2 stores no slot digest. The refusal is about a **missing** name, never a **wrong** one: a hand-replaced slot artifact remains a claim the operator can check against `install status`.
- **Daemon interaction (both `install` and `rollback`):** when a live instance is detected through the delivered instance/heartbeat read, the operation **refuses** with a typed error naming the holder and the remedy unless `--stop-daemon` is given, in which case the daemon is stopped through the delivered stop path **before** the swap.
  - **Why before:** stopping after the swap leaves the new artifact in place while the old build keeps running — the exact "two builds in one delivery path" failure.
  - Replacing a *running* executable without a daemon in play is safe on POSIX and requires no stopping; only the supervised daemon is treated as a holder.

### 5. `--add-to-path` and the PATH block

- Appends **one delimited block** to one profile file — `# >>> <binary-name> >>>` … `# <<< <binary-name> <<<` — containing exactly the export/`PATH` line that puts the install directory first.
- **File selection:** `--shell-profile <path>` when given; otherwise derived from the operator's `$SHELL` basename (`zsh` → `~/.zshrc`, `bash` → `~/.bashrc`, `sh` → `~/.profile`); an unidentifiable shell with no `--shell-profile` is a typed refusal naming both.
- **Idempotence:** an identical block is not re-appended; a block with different content is replaced in place (never duplicated).
- **Ownership:** `install uninstall` removes exactly this block (C-4) and nothing else from the profile; `purge` removes it too.
- The block is recorded in the install record so a later install or uninstall finds it even if the operator moved the profile file's content around.

### 6. `uninstall` and `purge` (the removal matrix)

| Path | `uninstall` | `purge` |
|---|---|---|
| `<install dir>/<binary>` | removed | removed |
| `<install dir>/<binary>.previous` | removed | removed |
| `<config root>/install.json` | removed | removed |
| the managed PATH block | removed | removed |
| `<config root>/` (everything else: `config.yaml`, any operator files) | **kept** | removed |
| `<state root>/` (host root and every `projects/*`) | **kept** | removed |

- **`uninstall` always prints the residual set** — the absolute paths that exist at that moment under the two roots — as "purge would additionally delete:" (C-5). It prints the same list under `--dry-run` without removing anything.
- **`uninstall --dry-run`** prints (a) what it would remove and (b) the residual set it would report, in two clearly separated blocks.
- **`purge` requires an explicit confirmation** (`--yes`); without it, a typed refusal names the two roots and the flag, and nothing is removed. Confirmation is required even when the roots are absent (the answer is then "nothing to remove", reported, not silently successful).
- **Order:** artifact, slot, record, PATH block, then the roots (purge only). If the record cannot be read, the artifact paths are still removed and the block is reported as unknown rather than guessed.

### 7. Dry-run contract (what each plan prints)

| Command | Plan content |
|---|---|
| `install --dry-run` | running identity and artifact path; destination path; disposition of what is found there (binary / legacy launcher / symlink / absent); whether the slot would be swapped; whether the destination is this artifact and the run would therefore stop at step 4, and whether the record would be repaired and from which condition (§2.1); the record path; the PATH block file and exact block text (when `--add-to-path`); legacy-namespace artefacts detected; the state-format advisory set (TDR-0047 §3); the daemon disposition |
| `install rollback --dry-run` | current and slot identities; the two renames in order; the record update; and, when §4's record precondition is unmet, the refusal identity, its cause, and the §3 remedy in place of a plan |
| `install uninstall --dry-run` | the removal list and the residual set |
| `install purge --dry-run` | the removal list (artifact, slot, record, block, both roots, each project root enumerated) |

Every plan: absolute paths, one line per path, **no directory creation, no write, no daemon action**.

### 8. The `--migrate` hook boundary (M4-S2 owns the migration)

- **S1 delivers detection and reporting only.** `install` enumerates prior-namespace artefacts (`~/.delivery-os*`, `<repo>/.delivery-os`) and prints one advisory line naming them and the documented manual move. It never moves, copies, or deletes them, with or without the flag.
- **`--migrate` is accepted and answers one typed refusal** stating that migration is not available in this build and naming M4-S2 as its owner. No migration port is composed in S1, so the flag cannot silently no-op.
- **Dry-run with `--migrate`** prints the same detection list and states that nothing would be migrated.

### 9. Ownership with the delivered shell installers (one story per artifact class)

| Artifact class | Owner | The other surface's behaviour |
|---|---|---|
| The binary, its slot, its record, its PATH block | `jaiship install *` | `scripts/uninstall.sh` never touches them; if a managed install is detected it **reports** it and names `jaiship install uninstall` |
| Repository artifacts (docs, agents, commands, plugin projection) | `scripts/install.sh` / `scripts/uninstall.sh` | the family never removes them; `install uninstall` names the shell uninstaller for them |
| The legacy launcher, when no managed binary exists | `scripts/install.sh` (delivered step) | `jaiship install` replaces it and reports the disposition; `scripts/install.sh` refuses to overwrite a managed binary (TDR-0044 §4) |

- **`scripts/uninstall.sh` gains one guard:** it must not delete any Jaiship root or the binary, and where a managed install exists it prints the owner command. Its own exit taxonomy and `DRY_RUN` behaviour are unchanged.
- **The documentation's "no uninstall path exists" statement is retired** in the same change: it becomes untrue the moment this record is implemented, and the two guides must say which surface removes which class.

### 10. Explicit non-decisions

- **No download channel, no signature verification, no package manager** (M4 out of scope; revisit trigger).
- **No migration implementation** (M4-S2).
- **No retention policy and no multiple rollback steps** (single slot per the model; revisit trigger).
- **No destination override** (TDR-0046 C-5).
- **No daemon lifecycle decisions beyond the replace guard** (stop/start semantics belong to the daemon family).

### Amendment — DoR iteration 1: the no-op predicate (2026-11-18)

This record was amended before acceptance. Definition-of-Ready iteration 1 on GH-346 proved from the delivered code and the reachable states that §2 step 4 and §3 contradicted each other, and that the contradiction destroyed the rollback slot.

- **Evidence.** The step-7-crash state satisfies "the destination's identity equals the running identity" and fails "the record matches". Under the first wording the run continued to step 5, renamed the destination onto the slot, and replaced the still-valid previous artifact; step 7 then wrote a record whose `previous` was the current identity, so `install rollback` swapped two identical files and the "one step back" guarantee was gone. Source: `doc/changes/2026-11/2026-11-18--GH-346--installable-versioned-binary/readiness-review/readiness-iter-1.md` finding 1, read 2026-11-18. The same defect reached the record-free states: an operator who deleted or damaged `install.json` and re-ran the same artifact lost the slot by the same route.
- **Correction.** The stop condition is **artifact agreement — content, never the record** (§2 step 4), because identity is not readable from a file; the record is reconciled in place (§2.1) with no destination rename and no slot change. §3 now states the no-op unconditionally and names the reconciliation as the only write a no-op may perform. §1 states that `previous` is swapped on every *replacing* install. The agreement states are enumerated in §2.1 — including the `compiled artifact + stale/damaged/absent record` disposition the change specification's C.2 inherits — and §2 now states that step 5 is skipped when the destination is absent, so the step-5 crash recovery keeps the slot too.
- **On the DoR recommendation's wording.** The gate's suggested fix ("identity-equal **+ record mismatched** ⇒ repair the record only") is directionally right and literally unimplementable: no process can test a file's injected identity without executing it. This amendment supplies the implementable form — content agreement as the identity evidence, the record as the repair source — and a specification that copies "identity comparison" as a *test description* would re-introduce the defect.
- **Consequence for the specifications that consume this record.** Re-installing the same artifact leaves the record *unchanged when it was already `current`* — the unconditional "the record is unchanged" of AC-F9-2 holds only under that condition, and the criterion needs the reconciliation arm; F-9's "no-op by identity comparison" becomes "no-op by artifact agreement, with in-place record reconciliation"; the inherited disposition table needs the new row; and the step-7 recovery case must assert the slot's digest, not only the record's condition.

### Amendment — DoR iteration 2: `install rollback` without a namable record (2026-11-18)

Definition-of-Ready iteration 2 on GH-346 found `install rollback` with an **absent** record unadjudicated: the specification's F-8 and DEC-13 refused only a record "present but unreadable", while AC-F8-2's single sentence could be read as refusing — or as proceeding — across its three givens, and the proceeding reading cannot write a conformant record. This note records the ruling.

- **Evidence.** The state is reachable and legitimate: the record can be deleted by hand, and F-8/F-14 call the record-free state legitimate. On the proceeding reading the swap runs, and the new destination is the old slot artifact, whose injected identity is a compile-time constant no process can read out of a file (TDR-0045 §2); DM-2 requires every identity field with no unknown allowance for them, and F-9 requires both identities reported. Source: `doc/changes/2026-11/2026-11-18--GH-346--installable-versioned-binary/readiness-review/readiness-iter-2.md` finding 3, read 2026-11-18; the residual state §2.1's reconciliation can leave was already listed under Unresolved Questions.
- **Ruling: refuse.** §4 gains one ordered precondition — the record must be able to name the artifact the swap would install — and keeps the existing identity `install.record.unreadable`. No twelfth domain row, no allowlist movement, no DM-2 field or unknown allowance changed, and F-9's unconditional "report both identities" preserved rather than weakened to "both, or unknown". Four causes refuse: the record is absent; unreadable; `record-stale` (the post-crash shape); or readable and `current` but naming no `previous` while a slot is present.
- **Why not proceed.** The record a rollback writes carries the slot's occupant in `current` — the one identity field with no unknown allowance — precisely because that artifact is the one the running process is not. `install` never faces the inversion: the process *is* the artifact it installs, so its `current` is known by construction and only the displaced `previous` can be unknown, which §1 already permits. An unknown `current` would break the record's only purpose (the installed-versus-running comparison F-8 defines), be copied forward as an unknown `previous` by the next install, and — since an absent record carries the same information as an unreadable one — make deleting `install.json` the way around DEC-13's refusal. An unrepresentable record is a permanent, silent degradation of the one surface the operator can check; a refusal is a local, zero-write inconvenience with a paved remedy (§3).
- **Consequences this record imposes on the specification.** F-8, DEC-13, and Appendix E's `install.record.unreadable` trigger widen to the four causes; AC-F8-2 keeps its three arms as refusals but states the slot-present condition, the fourth arm, and the zero-write assertion explicitly; Appendix C.4's `install rollback --dry-run` row prints the refusal cause instead of a plan; `install status` does not change, because it already reports `recordState` and `slotState` independently — that combination is what makes the refusal legible; and the test plan gains one arm (record absent, slot present → `install.record.unreadable`, exit `1`, zero writes: destination and slot digests and `mtimeNs` unchanged and no record created) plus the no-`previous` variant on the same fixture.
- **The sentence the specification must reproduce (pair inversion; supersedes the iteration-2 wording of this bullet):** `install rollback` proceeds only when the record is readable and names **both** artifacts the swap inverts — the artifact at the destination in `current` and the artifact in the slot in `previous` — otherwise it refuses with `install.record.unreadable` and writes nothing. The earlier wording — "unless the install record can name the identity of the artifact the swap would install as the destination" — carried only the `previous` half, so it could not say why a post-crash record refuses and could be read as refusing a candidate-artifact invocation, which proceeds; the pair-inversion sentence replaces it. The four causes and the justification are unchanged: the record a rollback writes carries the slot's occupant in `current`, the one identity field with no unknown allowance, and no process can read an injected identity from a file (TDR-0045 §2). §4 states the pair rule and the two comparisons (rollback: record against disk; `install status`: record against the running identity).
- **Riding correction — §2 step 5's destination qualification (2026-11-18).** The same amendment now carries the dispositional qualification §2 step 5 lacked and §2.1's matching cross-reference: only a **differing regular compiled artifact** is renamed into the slot, so the slot still holds only a compiled artifact carrying an injected identity; a delivered bash launcher is **discarded with a report** and the existing slot is **left unchanged**; a **symlink** is **replaced, never written through**, and **never promoted**, leaving both the existing slot and the link's target untouched; the destination-absent skip is unchanged. This closes the record-side half of the qualification the change specification's Appendix B step 5 and Appendix C.2 already carry, so the binding design and this record no longer disagree about what a launcher or a symlink does to the rollback step. Source: Definition-of-Ready iteration 3 on GH-346, `readiness-review/readiness-iter-3.md` finding 4 ("PARTIAL/PERSISTENT", carried from iteration 2), read 2026-11-18. No trigger, row count, or rollback ruling is changed by it.

### Constraint Compliance Attestation

The chosen alternative (ALT-1) satisfies every constraint C-1 through C-9. No accepted-risk exceptions are taken. Three states are declared rather than smoothed over: a crash between the two renames leaves a valid slot with no destination (recovered by re-running install, which skips step 5 and keeps the slot), a crash after the renames but before the record write leaves `record-stale` as a reported state (repaired by the next `install` without a destination rename, so the rollback step survives the crash), and `purge` against absent roots reports "nothing to remove" successfully rather than failing. Each is a deliberate consequence of C-1 and idempotence, and each must be visible in the output. One further consequence is declared rather than hidden: **artifact agreement, not a file-readable identity, is the no-op test** — because identity is a compile-time constant — so a destination whose content differs is always replaced rather than assumed equal. A side effect of that choice is desirable: a same-identity rebuild is installed rather than skipped, which is the honest direction for an upgrade. One state is **refused** rather than attempted: `install rollback` without a record that can name the artifact the swap would install (§4) — the one step back is never taken blind, and §3's install of the slot artifact is the route back.

**Reversal.** Superseding this record and TDR-0044 restores `install-model.md`'s flag forms; the install record then becomes an unread file inside the config root, which is harmless because nothing else depends on it. A manual recovery path always exists because every operation is a file operation inside the operator's home, and the PATH block is delimited and findable. `purge` must never ship without its confirmation input, in any reversal.

## Trade-offs & Consequences

### Positive Outcomes

- Every crash point leaves a runnable artifact at a known path or a slot that the next install recovers from — the invariant that makes an install safe to run often.
- Rollback is one step, always, including across an upgrade that followed another upgrade.
- `uninstall` can be run without fear: history and configuration survive, and the residual set is printed before the operator considers `purge`.
- `purge` cannot happen by accident: a flag, a named root list, and a refusal otherwise.
- The two-installer/one-machine confusion is resolved by rule, with each surface naming the other.
- The delivered shell scripts keep their contracts and gain one guard, instead of being rewritten.

### Negative Outcomes

- **Two crash windows must be reasoned about and tested**, and step 7's stale-record case is a declared, reported state rather than an impossible one. Its recovery is a record repair that never renames the destination, so the crash costs a record write and not the rollback step — but it does mean `install` has a second write path to the record, sharing one writer and one atomicity rule with step 7.
- **One rollback step only.** An operator who upgrades twice cannot reach the first build without rebuilding it.
- **Rollback is unavailable without a namable record.** Deleting or damaging `install.json` costs the operator the `rollback` command, not the artifact or the capability: the recovery is an install of the slot artifact (§3), which is this model's own paved road but a path the operator has to type rather than a subcommand. This is deliberate — the alternative is a record whose `current` cannot be checked — and `install status` and the rollback dry-run both name the cause before the refusal.
- **A live daemon blocks a replace by default.** That is the model's rule and the correct default, but it means an unattended upgrade needs `--stop-daemon` and therefore a deliberate stop.
- **The install record is a new contract surface** (fields, meanings, `record-stale`), and every consumer must read it the same way.
- **The PATH block is a mutation of an operator file.** It is opt-in, delimited, recorded, and removable, but it is still the one place the product writes outside its own namespaces.
- **`scripts/uninstall.sh` gains a guard and the docs lose a sentence** ("no uninstall path exists"), so this change touches a delivered documentation claim — a doc-sync obligation, not an optional cleanup.
- **`purge` with absent roots is a reported success, not an error.** That asymmetry is deliberate (idempotence) and must be stated or it will look like a bug.

### Unresolved Questions

- [ ] Whether the artifact file inside `<install dir>` should be hidden during staging (`.tmp`) or use a fixed name; the record fixes "same directory, unique per run, cleaned on failure", not the naming.
- [ ] Whether `install uninstall` should offer to stop a live daemon or refuse instead. Owner: `@spec-writer`; refusing is consistent with C-4's conservatism, but a stopped command with a live daemon is a state worth stating in the guide either way.
- [x] **Resolved 2026-11-18 (Definition-of-Ready iteration 2).** `install rollback` **refuses** in that state, under §4's ordered record precondition and the existing identity `install.record.unreadable`: a `current` record that names no `previous` while a slot is present cannot name the artifact the swap would install, and the swap's new `current` is the one record field with no unknown allowance. The same ruling covers the absent-record state that raised this question (`readiness-review/readiness-iter-2.md` finding 3); see `### Amendment — DoR iteration 2`.
- [ ] Whether `purge` should print the estimated content (file counts) of the roots before confirmation. Owner: `@spec-writer`; the AC only requires exact paths, and counts would need a bounded walk.
- [ ] The exact `install.record.v1` field spellings. Owner: `@spec-writer` with the TDR-0045 §4 status schema.

## Implementation Plan

1. **Record.** Read/write `install.record.v1` atomically; tolerate absent optional fields on read; never throw on a damaged record (report `record-stale`/`unreadable`). One atomic writer serves both step 7 and §2.1's reconciliation.
2. **Replace.** Implement the seven steps of §2 with the artifact-agreement gate, the step-5 skip on an absent destination, and §2.1's reconciliation; assert the crash table with injected failures and the slot's digest after every recovery.
3. **Rollback.** Two renames in reverse order, record update, slot guard, §4's ordered record precondition with its zero-write refusal, involutive test.
4. **Daemon guard.** Detect a live instance through the delivered read; refuse or stop-then-swap per §4.
5. **PATH block.** Managed block with markers, selection rule, idempotent replace, record entry, and removal on uninstall/purge.
6. **Uninstall/purge.** Removal matrix, residual-set computation, confirmation refusal, dry-run plans.
7. **Shell-side guard.** `scripts/uninstall.sh` must not touch Jaiship roots or the binary, and must name the owner command when a managed install exists; extend its tests.
8. **Refusals.** Register the identities (`install.record.unreadable`, `install.slot.absent`, `install.slot.invalid`, `install.daemon.running`, `install.purge.unconfirmed`, `install.migration.unavailable`, plus the TDR-0044/0038/0039 identities) and document every row.
9. **Docs.** The local-install guide owns the operator story (cadence, upgrade, rollback, uninstall vs purge, PATH block); the doc-distribution page retires "no uninstall path exists"; `install-model.md` is corrected where its flags became subcommands.
10. **Tests.** Crash-point matrix with the slot's digest asserted after every recovery, idempotent re-install, record reconciliation from the stale/damaged/absent states, upgrade two ways, involutive rollback, slot guards and the record precondition (the absent arm and the no-`previous` arm, each asserting zero writes and that no record is created), daemon both arms, block idempotence/removal, uninstall residual equality with `purge --dry-run` and with `purge --yes`, confirmation refusal, and a filesystem-snapshot assertion for each dry-run.

## Verification Criteria

- Metric: crash safety — a failure injected at each of §2's steps leaves a runnable artifact at a known path and never a truncated destination, re-running `install` completes the install, and the slot is never swapped by a recovery. Target: every step, 7/7, plus the step-5 and step-7 recovery arms. Window: GH-346 CI.
- Metric: idempotence — installing the same artifact with a `current` record rewrites nothing (destination bytes and mtime, slot, and record unchanged, and no staged copy) and reports the identity. Target: exact. Window: GH-346 CI.
- Metric: record reconciliation — from a step-7-crash state, a re-run leaves the destination and the slot byte-identical, repairs the record to `current` with `previous` equal to the predecessor the stale record named, and a following `install rollback` returns that predecessor; from an absent or damaged record, a re-run leaves the destination and the slot byte-identical and repairs the record to `current` with the previous identity reported as unknown rather than guessed. Target: exact, all three states. Window: GH-346 CI.
- Metric: rollback — one swap returns to the previous identity; two swaps return to the original; a launcher slot, an absent slot, and an identity-less artifact are each refused typed; and, with a slot present, an absent record and a `current` record that names no `previous` are each refused typed with zero writes and no record created. Target: 7/7. Window: GH-346 CI.
- Metric: residual equality — the `uninstall` residual set equals `purge --dry-run`'s removal set at the same moment and equals what `purge --yes` removes. Target: exact. Window: GH-346 CI.
- Metric: preservation — after `uninstall`, both roots are byte-identical to their pre-uninstall state and the PATH block is gone. Target: exact. Window: GH-346 CI.
- Metric: purge confirmation — without the confirmation input, nothing is removed and the refusal names both roots. Target: exact. Window: GH-346 CI.
- Metric: dry-run — a filesystem snapshot is unchanged after each of the four dry-runs, and each plan names every path the real run touches. Target: 4/4. Window: GH-346 CI.
- Metric: ownership — the shell uninstaller removes no binary and no Jaiship root, and names the owner command when a managed install exists; the family removes no project artifact. Target: exact. Window: GH-346 CI.
- Metric: no network, no build — the composition constructs no HTTP client and spawns no build process across all five entry points. Target: exact. Window: GH-346 CI.

## Confidence Rating

**High** for the replace algorithm and the rollback rule: the invariant is simple, the delivered launcher already stages and renames in the same directory, and POSIX rename semantics make the crash table decidable. **High** for the removal matrix: it is the model's own split, and the AC only adds the reporting requirement, which is computed from what exists. **High** for the ownership rule: both delivered shell scripts have a documented, different scope. **High** for the rollback record precondition: it follows from the record's own field meanings and from the fact that identity is not file-readable, it writes nothing on the refusing path, and its remedy is the model's own install rule. **Medium** for the daemon-before-swap ordering: it is the correct default given two builds must not coexist, but whether an unattended upgrade may stop a daemon is an operational preference the owner should confirm — the record makes stopping explicit (`--stop-daemon`) rather than implicit.

## References

- GH-346 ticket body — `gh issue view 346 -R juliusz-cwiakalski/agentic-delivery-os`
- M4 blueprint — `doc/planning/oss-tooling/milestones/m4/README.md` (EC-1, D3, D6), `backlog.md` (S1, S2, S8), `install-model.md` (Layout, Build and install flow, Upgrade and rollback, Uninstall, Safety), `ranking.md`
- Delivered installer staging/compare pattern and launcher contract — `scripts/install.sh` (`install_local_launcher`, `resolve_launcher_path`), `doc/spec/features/feature-doc-distribution-marker.md`, `doc/guides/local-install.md`
- Delivered shell uninstaller scope and exit taxonomy — `scripts/uninstall.sh`
- Delivered daemon instance/heartbeat read and stop path — `packages/cli/src/daemon-compose.ts`, `packages/adapters/src/daemon/process.ts`, `packages/adapters/src/daemon/supervisor.ts`
- Refusal contract and projection — `packages/core/src/contracts/error-table.ts`, `packages/cli/src/projection.ts`, `.ai/rules/typescript.md` §7
- Prior change record — `doc/changes/2026-11/2026-11-15--GH-320--jaiship-binary/chg-GH-320-spec.md` §8.5, §17 (AC-F6-8), §22
- [TDR-0044](TDR-0044-install-lifecycle-composed-command-family.md) — the surface that owns these operations
- [TDR-0045](TDR-0045-self-contained-binary-build-identity.md) — the artifact and identity the record stores
- [TDR-0046](TDR-0046-install-target-stability-and-dev-build-exclusion.md) — the admission rule and the slot-content rule
- [TDR-0047](TDR-0047-installed-binary-state-format-compatibility-check.md) — the advisory and verdict the write paths report
