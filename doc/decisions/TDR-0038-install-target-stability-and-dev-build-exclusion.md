---
id: TDR-0038
decision_type: tdr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-18
summary: "One named rule — the install-target stability rule — governs both requirements: the install target is the artifact the install copies from together with the checkout it resolves to, never the operator-independent destination, and an install is refused with a typed error when that checkout is a linked git worktree (detected by `git rev-parse --git-dir` differing from `--git-common-dir`), while the primary checkout, a plain directory, and a host without git are all allowed. The same rule's second limb keeps dev builds out of the delivery path: an install requires an artifact carrying an injected build identity, never builds anything, and never promotes a legacy launcher to the rollback slot."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os install surface (target admission) and git adapter reads"
decision_scope: repo
review_date: null
business_impact: "The live defect GH-346 exists to remove is an installed entry point recorded into a lane worktree that is deleted after merge. Without a named, tested admission rule the class returns the first time someone installs from a worktree, and without a dev-build exclusion the installed artifact can silently be a feature-branch build."
customer_impact: "An operator who tries to install from a disposable worktree gets one typed refusal naming the path, the worktree, and the remedy, instead of an install that works until a merge deletes the directory it pointed at."
classification:
  domains: [operations, tooling, contracts, security]
  archetype: policy
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-346: the change specification is blocked on how the worktree refusal is detected and named)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-346 PR review; AI does not accept this R2 record"
  contributors:
    - "@decision-advisor (repository analysis, worktree topology probe, and this record)"
    - "@pm (GH-346 clarify_scope: the ticket's worktree AC and 'dev builds kept out of the delivery path')"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-346 PR review — this record adds a refusal that can block an install)"
  performers:
    - "@coder (GH-346 delivery: git read, admission check, refusal identity, rollback-slot rule, tests)"
    - "@doc-syncer (CLI entrypoint, local-install guide, adapter reference behavior)"
  informed:
    - "M4-S2 namespace migration (its `--migrate` path is subject to the same rule)"
    - "M4-S8 dogfood window (installs happen from the primary checkout under this rule)"
    - "Daemon work (service-unit entry paths are an executed path the rule constrains)"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "Installing from a lane worktree becomes a desired workflow (for example per-iteration dogfood installs): decide an explicit, recorded override with its own identity rather than weakening the default refusal, and re-open the provenance claim the install record makes."
  - "A CI job must install from a detached checkout or a shallow clone: confirm the git reads behave, and decide the recorded provenance for a checkout with no worktree metadata."
  - "The daemon must be pinned to the installed artifact: the executed-path limb of this rule then covers the service-unit entry, and the M4-S3 decision must state how it composes with this one."
  - "A non-git distribution channel (tarball, package manager) becomes primary: decide whether a host without git is 'allowed and unverified' or 'allowed and verified by checksum', rather than leaving `unverified` as the permanent record."
links:
  related_changes: ["GH-346", "GH-320"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-cli-entrypoint.md"
    - "doc/spec/features/feature-adapter-reference-behavior.md"
    - "doc/guides/local-install.md"
    - "doc/planning/oss-tooling/milestones/m4/install-model.md"
  contracts:
    - "packages/adapters/src/git/index.ts"
    - "packages/core/src/contracts/error-table.ts"
    - "packages/cli/src/entrypoint.ts"
  diagrams: []
  decisions: ["TDR-0036", "TDR-0037", "TDR-0040"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S1", "M4-S2", "M4-S8"]
---

# TDR-0038: Install-Target Stability Rule and Dev-Build Exclusion

## Context

- **FACT:** GH-346 requires "a stability rule that refuses an install target inside a git worktree (lane worktrees are deleted after merge)" and an AC that "an install whose target is a worktree is refused with a typed error" (ticket body, read 2026-11-18).
- **FACT:** The live defect: `~/.jaiship/bin/jaiship` is a bash launcher with `readonly TARGET=<primary-checkout>/jaiship-gh-339/packages/cli/bin/jaiship.ts`, and `~/.local/bin/jaiship` is a symlink to it; `jaiship-gh-339` is a **linked worktree** of the primary checkout. Removing that worktree breaks the installed command (observed 2026-11-18).
- **FACT:** This repository's topology makes "worktree" a normal state, not an exception: the primary checkout lives at `jaiship/`, and each change is delivered in a linked worktree (`git worktree list` shows `jaiship`, `jaiship-gh-335`, `jaiship-gh-339`, `jaiship-gh-346`, read 2026-11-18). In a linked worktree, `git rev-parse --git-dir` returns `<primary>/.git/worktrees/<name>` and `--git-common-dir` returns `<primary>/.git` — verified in this checkout on 2026-11-18.
- **FACT:** The delivered git adapter exposes `currentWorktreePath` (`rev-parse --show-toplevel`), `listWorktrees` (`worktree list --porcelain`), `isCheckedOutElsewhere`, and `isWorktreeClean`; it exposes **no** `--git-dir`/`--git-common-dir` read, so "is this a linked worktree" is not answerable through the delivered port (`packages/adapters/src/git/index.ts`, read 2026-11-18).
- **FACT:** The delivered launcher's failure mode for a vanished target is one bounded stderr line naming the expected target and the remedy, with a non-zero exit; the documentation states that re-running the local install repoints it (`scripts/install.sh` `install_local_launcher`; `doc/guides/local-install.md`, read 2026-11-18).
- **FACT:** `install-model.md` states the safety rules as atomic replace and "failed builds never replace a working install", but contains no worktree rule and no dev-build rule (read 2026-11-18).
- **FACT:** A compiled artifact carries an injected identity, while a non-compiled run falls back to `version: 0.0.0`, `commit: unknown`, `channel: dev` (TDR-0037). That difference is the only reliable in-process signal distinguishing a product artifact from a development run.
- **FACT:** The install destination is derived, never supplied: the brand install path comes from the executable's own read-free `--print-install-path` (`~/.jaiship/bin/jaiship` for the primary identity), and the installer already removes the working-name override from that child's environment so an ambient value cannot redirect it (`scripts/install.sh` `resolve_launcher_path`; `feature-cli-entrypoint.md` §Install posture, read 2026-11-18).

## Problem Framing (Clarified)

"Install target" is ambiguous, and the ambiguity is the whole decision. Three different things could be called the target:

1. **The destination** (`~/.jaiship/bin/jaiship`). It is brand-derived and operator-independent. It is never inside a checkout, so a rule about it is vacuous.
2. **The source artifact** — where the executable came from, and therefore which checkout it resolves to. This is the only operator-controllable input to an install, and under a copied-artifact model it is the *only* remaining link between an install and a checkout.
3. **Any path the install persists for later execution** — today, the legacy launcher's recorded `TARGET`, and the daemon service unit's `ExecStart`.

A rule that binds (1) cannot fire; a rule that binds only (3) fires after the damage is recorded. The rule must bind (2) as the admission gate and (3) as the invariant the record must satisfy. That union is precise enough to be tested, and it is the honest reading of "an install whose target is a worktree".

The second requirement — "dev builds kept out of the delivery path" — is the same defect seen from the other side. An install from a lane worktree is not only a path that disappears; it is a build from a feature branch entering the delivery path. So the exclusion is not a second policy: it is the identity half of the same admission rule. A product artifact must *be* a product artifact (injected identity), and the install must never *produce* one (no build, no download).

The residual risk is false refusal. Most machines that run an install have git; some do not, and a downloaded artifact has no checkout at all. Failing closed on a read that cannot resolve would block exactly the clean-profile install the AC requires, so unreadable git must be "allowed and recorded as unverified", never a refusal.

## Constraints (Hard Requirements)

### C-1: A linked-worktree target is refused with a typed error

- **Statement:** An install whose target resolves inside a **linked git worktree** is refused with a registered error identity, an envelope, and the projected exit; nothing is written.
- **Source:** GH-346 AC; `packages/core/src/contracts/error-table.ts`; `packages/cli/src/projection.ts`.
- **Verification:** Test — a fixture linked worktree is refused with the identity and exit `1`, and the destination is asserted byte-unchanged afterwards.
- **Negotiable:** no.

### C-2: A stable target is never refused

- **Statement:** The primary checkout, a non-worktree checkout, a plain directory holding a released artifact, and a host with no git at all are all admitted.
- **Source:** GH-346 AC ("clean-profile install works"); `install-model.md` (no `sudo`, per-user install).
- **Verification:** Test — four admission cases with the same artifact, three of which have no worktree metadata.
- **Negotiable:** no.

### C-3: An unreadable git state is never a refusal

- **Statement:** When the worktree read cannot resolve (git absent, not a repository, command failure), the install proceeds and the recorded provenance is marked unverified; the refusal class is reserved for a *positive* linked-worktree determination.
- **Source:** C-2; the delivered adapters' absence discipline (an unavailable signal is not a failure to act on).
- **Verification:** Test — a scrubbed `PATH` with no git, and a non-repository directory, both install successfully and record `unverified`.
- **Negotiable:** no.

### C-4: A dev build cannot enter the delivery path

- **Statement:** An install requires a running artifact that carries an injected build identity; a non-compiled run refuses with a typed error, and no install invokes a build tool or a downloader.
- **Source:** GH-346 ("dev builds kept out of the delivery path"); TDR-0037 §3.
- **Verification:** Test — a workspace (non-compiled) invocation refuses; a structure assertion proves the composition spawns nothing and opens no network port.
- **Negotiable:** no.

### C-5: The destination is not operator-selectable

- **Statement:** The destination is exactly the brand install path from the read-free self-description; no flag, environment override, or argument redirects it in this increment.
- **Source:** `feature-cli-entrypoint.md` §Install posture; `scripts/install.sh` (override scrubbed from the probe child).
- **Verification:** Test — an attempt to supply a destination is rejected at argument parsing (`fallback.invocation` shape) rather than silently ignored.
- **Negotiable:** the rejection mechanism is negotiable; the absence of a destination flag is not.

### C-6: The install record may only contain admissible paths

- **Statement:** Every path the install persists (provenance checkout, launcher disposition) must satisfy C-1; a path that would not be admissible is never written.
- **Source:** C-1; the record's own claim to be truthful (TDR-0037 §4).
- **Verification:** Review and test — the record's `sourceCheckout` is asserted admissible in the same test that asserts the refusal.
- **Negotiable:** no.

### C-7: Additive, and no new state contract

- **Statement:** The rule adds one git read, one refusal identity, and record fields; it adds no configuration key, no state record kind, and no environment variable.
- **Source:** GH-346 constraints; TDR-0035 C-2 precedent.
- **Verification:** Review — config catalog and state contracts unchanged; `error-table-sync` green with the documented row.
- **Negotiable:** no.

## Decision Drivers

1. **Defect-class elimination.** The rule should make the recorded-path-into-a-lane failure impossible, not merely rarer.
2. **No false refusals.** A rule that blocks a valid install on a machine without git is worse than no rule.
3. **One detection mechanism.** The discriminator must be a property of the repository itself, not a string prefix heuristic or an ordering assumption.
4. **Operability.** A refusal must tell the operator the path, the worktree, and what to do instead.
5. **Record truthfulness.** Whatever the install records about its origin must remain true after the next merge deletes a worktree.
6. **Reversibility.** Removing the rule must not require unwinding a stored contract.

*(Overlap check: typed refusal, admissibility of stable targets, and unreadable-git tolerance are gates C-1…C-3; they appear here only as ranking values — "how much safety per unit of refusal risk". The gates decide eligibility; the drivers rank the survivors.)*

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-346: the specification is blocked on the detection and naming of the refusal).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-346 PR review. AI does not accept this R2 record.
- **Contributors:** `@pm` (ticket AC and conventions); `@decision-advisor` (analysis and topology probe); `@spec-writer` (carries the rule, detection, and refusal into the change spec and test plan).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`; the owner for acceptance.
- **Performers:** `@coder` (git read, admission check, refusal identity, rollback-slot rule, tests); `@doc-syncer` (adapter reference behavior, local-install guide).
- **Informed:** M4-S2 (migration path), M4-S3 (daemon executed paths), M4-S8 (dogfood installs).

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| The installed command currently records a path into a linked worktree. | FACT | `~/.jaiship/bin/jaiship`, `~/.local/bin/jaiship`, `git worktree list`, observed 2026-11-18 | The defect would be hypothetical and the rule less urgent. | High |
| A linked worktree is distinguishable by `--git-dir` ≠ `--git-common-dir`. | FACT | Probed in this checkout (`<primary>/.git/worktrees/<name>` vs `<primary>/.git`), 2026-11-18 | A different discriminator would be needed (ALT-1). | High |
| The delivered git port exposes no `--git-dir`/`--git-common-dir` read. | FACT | `packages/adapters/src/git/index.ts`, read 2026-11-18 | The rule could be implemented without touching the port. | High |
| The destination is brand-derived and not operator-selectable today. | FACT | `scripts/install.sh` `resolve_launcher_path`; `feature-cli-entrypoint.md` §Install posture, read 2026-11-18 | C-5 would be a new decision rather than a preservation. | High |
| A compiled artifact and a workspace run are distinguishable by the injected identity. | FACT | TDR-0037 §3 (measured) | The dev-build exclusion would need an environment signal. | High |
| The delivered launcher reports a vanished target with one line and a non-zero exit. | FACT | `scripts/install.sh`; `doc/guides/local-install.md`, read 2026-11-18 | The stale-target disposition would be a new behaviour rather than a report. | High |
| Every machine that installs has git available. | ASSUMPTION — deliberately not relied on | — | C-3 exists precisely so this assumption is unnecessary. | n/a |
| `git rev-parse --git-common-dir` is stable across git versions in use. | ASSUMPTION (bounded) | Git documentation | A different normalization could be needed; the read normalizes to an absolute path before comparing, and a failure falls into C-3's allowed-and-unverified branch rather than a false refusal. | Medium-High |
| The primary checkout is the only stable in-repository installation origin in normal use. | ASSUMPTION (declared operating rule) | M4 cadence ("install release → deliver iterations → decide → re-install") | If per-lane installs become desired, the revisit trigger adds a recorded override rather than silently allowing them. | Medium |

## Mental Models & Techniques Used

- **First principles:** What makes an installed path unstable? It lives in a directory whose lifetime is shorter than the install's. Worktrees are the only such directory the product can predict, and `git` can name them exactly. Therefore the rule is a repository-metadata question, not a string question.
- **Inversion:** How does this fail? A rule that compares path prefixes and refuses the primary checkout because it happens to be a prefix of a worktree path; a rule that fails closed when git is missing and blocks the clean-profile AC; a rule that refuses after writing; a rule that promotes the broken launcher into the rollback slot so the defect survives a rollback. C-1…C-6 and §5 exclude each.
- **Second-order thinking:** Refusing a feature-branch build is a short-term inconvenience (build in the primary checkout) that buys a long-term invariant (the installed product never depends on an unmerged branch).
- **Systems thinking:** Three sites persist an executed path (the artifact, the legacy launcher, the service unit). A rule that covers one of them leaves the other two as future defects; §1's definition covers all three without adding a fourth concept.
- **Least privilege:** one bounded read, one identity, no new configuration, no override.
- **Reversibility:** the refusal is a single admission predicate; removing it restores the previous admission set without migrating anything.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 typed refusal | C-2 stable admitted | C-3 no false refusal | C-4 dev exclusion | C-5 fixed destination | C-6 truthful record | C-7 additive |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 no rule (status quo) | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| ALT-1 `worktree list --porcelain` membership/order | ✅ | ✅ | ⚠️ | ❌ | ✅ | ✅ | ✅ |
| ALT-2 path-prefix comparison against the primary checkout | ⚠️ | ⚠️ | ⚠️ | ❌ | ✅ | ⚠️ | ✅ |
| ALT-3 refuse any git checkout | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-4 `--git-dir` ≠ `--git-common-dir` + identity gate (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-5 warn instead of refuse | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only with additional unproven work.

### Alternative 0 — No Rule (Status Quo)

- **Eligibility:** Not eligible (fails C-1, C-4, C-6).
- **Summary:** Keep installing whatever path the operator's checkout implies.
- **Constraint compliance:** The delivered defect is this alternative; it records paths that stop being true at the next merge.
- **Driver fit:** Fails 1, 3, 5.
- **Pros:** Nothing to build.
- **Cons:** The ticket exists because of it, and the failure is silent until the worktree disappears.
- **Why rejected:** It is the defect.

### Alternative 1 — Detect by `worktree list --porcelain` Membership or Order

- **Eligibility:** Eligible, ranked below ALT-4.
- **Summary:** Enumerate worktrees and decide by membership of the candidate path, or by "the first entry is the primary".
- **Constraint compliance:** Passes C-1 and C-2 for the common case; weaker on C-3 (an unreadable list must be distinguished from an empty one) and on driver 3, because ordering and path-format assumptions leak in (a `.git` file, a bare repo, a worktree whose path is a symlink).
- **Driver fit:** Good on 4; fails 3 cleanly.
- **Pros:** Reuses a delivered read (`listWorktrees`); no port change.
- **Cons:** Membership is a set question answered by string equality over porcelain output; ordering is documented as implementation-defined for the primary entry in edge cases, and the comparison decides admission.
- **Why rejected:** It answers "is this path in the list" instead of "is this checkout linked", and the two differ exactly where the rule matters.

### Alternative 2 — Path-Prefix Comparison Against the Primary Checkout

- **Eligibility:** Not eligible (fails C-1 and C-3 in the general case).
- **Summary:** Treat a candidate as a worktree when its path is not the primary checkout's path.
- **Constraint compliance:** Needs to *find* the primary checkout (another heuristic), refuses sibling checkouts that are independent clones, and fails on paths that are prefixes of each other.
- **Driver fit:** Fails 1 and 3.
- **Pros:** No git call beyond `--show-toplevel`.
- **Cons:** A string heuristic deciding admission, which is the class of bug this repository avoids in adapter data.
- **Why rejected:** It cannot distinguish a clone from a worktree.

### Alternative 3 — Refuse Any Target Inside a Git Checkout

- **Eligibility:** Not eligible (fails C-2).
- **Summary:** Admit only artifacts with no checkout.
- **Constraint compliance:** Refuses the primary checkout, which is the documented installation origin for the local model, so it blocks the AC's own workflow.
- **Driver fit:** Best on 1; worst on 2 and 4.
- **Pros:** Trivially safe against the defect class.
- **Cons:** Makes the local install model impossible.
- **Why rejected:** Over-broad to the point of unusability.

### Alternative 4 — `--git-dir` ≠ `--git-common-dir`, Plus the Identity Gate (chosen)

- **Eligibility:** Eligible.
- **Summary:** Normalize both paths to absolute; refuse when they differ (a linked worktree) and when the running artifact carries no injected identity (a dev run); admit otherwise, recording an unverified provenance when the read cannot resolve.
- **Constraint compliance:** C-1 through the predicate and the refusal identity; C-2 because the primary checkout has equal dirs and a plain directory has none; C-3 by treating read failure as a distinct outcome from a positive determination; C-4 by the identity gate; C-5 preserved; C-6 because only admissible paths are recorded; C-7 one read, one row.
- **Driver fit:** Best on 1, 2, 3, 5; good on 4 (the refusal names the paths) and 6.
- **Pros:** The discriminator is the repository's own metadata; one extra bounded read; no ordering or prefix assumptions.
- **Cons:** One new read on the git port, which changes a pinned adapter surface and its parity baseline.

### Alternative 5 — Warn Instead of Refuse

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Install anyway and print a warning naming the worktree.
- **Constraint compliance:** Fails the AC's "refused"; the recorded provenance still becomes false at the next merge.
- **Driver fit:** Good on 2 and 4; fails 1 and 5.
- **Pros:** Never blocks an install.
- **Cons:** The warning is exactly as ignorable as the current failure is silent.
- **Why rejected:** The AC asks for a refusal, and a warning reproduces the defect with extra output.

## Decision

- **Decision:** Adopt ALT-4. One **install-target stability rule** with two limbs — a checkout-admission predicate and a dev-artifact gate — implements both GH-346 requirements.

### 1. Definitions (normative)

- **Install target:** the running artifact the install copies into place, together with the git checkout that artifact resolves to. It is the only operator-influenceable input to an install.
- **Destination:** the brand install path returned by the read-free self-description. It is derived, never supplied (C-5).
- **Recorded provenance:** the fields the install record keeps about the target — checkout path, commit, dirty flag, and verification state.
- **Executed path:** any path the product persists for later execution — the installed artifact, a legacy launcher's `TARGET`, and a service unit's `ExecStart`.

### 2. The stability rule (admission)

An install proceeds only when all of the following hold; each failure is a distinct, named outcome.

| Rule | Predicate | Outcome when it fails |
|---|---|---|
| **S-1 linked worktree** | `git -C <targetDir> rev-parse --git-dir` and `--git-common-dir`, both normalized to absolute paths, differ | Refuse: `install.target.worktree` (exit `1`) |
| **S-2 no git metadata** | the two reads fail (git absent, not a repository, command error) | Admit; record provenance `unverified` |
| **S-3 stable checkout** | the two reads succeed and are equal | Admit; record provenance `verified` |
| **S-4 destination** | the destination equals the brand install path | (C-5) — the destination is not an input, so this cannot fail by operator action |

- **Detection is repository metadata, never a string compare:** no path-prefix test, no reliance on `worktree list` ordering, no assumption that the primary checkout sorts first.
- **`<targetDir>` is the artifact's own directory**, so an artifact in `<worktree>/dist/` and one in `<worktree>/packages/cli/bin/` are both detected; a subdirectory of a worktree resolves through `git -C`.
- **A bare repository or a `.git`-file checkout** (submodule-style) also yields a positive or negative determination from the same two reads; a failure falls to S-2, never to a refusal.

### 3. The refusal (identity and content)

- **Identity:** one registered error in the install domain (`install.target.worktree`), `category: user`, `retryable: false`, `consequence: not_landed`, `projectionClass: user-validation` → exit `1`.
- **Content:** the detail names the target directory, the worktree's git directory, and the common git directory; the remedy states the two admissible origins — the primary checkout, or a plain directory holding a released artifact — and states that a lane worktree is deleted after merge.
- **Nothing is written** before the refusal: the check runs before staging, before the record, and before any PATH modification. The destination's bytes and mtime are unchanged (asserted in the test).

### 4. The dev-build exclusion (identity gate)

| Rule | Predicate | Outcome |
|---|---|---|
| **D-1 product artifact** | the running artifact carries an injected build identity (`TDR-0037` §2) | Admit |
| **D-2 development run** | the running artifact carries the dev fallback identity | Refuse: `install.dev-build` (exit `1`), naming the build command and the artifact path convention |
| **D-3 no build, no download** | the install never invokes a build tool, a package manager, or a network client | Enforced by construction and by a structure assertion over the composition |

- **Why refuse rather than flag:** the delivery path must be a product artifact; a workspace run has no stable identity, may be edited mid-run, and cannot be recorded truthfully. Refusing is the only outcome that keeps the install record honest.
- **Why this is the same rule and not a second policy:** the defect the ticket names is an install that depends on a disposable thing. A lane worktree is disposable on disk; a workspace run is disposable in content. Both make the installed product non-reproducible, and both are detected from evidence the install already has.

### 5. Existing artifacts at the destination

Disposition is decided by **content agreement** with the running artifact — never by a claimed identity, which is a compile-time constant no process can read out of a file, and never by the install record, which is a repair source and not a gate (TDR-0040 §2 step 4, §2.1).

| Situation found at the destination | Disposition |
|---|---|
| Content equals the running artifact; record `current` | **Left as it is**: no staged copy, no rename, no slot swap, and nothing written (TDR-0040 §2 step 4, §2.1) |
| Content equals the running artifact; record `record-stale`, damaged, or absent | **Left as it is**: no rename and no slot swap; the record is reconciled in place to `current`, with `previous` taken from a readable record or written absent and reported unknown (TDR-0040 §2.1) |
| Content differs (a compiled artifact that is not the running artifact) | Becomes the rollback slot, only through the step-5 rename of the atomic replace (TDR-0040 §2) |
| Delivered bash launcher (GH-320 shape) | **Discarded with a report**, never promoted to the rollback slot; its recorded target is reported, including the case where the target is missing or inside a worktree — the live defect is repaired, not inherited |
| Bash launcher whose recorded target vanished | Same as above: discarded with a report naming the missing target |
| Symlink to another artifact | Replaced (the link is replaced, not written through); the reported disposition names the link and its target |
| Nothing | Created |

- **`jaiship.previous` may only ever hold a compiled artifact.** Rollback refuses with a typed error when the slot is absent or does not carry an injected identity, rather than restoring a launcher.
- **A legacy launcher is not a rollback candidate** because restoring it restores the defect the rule exists to remove.
- **Amendment note:** the content-agreement restatement above rides the same DoR iteration-1 amendment that TDR-0040 carries (§2 step 4, §2.1). This record has no `### Amendment` section of its own because the decision is unchanged; only the disposition wording is restated to match that amendment.

### 6. What is explicitly not refused

- The primary checkout.
- A non-worktree clone or a plain directory holding a released artifact.
- A host with no git, or a directory that is not a repository (allowed and recorded `unverified`).
- A dirty or mid-change repository: the rule is about *where* the target lives, never about its working-tree state — the AC requires delivery to keep running while the repository is dirty or mid-change.
- A compiled artifact built from a dirty tree: admitted, reported as `<commit>-dirty` (TDR-0037 §3), and visible in `install status`.

### 7. Read and purity

- **One new read on the git port**, of the same fixed-argv, no-shell shape as the delivered reads: it returns the two directories or an absence, and never throws.
- The read is injected at the process edge like every other port; the admission predicate is runtime-neutral and performs no I/O of its own.
- The pinning consequence is declared: the adapter's pinned export surface and the exports-parity baseline move once (see Consequences).

### Constraint Compliance Attestation

The chosen alternative (ALT-4) satisfies every constraint C-1 through C-7. No accepted-risk exceptions are taken. Two properties are declared rather than claimed: the discriminator is a **positive** determination (`--git-dir` ≠ `--git-common-dir`) so an unreadable git state can never produce a refusal, and installing from the primary checkout is an **operating requirement** this decision introduces, not a neutral default — the owner accepts the inconvenience, and the revisit trigger records the override route.

**Reversal.** Removing the admission predicate restores the previous admission set; nothing stored depends on it except the `verified`/`unverified` provenance, which stays readable and true. The rollback-slot guard is independent and must be kept on any reversal: it is what stops a bash launcher from being restored as a product artifact.

## Trade-offs & Consequences

### Positive Outcomes

- The ticket's defect class becomes impossible by admission: no install can record or preserve a lane-worktree path.
- The refusal names the path and both git directories, so the operator's next action is obvious.
- A host without git is not punished: the common downloaded-artifact case degrades to `unverified` instead of failing.
- Dev builds are excluded by evidence the product already carries, with no environment variable and no configuration key.
- The rollback slot can no longer be filled with a launcher, so "rollback restores the defect" is impossible.

### Negative Outcomes

- **Installing from a lane worktree is refused.** This is deliberate, and it changes an existing habit: a dogfood install must come from the primary checkout or a prepared directory. The revisit trigger records the override route if that becomes a real workflow.
- **One new git read and a pinned-surface change.** The adapter reference behavior, the export surface, and the parity baseline must be updated in the same change.
- **A new refusal can block an install** where a warning would not. The refusal is bounded to a positive determination, and C-3 keeps the failure classes separate.
- **`unverified` provenance is a permanent declared state**, not an error: an install from a tarball is legitimate and its record says so.
- **The primary checkout becomes a declared operating requirement** for in-repository installs, which the local-install guide must state plainly or the refusal will look arbitrary.

### Unresolved Questions

- [ ] Whether `install status` should surface the legacy launcher's recorded target *after* it has been discarded (the disposition is reported once at install time; a later status read has nothing to report). Owner: `@spec-writer`; the install record's launcher-disposition field is the natural home.
- [ ] Whether the rule should also cover a **hard link** at the destination (a hard link cannot be detected portably from the link side). Owner: `@spec-writer`; the delivered atomic replace overwrites the directory entry regardless, so the current answer is "not covered, and the replace still makes the destination stable".
- [ ] Whether `--migrate` should be subject to the same admission rule for the artifacts it would move (yes by construction, since it never moves anything in this increment — see TDR-0040 §8).

## Implementation Plan

1. **Git read.** Add the two-directory read to the git adapter in the delivered fixed-argv shape; return an absence rather than an error; update the adapter reference behavior and the surface/parity baselines.
2. **Predicate.** A runtime-neutral admission function over the read result: `linked-worktree` | `verified` | `unverified`, with no I/O.
3. **Refusal identities.** Register `install.target.worktree` and `install.dev-build`; document both rows; assert identities and exit `1` in tests.
4. **Order of operations.** Admission (S-1…S-3) → dev gate (D-1/D-2) → destination disposition (§5) → staging. Assert that no write precedes admission.
5. **Rollback-slot guard.** Refuse to promote or restore anything that lacks an injected identity.
6. **Tests.** Linked-worktree refusal with byte-unchanged destination; primary checkout; plain directory; no-git `PATH`; non-repository directory; dirty tree admitted; dev run refused; launcher discarded and reported; launcher with vanished target discarded and reported; rollback-slot guard both arms.
7. **Docs.** The local-install guide states the admissible origins and the dev-build requirement; the adapter reference behavior states the new read; the CLI entrypoint page states the refusal's place in the install posture.

## Verification Criteria

- Metric: refusal — a fixture linked worktree is refused with `install.target.worktree` at exit `1`, the destination is byte- and mtime-unchanged, and no record is written. Target: exact. Window: GH-346 CI.
- Metric: admission — primary checkout, non-worktree clone, plain directory, and no-git host all install successfully; provenance is `verified`, `verified`, `unverified`, `unverified` respectively. Target: 4/4. Window: GH-346 CI.
- Metric: dev exclusion — a non-compiled invocation is refused with `install.dev-build` at exit `1`; the composition spawns no build and opens no network port. Target: exact. Window: GH-346 CI.
- Metric: rollback safety — the slot refuses a launcher, a missing slot, and a non-identity artifact; a compiled artifact round-trips. Target: 4/4. Window: GH-346 CI.
- Metric: dirty-tree tolerance — an install from a dirty primary checkout succeeds and reports `<commit>-dirty`. Target: exact. Window: GH-346 CI.
- Metric: additive — no configuration key, state record kind, or environment variable is introduced; the error rows are documented. Target: exact. Window: `pnpm check` on GH-346.

## Confidence Rating

**High** for the discriminator: the two-directory difference was verified in this repository's own topology, and it is the property git documents for linked worktrees rather than an inference from output ordering. **High** for the refusal class and its exit projection: the error register and the projection module are delivered and pinned. **High** for the dev-build gate: the identity distinction is a measured property of the artifact (TDR-0037). **Medium** for the operating rule "install from the primary checkout": it is the right default, but it is a workflow constraint the owner should confirm accepts the inconvenience; the revisit trigger records the alternative route.

## References

- GH-346 ticket body — `gh issue view 346 -R juliusz-cwiakalski/agentic-delivery-os`
- M4 blueprint — `doc/planning/oss-tooling/milestones/m4/README.md` (EC-1, risk "Installed-vs-source confusion"), `backlog.md` (S1), `install-model.md`, `ranking.md`
- Live defect evidence — `~/.jaiship/bin/jaiship`, `~/.local/bin/jaiship`, `git worktree list`, `git rev-parse --git-dir --git-common-dir`, observed 2026-11-18
- Delivered installer launcher and its probe — `scripts/install.sh` (`install_local_launcher`, `resolve_launcher_path`, `CLI_ENTRY_RELATIVE`), `doc/spec/features/feature-doc-distribution-marker.md`, `doc/guides/local-install.md`
- Install posture and read-free self-description — `doc/spec/features/feature-cli-entrypoint.md` §Install posture, §Runtime neutrality
- Delivered git reads — `packages/adapters/src/git/index.ts`, `doc/spec/features/feature-adapter-reference-behavior.md`
- Refusal contract — `packages/core/src/contracts/error-table.ts`, `packages/cli/src/projection.ts`, `.ai/rules/typescript.md` §7
- Prior change record — `doc/changes/2026-11/2026-11-15--GH-320--jaiship-binary/chg-GH-320-spec.md` §8.5, §17 (AC-F6-8), §22
- [TDR-0036](TDR-0036-install-lifecycle-composed-command-family.md) — the surface that carries this rule
- [TDR-0037](TDR-0037-self-contained-binary-build-identity.md) — the artifact and identity this rule gates
- [TDR-0040](TDR-0040-upgrade-rollback-uninstall-purge-boundaries.md) — the atomic replace and rollback slot this rule protects
