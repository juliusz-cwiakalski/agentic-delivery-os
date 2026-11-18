---
id: TDR-0037
decision_type: tdr
status: Proposed
created: 2026-11-18
decision_date: null
last_updated: 2026-11-18
summary: "The product artifact is one `bun build --compile` executable built from the primary bin, with the build identity (lockstep version, full commit, built-at, dirty flag) injected at build time through `--define` and read at runtime as compile-time constants — so `--version` keeps its delivered one-line shape with the commit in the existing build slot and performs no state, network, git, or configuration read. `builtAt` and the full commit travel on a machine surface (`install status --json`), never in the version line; a run that carries no injected identity is a dev build and reports `0.0.0 (build dev)` verbatim as delivered."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os release artifact and CLI build identity"
decision_scope: repo
review_date: null
business_impact: "M4 EC-1 requires a product artifact with zero coupling to the source tree, and ADR-0009 requires one version line and per-release artifacts. Without build-time identity the installed binary cannot say which build runs, M4-S2 has no artifact to sign, and the operator has no way to tell an upgrade from a no-op."
customer_impact: "An operator can prove which build is installed from a single `--version` line that names the commit, and can ask a command for the full build facts and installed-vs-running comparison, without the binary reading the source tree or the network."
classification:
  domains: [architecture, tooling, contracts, operations]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-346: the change specification is blocked on the artifact and its identity)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-346 PR review; AI does not accept this R2 record"
  contributors:
    - "@decision-advisor (repository analysis, measured compile probe, and this record)"
    - "@pm (GH-346 clarify_scope: version+commit AC, dev builds kept out of the delivery path)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-346 PR review — this record fixes the version text and the artifact contract)"
  performers:
    - "@coder (GH-346 delivery: build script, identity plumbing through the process edge, process-edge entry-path fix, tests)"
    - "@doc-syncer (CLI entrypoint, local-install guide, release wording)"
  informed:
    - "M4-S2 release automation (signs, hashes, and publishes this artifact per ADR-0009)"
    - "M4-S3 command conformance (runs the battery against this artifact)"
    - "M4-S8 dogfood window (evidence collects the identity)"
ai_assistance:
  used: true
  roles: [repository-analyst, simulator, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "M4-S2 introduces signed release artifacts: decide whether the artifact name, checksum manifest entry, and `builtAt` participate in the release contract, rather than changing the identity fields here."
  - "A second platform must be supported (cross-compilation or per-OS artifacts): decide the target matrix and whether `--version` must name the target, rather than silently shipping a host-only artifact."
  - "Reproducible builds become a requirement: remove `builtAt` from the identity (or move it out of the artifact) and re-baseline the release attestations, rather than claiming reproducibility with a timestamp inside the binary."
  - "Artifact size becomes an operational problem: decide on minification or a stripped build and re-measure, rather than adding a second build path."
  - "The daemon must be pinned to the installed artifact rather than the running executable: decide that under M4-S3 daemon work and supersede §5, which deliberately keeps the delivered re-entry source and only corrects it for the compiled shape."
links:
  related_changes: ["GH-346", "GH-320", "GH-186"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-cli-entrypoint.md"
    - "doc/guides/local-install.md"
    - "doc/planning/oss-tooling/milestones/m4/install-model.md"
    - "doc/changes/2026-11/2026-11-15--GH-320--jaiship-binary/chg-GH-320-spec.md"
  contracts:
    - "packages/cli/bin/jaiship.ts"
    - "packages/cli/src/bin-launcher.ts"
    - "packages/cli/src/entrypoint.ts"
    - "packages/cli/package.json"
    - "package.json"
  diagrams: []
  decisions: ["TDR-0036", "TDR-0038", "TDR-0039", "ADR-0009", "ADR-0003"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S1", "M4-S2", "M4-S3"]
---

# TDR-0037: Self-Contained Artifact and Build Identity — `bun --compile` with `--define`-Injected Identity, Commit in the Delivered Build Slot

## Context

- **FACT:** The delivered version text is `${brand.binaryName} ${version} (build ${build})` on one line, with `version` and `build` defaulting to `0.0.0` and `dev` and supplied only through the entrypoint's optional `version`/`build` inputs (`packages/cli/src/entrypoint.ts`, read 2026-11-18).
- **FACT:** Production **never supplies** those inputs: the bin passes argv/environment/cwd/streams/daemon entry to the launcher and the launcher passes neither `version` nor `build` to `runEntrypoint` (`packages/cli/bin/jaiship.ts`, `packages/cli/src/bin-launcher.ts`, read 2026-11-18). The installed launcher therefore reports `jaiship 0.0.0 (build dev)` — observed live on 2026-11-18.
- **FACT:** `--version`, `--help`, and `--print-install-path` are contractually read-free: no state read, no git read, no configuration read, no network, no composer invocation, proven with a throwing composer and a poisoned environment (`doc/spec/features/feature-cli-entrypoint.md` §Runtime neutrality, §Quality evidence; GH-320 NFR-2, read 2026-11-18). GH-320's AC pins the line shape as `jaiship <version> (build <build>)`.
- **FACT:** Both bins are thin `.ts` entries executed by the Bun runtime; the installed launcher records one absolute path to `packages/cli/bin/jaiship.ts` and execs `bun` on it (`scripts/install.sh` `install_local_launcher`, read 2026-11-18). That is the coupling the story names: the product artifact is a runtime plus a source file.
- **FACT:** The pin is Bun 1.4.4 (`package.json` `engines`, `.bun-version`), and the delivered build is TypeScript-only (`packages/cli` `build: tsc -p tsconfig.json`); nothing in the repository produces a self-contained executable today.
- **FACT:** A compile probe on this checkout succeeded: `bun build --compile --outfile <out> ./packages/cli/bin/jaiship.ts` bundled 574 modules into a single 107 MB executable that answered `--version` (`jaiship 0.0.0 (build dev)`), `--print-install-path` (`~/.jaiship/bin/jaiship`), `--help`, and a composed `status --json` correctly (measured 2026-11-18).
- **FACT:** In a compiled artifact, `process.argv` is `["bun", "/$bunfs/root/<name>", ...userArgs]` and `process.execPath` is the artifact path; the delivered `argv.slice(2)` therefore still yields the user arguments, while the delivered `daemonEntry: process.argv[1]` would yield the virtual `/$bunfs/root/<name>` path (measured 2026-11-18).
- **FACT:** `--define '<SYMBOL>=<json>'` substitutes a compile-time constant, and a source expression guarded by `typeof <symbol> === "undefined"` falls back cleanly when no define is supplied — both arms verified with Bun 1.4.4 (measured 2026-11-18).
- **FACT:** ADR-0009 fixes one lockstep version line for the five publishable packages, tagged signed releases with `SHA256SUMS`, SBOM, and notices, and per-release CLI/MCP artifacts; M4-S2 owns release automation within that contract. The root manifest version is `0.0.0` today.
- **FACT:** The committed working-name literals are a declared, bidirectionally-compared inventory (three CLI selector sites, the unchanged MCP default, the resolver's scope-org input), enforced by the content-inventory structure suite (`doc/spec/features/feature-cli-entrypoint.md` §Composition, AC-F7-10 of GH-320, read 2026-11-18).
- **FACT:** The daemon composition consumes `daemonEntry` for the detached re-entry spawn (`daemon start` without `--foreground`) and for the installed service unit's `binary` (`packages/cli/src/daemon-compose.ts`, `packages/cli/src/production.ts`, read 2026-11-18).

## Problem Framing (Clarified)

Two questions are entangled and must be answered separately:

1. **What is the artifact?** The ticket requires "a self-contained build … no coupling to the source tree". A `.ts` entry executed by `bun` is not an artifact: it needs a runtime on `PATH` and a source file at an absolute path. Any answer to this question changes the install story, the daemon re-entry story, and the release story.
2. **Where does the identity come from without a read?** `--version` may not read git, state, or configuration. So the identity must be captured **before** the reads are forbidden — at build time — and must reach the process edge as data. The repository already has exactly that seam (`version`/`build` are injected inputs); it is simply never used in production.

The second question has a sub-question the ticket forces: the AC requires version **and commit**, while the delivered line has one `(build <build>)` slot and GH-320 pins the shape. Re-shaping the line would break a delivered contract to satisfy a new one; leaving the slot as an opaque label ("dev") would satisfy the shape and report nothing. The resolution is to make the existing slot **mean** the build identity — it was always the build's name.

Finally, the compiled shape changes the process edge's facts. `process.argv[1]` stops naming an executable, so the daemon's re-entry source must be corrected in the same decision, or the first detached `daemon start` from an installed binary would spawn `/$bunfs/root/jaiship`.

## Constraints (Hard Requirements)

### C-1: One self-contained artifact with zero runtime reference to the source tree

- **Statement:** The installed artifact is a single executable that runs with no `bun`/`node` on `PATH`, no TypeScript source file, and no workspace `node_modules` present.
- **Source:** GH-346 ("self-contained build … a product artifact, not a checkout"); M4 EC-1; `install-model.md` Constraints ("at runtime it never references the source checkout").
- **Verification:** Test — copy the artifact to an empty directory with a scrubbed `PATH` and no checkout, then run `--version`, `--help`, and one composed command successfully.
- **Negotiable:** no.

### C-2: Self-description stays read-free

- **Statement:** `--version`, `--help`, and `--print-install-path` perform zero state, git, configuration, and network reads and no write, before and after this change; the identity is a compile-time constant, not a runtime observation.
- **Source:** GH-320 NFR-2; `feature-cli-entrypoint.md` §Runtime neutrality; GH-346 ("no runtime source-tree or git read").
- **Verification:** Test — the delivered isolation suite (throwing composer, poisoned environment, unreadable configuration) plus a run from a directory with no git repository and no `HOME` content.
- **Negotiable:** no.

### C-3: The delivered `--version` shape and alias bytes are preserved

- **Statement:** The line remains `<binary-name> <version> (build <build>)` on one line, exit `0`; the alias keeps producing byte-identical output for the same injected identity; no field is added to the line and no `--json` mode is added to `--version`.
- **Source:** GH-320 AC-F1-1 and AC-F2-3; `feature-cli-entrypoint.md` §Interface contract; GH-346 C-4 (additive).
- **Verification:** Test — the delivered version suite unchanged; a byte comparison of the alias line for the same identity; an assertion that `--version --json` output is unchanged from `--version`.
- **Negotiable:** no.

### C-4: The artifact reports version **and** commit

- **Statement:** Every compiled artifact reports its lockstep version and its source commit through the delivered `--version` line, and the full identity (version, full commit, built-at, dirty flag) is retrievable from a machine surface.
- **Source:** GH-346 AC ("the binary reports version+commit"); ADR-0009 (one version line; provenance per release).
- **Verification:** Test — an artifact built from a known commit prints that commit; `install status --json` carries all four fields.
- **Negotiable:** no.

### C-5: Identity is captured at build time, never inferred at run time

- **Statement:** Version, commit, built-at, and dirty state are produced by the build; no runtime code path derives any of them from `package.json`, git, file mtimes, or the environment.
- **Source:** C-2; `install-model.md` ("build identity … installedAt").
- **Verification:** Structure test — the identity module imports nothing ambient and contains no `process`, `Bun`, or child-process call; review — the only producer is the build script.
- **Negotiable:** no.

### C-6: No identity literal is added to the product surface

- **Statement:** The artifact name and every derived name come from one declared site; no new working-name literal enters a handler, a composer, or a library module.
- **Source:** GH-320 AC-F7-10 (bidirectional literal inventory); `feature-cli-entrypoint.md` §Identity resolution.
- **Verification:** Structure test — the inventory comparison passes with exactly one additional declared build-side site.
- **Negotiable:** the *location* of the one build-side site is negotiable; its declaration and registration are not.

### C-7: The compiled shape must not break the process edge

- **Statement:** Argument parsing, the detached daemon re-entry, and the installed service unit must name the real executable after the change; a compiled artifact must never spawn or install `/$bunfs/root/...`.
- **Source:** Delivered daemon composition; GH-346 ("delivery runs while the repository is dirty or mid-change" — a daemon that cannot restart is a delivery stop).
- **Verification:** Test — a compiled-artifact probe asserts the re-entry entry path equals the artifact path, and a non-compiled run keeps the delivered `argv[1]` value.
- **Negotiable:** no.

## Decision Drivers

1. **Zero coupling to the checkout.** The artifact must survive deleting any worktree, which is the ticket's whole premise.
2. **Read-free self-description.** The isolation contract is a delivered invariant with a dedicated suite; it may not be relaxed to make identity easier.
3. **One version line, no second identity.** ADR-0009 already fixed one version line; the artifact must not invent a build-version scheme beside it.
4. **Delivered-contract preservation.** The version text, the alias bytes, and the help/version isolation suite are pinned by a delivered change and should not be re-litigated.
5. **Reproducibility honesty.** Whatever the artifact carries must be true; a timestamp inside the binary must be declared as making byte-identical rebuilds impossible.
6. **Operational diagnosability.** An operator must be able to answer "which build is installed" from one line and "is it the build I installed" from one command.
7. **Paved road and pin discipline.** Bun is the pinned toolchain; the build must use the shipped runtime, not introduce a second one.

*(Overlap check: read-freedom, shape preservation, and the process-edge repair are gates C-2, C-3, C-7; they appear here only as ranking values — "how much diagnosability per unit of contract change". The gates decide eligibility; the drivers rank the survivors.)*

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-346: the specification is blocked on the artifact and its identity).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-346 PR review. AI does not accept this R2 record.
- **Contributors:** `@pm` (ticket AC and conventions); `@decision-advisor` (analysis, measured compile probe, record); `@spec-writer` (carries the identity fields and the version contract into the change spec).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`; the owner for acceptance.
- **Performers:** `@coder` (build script, identity module, process-edge plumbing, tests); `@doc-syncer` (entrypoint page, local-install guide, release wording).
- **Informed:** M4-S2 (release automation), M4-S3 (conformance battery on the artifact), M4-S8 (evidence collection).

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| Production never injects `version`/`build`, so the installed binary reports `0.0.0 (build dev)`. | FACT | `entrypoint.ts`, `bin-launcher.ts`, live `~/.jaiship/bin/jaiship --version`, read 2026-11-18 | Build identity would already exist and this decision would be smaller. | High |
| Self-description is contractually read-free and pinned by a dedicated suite. | FACT | `feature-cli-entrypoint.md` §Runtime neutrality; GH-320 NFR-2, read 2026-11-18 | A runtime identity read would be admissible and ALT-5 would be eligible. | High |
| The version line shape and the alias bytes are pinned by GH-320 ACs. | FACT | `chg-GH-320-spec.md` §17, read 2026-11-18 | A richer version line could be acceptable. | High |
| `bun build --compile` produces a working single-file artifact from the primary bin on this toolchain. | FACT | Measured on 2026-11-18 (574 modules, 107 MB, `--version`/`--help`/`--print-install-path`/`status --json` all correct) | The chosen alternative would be unproven and a different toolchain would be required. | High |
| A compiled artifact's `argv`/`execPath` shape is `["bun", "/$bunfs/root/<name>", …]` / artifact path. | FACT | Measured on 2026-11-18 | `argv.slice(2)` would need changing and the daemon fix would be unnecessary. | High |
| `--define` substitutes a JSON object and a `typeof` guard falls back when absent. | FACT | Measured on 2026-11-18 | Identity injection would need a generated module and C-5's verification would change. | High |
| ADR-0009 fixes the lockstep version line and per-release artifacts. | FACT | `ADR-0009-release-model-v1.md`, read 2026-11-18 | The version source would be a free choice rather than the root manifest. | High |
| The working-name literal inventory is bidirectional and enforced. | FACT | `feature-cli-entrypoint.md` (AC-F7-10), `tests/structure/content-inventory.test.ts`, read 2026-11-18 | The build-side identity site would not need registering. | High |
| The artifact is 107 MB unminified. | FACT | Measured 2026-11-18 | Size would not need to be declared as an accepted cost. | High |
| Bun's compiled output is stable enough for a released artifact at the pinned version. | ASSUMPTION (bounded by the pin and re-proven per release) | Toolchain pin `1.4.4` | A runtime upgrade could change bundling behaviour or `argv`/`execPath` semantics; the probe test in C-7 catches it. | Medium |
| The artifact runs on the same OS/architecture family it was built on. | ASSUMPTION (declared limit) | No cross-compilation attempted | Cross-platform installs would need the revisit trigger's matrix decision. | Medium |
| No delivered module imports a Bun-only API that breaks under `--compile`. | FACT | The probe executed a composed command successfully | An unanticipated dynamic import could fail at run time; the scrub-`PATH` test in C-1 covers it. | Medium-High |

## Mental Models & Techniques Used

- **First principles:** What must be true for `--version` to report a commit without reading anything? The commit must be a constant in the binary. What must be true for a binary to be a constant? It must be built from the commit. That chain forces build-time injection and nothing else.
- **Inversion:** How does this fail? A binary that reports `dev` forever (delivered today); a binary that reads git and dies outside a checkout; a version line that grows a field and breaks a pinned contract; a compiled daemon that respawns a virtual path; a build that mutates the source tree to record identity. C-2, C-3, C-5, C-7 and ALT-4 exclude each.
- **Second-order thinking:** Putting the commit in the existing build slot costs nothing today and makes every later evidence artifact (M4-S8 dogfood window, M4-S2 release provenance) self-identifying. Adding a second identity field to the line would cost a contract change now and a compatibility story later.
- **Systems thinking:** The artifact is consumed by the installer (TDR-0036/0040), the compatibility check (TDR-0039), the daemon, and the release train (M4-S2). An identity that only `--version` can see would leave four consumers to invent their own.
- **Least privilege:** one build-side literal, one identity module, zero new runtime reads, zero network.
- **Paved road:** Bun is already the pinned runtime and already executes every entry; `--define` is the toolchain's own build-time constant mechanism.
- **Reversibility:** the identity module can be reverted to the dev fallback and the artifact to a bundled entry; nothing is persisted in the repository.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 self-contained | C-2 read-free | C-3 shape/alias | C-4 version+commit | C-5 build-time | C-6 no new literal | C-7 process edge |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 keep the `.ts` entry + launcher | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| ALT-1 `bun build` bundle executed by the Bun runtime | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 `bun build --compile` + `--define` identity (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 Node SEA / `pkg` / `deno compile` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| ALT-4 build rewrites a committed identity module | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| ALT-5 runtime read of git/manifest for `--version` | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only with new unproven work (see ALT-3).

### Alternative 0 — Keep the TypeScript Entry and the Launcher

- **Eligibility:** Not eligible (fails C-1, C-4).
- **Summary:** Ship `packages/cli/bin/jaiship.ts` and a launcher that execs `bun` on it; nothing is compiled.
- **Constraint compliance:** Fails C-1 (needs the runtime and a source file at an absolute path — the live defect) and C-4 (no identity at all; the binary reports `dev`).
- **Driver fit:** Fails 1, 3, 6; passes 2, 4, 5 trivially.
- **Pros:** Zero build work; every diagnostic points at a readable source file.
- **Cons:** The install breaks when its checkout or worktree disappears; the ticket exists because of this.
- **Why rejected:** It is the defect.

### Alternative 1 — A Bundled Single-File JavaScript Executed by the Bun Runtime

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** `bun build` to one `.js` bundle, installed beside a launcher that execs the runtime.
- **Constraint compliance:** Fails C-1: a runtime must exist on the host and the artifact is not self-contained; identity injection is easy (bundled constants).
- **Driver fit:** Strong on 4 and 7; fails 1 and 6.
- **Pros:** Small artifact; fast build; readable stack traces.
- **Cons:** The product still requires a host runtime and a stable absolute path — half the defect remains, and the "clean-profile install" acceptance would silently depend on `bun` being on `PATH`.
- **Why rejected:** It leaves the coupling that the story names.

### Alternative 2 — `bun build --compile` with `--define`-Injected Identity (chosen)

- **Eligibility:** Eligible.
- **Summary:** One executable compiled from the primary bin; version, commit, built-at, and dirty flag injected as a compile-time object; a dev run without the define falls back to `0.0.0`/`dev`; the build slot of the version line carries the commit token.
- **Constraint compliance:** C-1 proven by measurement; C-2 by construction (constants only); C-3 by leaving the text shape untouched; C-4 by the build token plus the machine surface; C-5 by the build script being the only producer; C-6 with exactly one declared build-side site; C-7 by the re-entry correction in §5.
- **Driver fit:** Best on 1, 2, 3, 6, 7; honest on 5 (the timestamp's non-reproducibility is declared, not hidden).
- **Pros:** Actual self-containment, verified; no second runtime; the identity seam already exists in the entrypoint; the dev fallback keeps workspace runs and every test unchanged.
- **Cons:** 107 MB unminified artifact; host-only builds; the compiled `argv`/`execPath` shape requires the process-edge repair; the build script needs one registered identity literal.

### Alternative 3 — Node SEA, `pkg`, or `deno compile`

- **Eligibility:** Eligible in principle, not in practice.
- **Summary:** Produce the executable with a different packaging runtime.
- **Constraint compliance:** Would pass C-1…C-6 if it worked with the delivered code, but the product imports Bun-specific behaviour and the repository pins Bun 1.4.4; C-7 would need the same repair in a second toolchain.
- **Driver fit:** Fails 7 (paved road) and 2 (a second runtime's semantics for `process.execPath`, `argv`, and detached spawn must be re-proven).
- **Pros:** Node SEA is a first-party mechanism if the runtime ever moves.
- **Cons:** A second toolchain, a second set of process-edge semantics, and a rewrite of the entry to satisfy a foreign bundler.
- **Why rejected:** It spends the change on a toolchain migration nobody asked for; the pinned runtime has the mechanism natively.

### Alternative 4 — Build Rewrites a Committed Identity Module

- **Eligibility:** Not eligible (fails C-5's "never mutates the source tree" reading and, practically, the build would leave the tree dirty).
- **Summary:** The build writes `version`/`commit`/`builtAt` constants into a tracked module before bundling.
- **Constraint compliance:** Fails C-5 — the identity is not a build output but a source mutation, and the repository state after a build no longer matches the commit the identity claims (the defect that "delivery runs while the repository is dirty" makes dangerous).
- **Driver fit:** Fails 5 outright; good on 4.
- **Pros:** No `--define` and no `typeof` guard; identity is inspectable in the tree.
- **Cons:** Every build dirties the tree; two builds of the same commit can disagree with their own recorded commit.
- **Why rejected:** It records a claim the build itself falsifies.

### Alternative 5 — Runtime Read of Git or the Manifest for `--version`

- **Eligibility:** Not eligible (fails C-2).
- **Summary:** `--version` shells out to `git rev-parse` or reads the installed manifest.
- **Constraint compliance:** Fails C-2 (a git read, and a failure outside a checkout) and C-5 (identity inferred at run time). It also produces the wrong answer after a checkout moves, which is the class of bug the story removes.
- **Driver fit:** Good on 4; fails 2, 5, 7.
- **Pros:** No build-time plumbing at all.
- **Cons:** Breaks the isolation suite; reports `unknown` for a distributed artifact; adds a child process to the cheapest command in the product.
- **Why rejected:** It trades a delivered invariant for a convenience.

## Decision

- **Decision:** Adopt ALT-2. The product artifact is **one `bun build --compile` executable** built from the primary bin, carrying a **build-time-injected identity**; the delivered version line's build slot carries the **commit token**, and the full identity is served on the install family's machine surface.

### 1. Build

- **Command:** `bun build --compile --outfile dist/<binary-name> --define '<identity mirror>' packages/cli/bin/jaiship.ts`, driven by one Bun-run build script registered as the root `build:binary` script. The script is repo-internal (not a delivered installer script and not an `ADOS_DELIVERY_SCRIPTS` member).
- **Toolchain:** the pinned Bun (`engines.bun` / `.bun-version`); no Node, no bundler beyond the shipped one.
- **Output location:** the repository-root `dist/` (already git-ignored), so the artifact is a product output rather than a package build output. The CLI package's existing `tsc` build remains unchanged and continues to produce `packages/cli/dist` for library consumers.
- **Artifact name:** derived from the declared primary identity at exactly one build-side site, registered in the working-name literal inventory (C-6). Only the primary identity ships an artifact; there is no `delivery-os` executable artifact, because a legacy-named artifact is a legacy namespace in binary form.
- **No minification in this increment.** Size is accepted and declared; minification is a revisit trigger, not a silent quality decision.
- **No cross-compilation.** The artifact targets the host OS/architecture; that limit is declared rather than implied.

### 2. Identity capture (build time)

| Field | Source at build time | Notes |
|---|---|---|
| `version` | root `package.json` `version` (the ADR-0009 lockstep line) | The one version line; no per-artifact version scheme. |
| `commit` | `git rev-parse HEAD` (full SHA) | `unknown` when the build has no git metadata. |
| `builtAt` | build clock, ISO-8601 UTC | Declared as making byte-identical rebuilds impossible. |
| `dirty` | whether tracked files differ from `HEAD` at build time | Untracked files (including `dist/`) do not mark the build dirty. |

- **Injection:** one compile-time constant object through `--define`; the identity module reads it behind a `typeof` guard so a non-compiled run falls back to `{ version: "0.0.0", commit: "unknown", builtAt: null, dirty: false, channel: "dev" }`.
- **The build never mutates the source tree** and never requires a clean tree (the ticket requires delivery while the repository is dirty or mid-change).

### 3. The `--version` contract (unchanged shape, defined meaning)

- **Line:** `<binary-name> <version> (build <build>)` — one line, exit `0`, read-free, unchanged.
- **`<build>` is the build identity token:**

  | Situation | Token | Example line |
  |---|---|---|
  | compiled, clean tree | short commit (7) | `jaiship 1.2.3 (build 4bc7b61)` |
  | compiled, dirty tree | short commit + `-dirty` | `jaiship 1.2.3 (build 4bc7b61-dirty)` |
  | compiled without git metadata | `unknown` | `jaiship 1.2.3 (build unknown)` |
  | not compiled (workspace run, tests) | `dev` | `jaiship 0.0.0 (build dev)` |

- **The commit requirement is met in the existing slot.** No field is appended, no second line is printed, and `--json` is not added to `--version`: the delivered one-line contract and the alias's byte parity both survive a change whose purpose is to make the line truthful.
- **`builtAt` is deliberately not in the line.** It is not a stable operator-facing identity, it changes on every build, and it would make the pin unstable. It lives on the machine surface.
- **The dev token is preserved verbatim**, so every delivered test that asserts `0.0.0`/`dev` behaviour for a non-injected composition continues to describe reality.

### 4. The machine surface

- **`jaiship install status --json`** carries, under its own schema version, the **running** identity (`version`, `commit` full, `builtAt`, `dirty`, `channel`, artifact path), the **installed record** identity from the install record, the rollback slot identity, target stability, and the state-format verdict (TDR-0039).
- This is the *only* new place the full identity is exposed. `--version` stays a one-line human self-description; a machine that needs more asks a command that is allowed to read.
- The installed record repeats the artifact's identity fields at install time, so "installed vs running" is a comparison of two records, not a computation.

### 5. Process-edge consequences of the compiled shape

- **Argument parsing is unchanged in effect:** a compiled artifact's `argv` is `["bun", "/$bunfs/root/<name>", …userArgs]`, so the delivered `argv.slice(2)` still yields exactly the user arguments. No change.
- **The re-entry entry path must change source:** the bin supplies the detached-daemon/service-unit entry as `process.execPath` when it is running as a compiled artifact, and as `process.argv[1]` when it is not. A compiled artifact must never hand `/$bunfs/root/...` to `spawn` or to a service unit. This is the one behavioural change the artifact forces, and it is in scope for this decision because without it the daemon cannot restart from an installed product.
- **Pinning the daemon to the installed path is not decided here.** The delivered rule (the running entry path) is preserved; whether a daemon must always run the installed artifact is M4-S3's decision (revisit trigger).
- `--print-install-path` is unchanged: the path authority remains the resolver, and the installer's existing probe of that self-description keeps working against the compiled artifact (verified in the probe).

### Constraint Compliance Attestation

The chosen alternative (ALT-2) satisfies every constraint C-1 through C-7, with C-1 and C-7 proven by measurement rather than argument. No accepted-risk exceptions are taken. Three limits are declared rather than hidden: the artifact is 107 MB unminified, it targets the host platform only, and `builtAt` inside the binary makes byte-identical rebuilds impossible. Each is carried with a revisit trigger, not presented as a solved problem.

**Reversal.** Deleting `build:binary` and the build script restores a workspace-only product; removing the bin's supply of `version`/`build` restores the delivered `0.0.0 (build dev)` line verbatim; removing the compiled arm of the re-entry branch restores `process.argv[1]` exactly. An installed artifact is unaffected by any of these reversals, which is the point of the identity.

## Trade-offs & Consequences

### Positive Outcomes

- A real product artifact: self-contained, copyable, and independent of any checkout or worktree.
- The version line becomes truthful without changing its shape, and the alias's byte parity is preserved.
- Every later consumer (install record, compatibility verdict, dogfood evidence, release provenance) reads one identity object instead of inventing one.
- Workspace runs, tests, and the embedder path keep the `0.0.0`/`dev` fallback, so nothing in the current suite changes behaviour.
- The build cannot dirty the tree it builds, so "the build claims a commit the tree does not match" is impossible by construction.

### Negative Outcomes

- **107 MB artifact (measured).** Accepted for now; minification is a revisit trigger.
- **Host-only builds.** A macOS artifact cannot be produced on Linux without a decision this record does not take.
- **`builtAt` inside the binary makes byte-identical rebuilds impossible.** Declared so no one claims reproducibility; the revisit trigger removes the field if reproducibility becomes a requirement.
- **The build script needs one registered identity literal**, so the working-name literal inventory grows by exactly one declared site and the content-inventory structure suite's expected set moves.
- **The process edge gains a compiled/not-compiled branch** for the re-entry path. It is one branch, but it is a new conditional in the composition edge and must be covered in both arms.
- **The `tsc` package build and the artifact build now coexist.** The root `build` script is unchanged (typecheck depends on it); `build:binary` is additive, and a developer who runs only `build` still has no artifact. Declared so the install guide says which command produces what.
- **The compiled artifact compiles the whole command surface**, including runtimes the operator may never use; the artifact is not tree-shaken per command and nothing claims it is.

### Unresolved Questions

- [ ] Whether the artifact should embed a declared build channel (`dev`, `local`, `release`) alongside the identity, so a release artifact can be distinguished from a local compile of the same commit. Owner: `@spec-writer`; the identity object already reserves a `channel` field with `dev` as the only value this increment defines.
- [ ] Whether M4-S2 wants the artifact name to include the version (`<binary-name>-<version>-<os>-<arch>`) for release assets. Owner: M4-S2; this decision fixes only the local build output path.
- [ ] The exact `install.status` schema version string and field names. Owner: `@spec-writer` together with TDR-0039.

## Implementation Plan

1. **Build script.** One Bun-run script: read the lockstep version from the root manifest, capture commit/builtAt/dirty with fixed-argv git calls, build the `--define` payload, run `bun build --compile`, and fail loudly when the output does not exist or is not executable. Register `build:binary`; do not touch the delivered `build` script.
2. **Identity module.** A confined module exposing the injected identity with the documented dev fallback; import it only at the process edge; add the guard test that it reads nothing ambient.
3. **Process-edge plumbing.** The bin supplies `version` and the build token through the already-optional entrypoint inputs; the launcher forwards them; the re-entry entry path branches on the compiled shape (§5).
4. **Literal inventory.** Register the build-side identity site and update the inventory expectation; keep the count of product-surface literals unchanged.
5. **Probe test.** A test that builds (or consumes a built) artifact in a scrubbed environment and asserts: `--version` line shape and commit token, one composed command, and the re-entry entry path. Gate it so `pnpm check` stays deterministic and offline — the delivered suite pattern for installer integration tests is the model.
6. **Docs.** CLI entrypoint page (identity fields, dev fallback, the compiled/not-compiled branch), local-install guide (which command produces the artifact), install-model correction (the artifact's real build step).
7. **Negative controls.** A test that asserts the *absence* of a git read on the `--version` path (poisoned `PATH` with a recording `git` stub, as the delivered suites do for `gh`).

## Verification Criteria

- Metric: self-containment — the artifact runs `--version`, `--help`, and one composed command in an empty directory with a scrubbed `PATH` and no checkout. Target: 3/3. Window: GH-346 CI (offline).
- Metric: read-free self-description — zero state/git/configuration/network reads on the version, help, and install-path paths, including with a recording `git` stub and a poisoned environment. Target: exact. Window: GH-346 CI.
- Metric: shape preservation — the delivered version suite passes unchanged; the alias's line is byte-identical for the same identity; `--version --json` equals `--version`. Target: exact. Window: GH-346 CI.
- Metric: identity truth — an artifact built from a known commit prints that commit; a dirty build prints `<commit>-dirty`; a build without git metadata prints `unknown`; a non-compiled run prints `dev`. Target: 4/4. Window: GH-346 CI.
- Metric: process edge — the re-entry entry path equals the artifact path for a compiled artifact and `argv[1]` for a non-compiled run; no path containing the compiled virtual root is ever handed to a spawn or a unit. Target: exact. Window: GH-346 CI.
- Metric: literal inventory — exactly one new declared build-side identity site; product-surface literal count unchanged. Target: exact. Window: `pnpm check` on GH-346.

## Confidence Rating

**High** for the build mechanism and the identity injection: both were measured on this checkout with the pinned toolchain, including the artifact actually answering the delivered self-description surfaces. **High** for the version-line decision: the delivered shape, the pinned ACs, and the isolation contract all constrain it, and the commit requirement is satisfiable inside the existing slot. **High** for the process-edge repair being required: the compiled `argv` shape was measured, and `/$bunfs/root/...` is not an executable. **Medium** for the artifact's long-term fit as a release artifact (size, host-only builds, non-reproducibility): each is declared with a revisit trigger rather than assumed away.

## References

- GH-346 ticket body — `gh issue view 346 -R juliusz-cwiakalski/agentic-delivery-os`
- M4 blueprint — `doc/planning/oss-tooling/milestones/m4/README.md` (EC-1, risks table "Installed-vs-source confusion"), `backlog.md` (S1), `install-model.md` (Build and install flow), `ranking.md`
- Delivered version render, defaults, and isolation — `packages/cli/src/entrypoint.ts` (`versionText`, `DEFAULT_VERSION`, `DEFAULT_BUILD`, `versionData`), `doc/spec/features/feature-cli-entrypoint.md` §Interface contract, §Identity resolution, §Runtime neutrality, §Quality evidence
- Delivered process edge — `packages/cli/bin/jaiship.ts`, `packages/cli/bin/delivery-os.ts`, `packages/cli/src/bin-launcher.ts`
- Delivered daemon re-entry and service-unit entry — `packages/cli/src/daemon-compose.ts`, `packages/cli/src/production.ts`, `packages/adapters/src/daemon/process.ts`, `packages/adapters/src/daemon/supervisor.ts`
- Delivered installer probe of the install path — `scripts/install.sh` (`resolve_launcher_path`), `doc/guides/local-install.md`
- Version and release line — `package.json`, `packages/cli/package.json`, `.bun-version`, [ADR-0009](ADR-0009-release-model-v1.md), [ADR-0003](ADR-0003-oss-monorepo-structure.md)
- Prior change record — `doc/changes/2026-11/2026-11-15--GH-320--jaiship-binary/chg-GH-320-spec.md` §8.4, §8.5, §9 (NFR-2), §17, §22
- [TDR-0036](TDR-0036-install-lifecycle-composed-command-family.md) — the surface that installs this artifact
- [TDR-0038](TDR-0038-install-target-stability-and-dev-build-exclusion.md) — the dev-build exclusion that uses this identity
- [TDR-0039](TDR-0039-installed-binary-state-format-compatibility-check.md) — the compatibility verdict that reports this identity
