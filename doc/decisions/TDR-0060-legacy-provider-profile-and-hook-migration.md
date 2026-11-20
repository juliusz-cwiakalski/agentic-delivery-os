---
id: TDR-0060
decision_type: tdr
status: Proposed
created: 2026-11-19
decision_date: null
last_updated: 2026-11-19
summary: "GH-350: legacy provider input is migrated by one read-only command, `provider migrate legacy`, that parses `~/.<priorWorkingName>/config/profiles/*.sh` and the pre-iteration hook as data under a bounded declarative subset (assignments, comments, blank lines; literal single-token values only), never executes, sources, word-splits, or shells out, and refuses the whole run on any unsupported construct with the single identity provider.migrate.refused at exit 1 and a closed reason set (no-source, unreadable-source, oversized-source, shell-construct, dynamic-value, target-exists, proposal-invalid). Credential-shaped names are classified by name, their values are discarded at the parse boundary and never parsed, logged, or persisted, and only a credential reference (literal name or environment-prefixed suffix) can appear in the proposal. The default output is a validated proposed provider branch on stdout for review; --write creates the project-committed document only when it does not exist. No runtime path reads legacy files: migration is one-shot and the hook is removed from the path, not from disk."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os provider policy: legacy compatibility input and migration"
decision_scope: repo
review_date: null
business_impact: "The 'jaiship only' flip stops depending on shell profiles and a pre-iteration hook without a risky big-bang rewrite: the operator sees a validated proposal, accepts it by review, and the legacy files become inert input rather than runtime policy."
customer_impact: "An operator runs one command, reads a proposed provider branch, and either accepts it with --write or copies what they want; an unsupported construct is refused by name with the file and line, never silently misinterpreted, and a credential value is never copied, echoed, or stored."
classification:
  domains: [contracts, tooling, operations, security]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: high
  urgency: medium
  uncertainty: high
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-350 clarify_scope: one-time migration input and command shape)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-350 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-350 clarify-scope: legacy profiles and hook as compatibility input)"
    - "@spec-writer (GH-350 specification: subset grammar, proposal shape, refusals)"
    - "@decision-advisor (repository analysis and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-350 PR review — this record fixes a secret-adjacent input path)"
  performers:
    - "@spec-writer (subset grammar, mapping table, refusal matrix)"
    - "@test-plan-writer (refusal, canary, determinism oracles)"
    - "@coder (reader, parser, proposal builder, CLI)"
    - "@doc-syncer (provider-engine, migration guide, install docs)"
  informed:
    - "Security reviewers (credential handling)"
    - "Operators with existing profile directories"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A real legacy profile set uses a construct the subset refuses in a way that is mechanically translatable (for example a documented vendor helper): extend the subset with a named pattern and tests, never by adding an execution path."
  - "An operator asks the tool to merge into an existing configuration document: that needs a YAML writer with provenance, which is a separate decision; keep --write create-only until then."
  - "A credential value is ever observed in a proposal, diagnostic, or log: stop and treat it as a security defect, not a migration bug."
  - "Migration proves unnecessary because operators re-author policy by hand: retire the command rather than keeping an unexercised execution-adjacent surface."
links:
  related_changes: ["GH-350"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-provider-engine.md"
    - "doc/spec/features/feature-config-layer.md"
    - "doc/spec/features/feature-autonomous-delivery.md"
  contracts:
    - "packages/core/src/contracts/provider.ts"
    - "packages/core/src/contracts/error-table.ts"
  decisions: ["ADR-0007", "TDR-0002", "TDR-0019"]
  roadmap_items: ["M4-S4"]
---

# TDR-0060: Legacy Provider Migration — A Bounded Declarative Reader, a Validated Proposal, and Typed Refusals

## Context

- **FACT:** Today provider policy still lives in shell: `~/.ados/config/profiles/*.sh` (legacy working name) supplies model-selection values, and the pre-iteration hook (`~/.ados/hooks/pre-opencode-iteration`, resolved from `PRE_ITERATION_HOOK`) defers spawns for peak windows and quota exhaustion. The hook's contract is a pure gate — sleep to defer, exit `0` to proceed, optional validated environment output (TDR-0002).
- **FACT:** The flip plan's F2 requirement is: "Migration reads the legacy shell profiles and the hook once as a compatibility input and then removes the runtime dependency", and its stated mitigation is "the legacy profiles are read once as input and are never written; the hook is removed from the path, not from disk".
- **FACT:** The typed provider branch, profiles branch, budgets branch, and credential-reference model already express everything the legacy policy expressed: descriptors, chains, peak windows, quota policies, per-agent model assignments, and credential references (never values).
- **FACT:** The repository's precedent for reading untrusted shell-adjacent input is refusal-shaped, not execution-shaped: the environment-record contract validates a data format and refuses on any deviation; the credential port is the only secret reader and the provider path adds no allowlist entry (ADR-0007 C-2, TDR-0019).
- **FACT:** The configuration layer has no YAML writer: acquisition is read-only, and no command mutates a configuration document.
- **Why now:** The flip cannot claim "no shell profiles and no hook on the path" while the operator has no guided path off them. Doing this as a best-effort shell-evaluating importer would be the single riskiest surface in the change: it would execute operator-authored shell and could copy credential values into a committed file.

## Problem Framing (Clarified)

"Read the legacy profiles and the hook" is ambiguous in a way that decides the whole risk profile:

1. **Execute them** (`source`, `bash -c`, word-splitting): the importer inherits arbitrary code execution, ambient environment reads, and vendor behaviour; a credential value can be printed or written by the very act of importing. Rejected on security grounds.
2. **Refuse shell entirely** (require hand-authored YAML): safe, but it abandons the compatibility input the ticket names and gives the operator no bridge.
3. **Read them as a bounded declarative subset** with refusal on anything else: safe (no execution, no substitution, no ambient reads), honest (the refusal names the construct and location), and useful for the common shape (a list of model-variable assignments plus a literal window).

The decision must also settle **where the output goes**. Writing configuration automatically would need a YAML writer, merge semantics, and provenance for a document the tool did not author. Emitting a validated proposal for review keeps the operator as the author of policy and makes the migration a reviewable diff.

## Constraints (Hard Requirements)

### C-1: No execution, no sourcing, no word-splitting, no ambient read

- **Statement:** The migration never invokes a shell, never `source`s or evaluates a file, never performs word splitting or glob expansion, never reads the environment, and never calls the network; it tokenises bytes under a declared grammar.
- **Source:** security posture (ADR-0007 C-2, TDR-0019); ticket AC (no credential values)
- **Verification:** structure test (no child-process, shell, `eval`, or `Function` reference in the module); a fixture containing a command substitution refuses and executes nothing (a canary side-effect file is never created)
- **Negotiable:** no

### C-2: Credential values are never parsed, retained, logged, or persisted

- **Statement:** For a credential-shaped name (`*_API_KEY`, `*_API_TOKEN`, `*_ACCESS_TOKEN`, `*_SECRET`, `*_PASSWORD`, `*_PRIVATE_KEY`, `*_CLIENT_SECRET`), the parser stops at the name, discards the remainder of the line without parsing or validating it, and can emit only a credential **reference** (a `literal` source-key name or an `environment-prefixed` suffix). No output, diagnostic, error, or intermediate structure carries a value for such a name.
- **Source:** AC ("no credential values appear in config, state, or logs"); ADR-0007 C-2
- **Verification:** canary fixtures with distinctive fake secrets in profiles and hook; byte-level scan of stdout, stderr, envelope, and any written file; a test that fails if the canary string appears anywhere
- **Negotiable:** no

### C-3: Refusal is whole-run and typed; never a partial migration

- **Statement:** Any construct outside the subset refuses the entire run with `provider.migrate.refused` (exit 1) and one closed reason, naming the source file and line; no proposal is emitted alongside a refusal, and no file is written.
- **Source:** internal standard (env-record refusal "never partially applied"); ticket AC (typed outcomes)
- **Verification:** refusal matrix per construct; a test asserting empty stdout and no write on every refusal
- **Negotiable:** no

### C-4: The proposal is validated before it is emitted

- **Statement:** The proposed `provider` branch is parsed by the delivered provider validator and the delivered configuration schema before output; a proposal that fails validation refuses as `proposal-invalid` rather than handing the operator an invalid document.
- **Source:** internal standard (fail-closed configuration); AC (policy expressed only in valid Jaiship config)
- **Verification:** test (a source that maps to a cost-order-invalid chain refuses; a valid source emits a document that `config` accepts verbatim)
- **Negotiable:** no

### C-5: No runtime dependency survives

- **Statement:** No production composition reads the legacy profile directory or the hook; the migration is a one-shot command, it writes no legacy file, and it deletes nothing. A delivery must resolve provider policy with those paths absent.
- **Source:** AC ("a delivery runs with the shell hook and profile files disabled"); flip plan F2
- **Verification:** test (policy resolves with the paths removed from the fixture home) + import/boundary review
- **Negotiable:** no

### C-6: Deterministic and bounded

- **Statement:** Identical source bytes and invocation produce byte-identical output; the reader is bounded (declared file-count, byte, and line caps) and reads each source once.
- **Source:** provider-engine NFR determinism; YAML/parser bounds precedent
- **Verification:** paired-run byte equality; oversize fixtures refuse as `oversized-source`
- **Negotiable:** no

### C-7: Brand-neutral default paths

- **Statement:** Default source paths derive from the invoking identity's prior working name (the brand seam), never a committed product literal; `--profiles-dir` and `--hook` override them.
- **Source:** internal standard (brand neutrality); config-layer prior-identity fallback precedent
- **Verification:** brand-literal scan; a test with a non-default prior identity
- **Negotiable:** no

> **Table stakes:** the delivered command envelope, exit taxonomy, redaction chokepoint, and grammar-refusal discipline are unchanged and not re-scored.

## Decision Drivers

**Security drivers (ranked):**

1. **No code execution** — an importer of shell must not be a shell.
2. **No credential value movement** — the highest-severity failure is a key copied into a committed file or a log.
3. **No silent misinterpretation** — a construct the tool does not understand must stop the run, not be ignored.

**Operational drivers:**

4. **A real bridge** — the common legacy shape (model-variable assignments and a literal window) must import cleanly.
5. **Operator authorship** — the output is a reviewed proposal, so policy ownership stays with the operator.
6. **Reversibility** — nothing is written unless asked, and only a new document is created.

**Technical drivers:**

7. **One validator** — the proposal is checked by the same validator that will later consume it.
8. **Lean surface** — one verb, one error identity, no YAML writer.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-350 clarify-scope).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-350 PR review; the AI does not accept this record.
- **Contributors:** `@pm` (compatibility-input scope), `@spec-writer` (subset grammar and mapping), `@decision-advisor` (analysis).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, human owner; security review of the credential path is mandatory.
- **Performers:** `@spec-writer`, `@test-plan-writer`, `@coder`, `@doc-syncer`.
- **Informed:** security reviewers, operators with profile directories.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The legacy hook is a pure gate whose contract is sleep-and-exit, with optional validated env output | FACT | TDR-0002; `doc/changes/2026-07/2026-07-15--GH-146--quota-aware-pre-iteration-hooks/chg-GH-146-spec.md` | The hook's declarative surface would be larger or smaller than assumed | High |
| Legacy profiles live under `~/.ados/config/profiles/` and the hook under `~/.ados/hooks/` for the pre-freeze name | FACT | flip plan; GH-146/GH-150 change artifacts | Default paths would need a different derivation | High |
| The shipped hook example is a program (driver loop, condition functions, cap), not an assignments file | FACT | `chg-GH-280-spec.md` §"The shell path" describing `scripts/hooks/pre-opencode-iteration-zai.sh` | Hook translation would be near-vacuous; the record must say so | High |
| The typed provider branch already expresses descriptors, chains, windows, quota, seats/models, and credential references | FACT | `feature-provider-engine.md`, `feature-provider-profiles.md`, `feature-config-layer.md` | The proposal target would be incomplete | High |
| No YAML writer exists; configuration acquisition is read-only | FACT | `feature-config-layer.md` §Technical Architecture; repository search | `--write` would need a new writer with merge semantics | High |
| The credential port is the only secret reader and the provider path adds no allowlist entry | FACT | ADR-0007 C-2; `feature-adapter-ports.md` | The migration's name-only posture would be a new secret-read path | High |
| Operators can review a proposed branch and merge it by hand | ASSUMPTION | solo-developer operating model | `--write` would need to merge into existing documents | Medium |
| The common legacy profile is a list of simple assignments | ASSUMPTION | legacy profile convention (per-agent model variables) | The subset would help fewer operators; refusals would dominate | Medium |
| The exact legacy variable grammar is not documented in this repository | TO-CONFIRM | no committed specification of the profile file grammar | The mapping table must be derived from observed operator files during the spec phase | Medium |

## Mental Models & Techniques Used

- **Attack-tree thinking:** the importer is an input boundary. Every path that evaluates, substitutes, or expands is an execution path; every path that copies a value is an exfiltration path. The design removes both classes rather than filtering them.
- **Inversion:** what would make this the worst change in the repository? A `source` that runs an operator's stale vendor helper, or a proposal that commits a live key. C-1 and C-2 are those inversions made constraints.
- **Data-versus-code framing:** parse only the shapes that are unambiguously data; anything whose meaning depends on a shell is refused. This is the same posture the environment-record contract already takes.
- **Opportunity cost:** a YAML writer plus merge semantics would cost more than the migration's value; a reviewed proposal costs one manual merge and keeps authorship with the operator.
- **Second-order thinking:** silently skipping an unrecognised line would produce a proposal that looks complete and omits policy — the operator would discover it as a cost incident, not a migration warning.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 no execution | C-2 no credential value | C-3 whole-run refusal | C-4 validated proposal | C-5 no runtime dep | C-6 deterministic | C-7 brand-neutral |
|---|---|---|---|---|---|---|---|
| ALT-0 refuse shell, require hand-authored YAML | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 execute/word-split the legacy files | ❌ | ❌ | ❌ | ⚠️ | ❌ | ❌ | ✅ |
| ALT-2 bounded declarative reader + validated proposal (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-3 bounded reader that writes config automatically | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (none claimed).

### Alternative 0 — Refuse Shell Entirely; Require Hand-Authored YAML

- **Eligibility:** Eligible (passes every constraint).
- **Summary:** Ship documentation only: operators re-author provider policy by hand.
- **Constraint compliance:** All constraints pass; the ticket's compatibility-input task is declined.
- **Driver fit:** Safe but fails driver 4 (no bridge) and partially driver 5 (no guided review artifact).
- **Pros:** Zero new surface; zero secret-adjacent code.
- **Cons:** The named task line is unmet; operators with large profile sets get no help; the hook's *parameters* still have to be rediscovered by reading shell.
- **Why rejected:** A bounded reader costs one parser and one error identity and delivers the named compatibility input safely. Kept as the declared fallback if real files prove non-declarative (revisit trigger 4).

### Alternative 1 — Execute or Word-Split the Legacy Files

- **Eligibility:** Not eligible (fails C-1, C-2, C-3, C-5, C-6).
- **Summary:** `source` each profile in a subshell and capture the resulting environment; run the hook with a probe to learn its parameters.
- **Constraint compliance:** Executes operator code (C-1); reads and can emit credential values (C-2); a partial failure still yields a half-imported environment (C-3); behaviour depends on ambient environment and vendor helpers (C-6); and the tool would need the legacy files present to behave, undermining the cutover (C-5).
- **Driver fit:** Best on convenience, disqualified on every safety driver.
- **Pros:** Would handle arbitrary profiles.
- **Cons:** Arbitrary code execution during a migration; credential exfiltration risk; non-reproducible output.
- **Why rejected:** Disqualifying. This option is the reason the decision exists.

### Alternative 2 — Bounded Declarative Reader with a Validated Proposal (selected)

- **Eligibility:** Eligible (passes C-1 … C-7).
- **Summary:** `provider migrate legacy` reads the profile directory and the hook path under an assignment-only grammar, maps recognised names to the typed provider branch, discards credential-shaped values at the parse boundary, validates the proposal with the delivered validator, and prints it. Refusal is whole-run and typed.
- **Constraint compliance:** C-1 by grammar; C-2 by name-first classification; C-3 by refusal semantics; C-4 by the validator gate; C-5 by being a one-shot command with no composition wiring; C-6 by bounded, single reads; C-7 by prior-identity defaults.
- **Driver fit:** Best on all eight.
- **Pros:** Safe bridge; reviewable artifact; no writer; the refusal list doubles as migration documentation.
- **Cons:** A program-shaped hook (including the shipped example) refuses by design, so hook migration is mostly "declare the window in config and stop using the hook"; the mapping table must be derived from real files during the spec phase.
- **Why chosen:** It is the only option that is both safe and useful, and it states the hook limitation honestly.

### Alternative 3 — Bounded Reader that Writes Configuration Automatically

- **Eligibility:** Eligible with an accepted-risk exception on C-4 (⚠️: writing into an existing document would bypass review and require merge semantics).
- **Summary:** Same reader, but it writes the resulting branch into the project configuration without an explicit `--write`.
- **Constraint compliance:** C-4 degrades: an automatic write is a policy change the validator can check but the operator has not reviewed; merge into an existing document needs a writer and provenance the repository does not have.
- **Driver fit:** Fails driver 5 (operator authorship) and driver 8 (lean surface).
- **Pros:** One step instead of two.
- **Cons:** A migration that mutates policy without review; a YAML writer as a new subsystem.
- **Why rejected:** Review is the control that makes a mechanical translation safe.

## Decision

- **Decision:** Adopt **ALT-2**.

### D1 — Command shape and placement

`provider migrate legacy [--profiles-dir <dir>] [--hook <path>] [--write] [--json]`. The verb lives in the existing `provider` family as a two-level member (`migrate legacy`), matching the family's delivered nesting (`parks list`, `profile resolve`, `watch status`). Default sources derive from the prior working name: `<home>/.<priorWorkingName>/config/profiles/` and `<home>/.<priorWorkingName>/hooks/pre-opencode-iteration`. `--profiles-dir` and `--hook` override; an absent source is reported as `absent` (not a failure) so a machine with only one of the two migrates cleanly; when neither exists the run refuses `no-source`. The command takes no positionals; unknown flags refuse as `fallback.invocation`.

### D2 — The bounded declarative subset

A profile file is read line by line under one grammar:

- blank lines and `#` comments are ignored;
- an assignment is `NAME=value` or `export NAME=value`, where `NAME` matches `^[A-Za-z_][A-Za-z0-9_]*$` and `value` is a single-quoted, double-quoted, or bare token containing no whitespace, no `$`, no backtick, no `;`, `&`, `|`, `(`, `)`, `<`, `>`, `*`, `?`, `[`, `]`, `{`, `}`, `~`, and no backslash;
- nothing else is accepted.

Any other construct — function definition, `if`/`for`/`while`/`case`, `source`/`.`, `eval`, `set`/`unset`/`readonly`/`export` without an assignment, heredoc, redirection, pipeline, command substitution, arithmetic expansion, array, multi-command line, or a value containing an expansion — refuses the whole run as `shell-construct` or `dynamic-value`, naming the file and line. The hook is read under the same grammar: it is expected to be a parameters file; a program-shaped hook (including the shipped driver example) is refused as `shell-construct`, and the documented remedy is to declare the window, quota endpoint, and credential reference in the provider branch and retire the hook.

### D3 — Mapping (mechanical only)

The proposal targets the delivered typed branches: recognised per-agent model variables map to `provider.profiles.*.seats.*.model`; recognised provider/endpoint/threshold/window literals map to `provider.entries.*` and `provider.chains.*`; recognised credential-shaped names map to `provider.credentials.*` **references** only. A recognised name whose value cannot be mapped mechanically is reported as `unmapped` **by name** and omitted from the proposal; an unrecognised name is reported the same way. `unmapped` is a disclosure, not a refusal, because omission cannot silently *change* a declared value — the operator sees the list and completes the document. The exact mapping table is specified in the change spec from observed legacy files; every mapping must be literal-to-literal, and no mapping may compute, concatenate, or infer a value.

### D4 — The proposal and `--write`

Default output is the proposed configuration document on stdout: one YAML document carrying the proposed `provider` branch, deterministic key order, and a header comment naming the sources and the unmapped names (names only). It is validated by the delivered provider validator and configuration schema before printing; a proposal that fails validation refuses as `proposal-invalid`. The translation report (sources read with byte counts, mapped names, unmapped names, absent sources) goes to the diagnostic stream in human mode and into `data.report` in machine mode.

`--write` creates the project-committed configuration document **only when it does not exist**; an existing document refuses `target-exists` and is never modified. This is the declared boundary of the no-writer posture: merging into an existing document is a separate decision (revisit trigger 2).

### D5 — Refusals, credential firewall, and non-goals

One identity: `provider.migrate.refused` — category `user`, retryable `false`, consequence `not_landed`, projection `user-validation` (exit `1`) — with one closed reason: `no-source`, `unreadable-source`, `oversized-source`, `shell-construct`, `dynamic-value`, `target-exists`, `proposal-invalid`. The identity carries the source path and line (never content) and no proposal.

The credential firewall is name-first: a credential-shaped name is recognised before its value is examined; the parser stops at the name, discards the remainder of the line unparsed, and the proposal carries only a reference. No diagnostic, error, log, or intermediate serialized structure may contain a value for such a name; canary tests assert the absence.

Non-goals: executing or emulating the hook; writing or deleting legacy files; merging into an existing configuration document; importing vendor-specific helper behaviour; and any runtime read of the legacy paths. A delivery resolves provider policy with the profile directory and hook absent, and the hook is removed from the path, not from disk.

- **Decider:** Juliusz Ćwiąkalski — pending at the GH-350 PR review.
- **Conditions for revisit:** see `revisit_triggers`.

### Constraint Compliance Attestation

The chosen alternative satisfies C-1 … C-7: no shell, sourcing, splitting, or ambient read (C-1); credential values are never parsed, retained, logged, or persisted and only references are emitted (C-2); refusal is whole-run, typed, and produces no partial artifact (C-3); the proposal passes the delivered validator and schema before output (C-4); no composition reads the legacy paths and nothing is deleted (C-5); reads and output are bounded and deterministic (C-6); paths derive from the brand seam (C-7). No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- The flip gets a safe, reviewable bridge off shell policy without a big-bang rewrite.
- The riskiest possible surface (a shell-evaluating importer) is structurally excluded, so a stale or hostile profile cannot execute anything.
- Credential values cannot move: the only representable credential artifact is a reference.
- The refusal list doubles as operator documentation for what must be hand-authored.

### Negative Outcomes

- Program-shaped hooks — including the shipped example — refuse; hook users get a refusal plus a documented manual translation, not an import. This is the honest limit of a declarative reader.
- The mapping table depends on real legacy files that this repository does not specify; the spec phase must derive it and may find shapes the subset refuses.
- `--write` is create-only, so most operators will copy the proposal by hand.
- One more provider-kind error row moves the delivered sync counts.

### Unresolved Questions

- [ ] The exact legacy variable grammar and vendor name patterns (owner: `@spec-writer`, from operator files at spec time; any name not derivable is reported `unmapped`, not guessed).
- [ ] Whether `--profiles-dir` should accept several directories or a glob (owner: `@spec-writer`; recommendation: one directory, repeated flag refused in v1).
- [ ] Whether the proposal should carry `$schema` and a generation marker (owner: `@spec-writer`; recommendation: `$schema` only, no generator metadata in policy documents).

## Implementation Plan

1. Contracts: the refusal identity and its closed reasons; the proposal/report types.
2. Reader/parser: bounded read, line grammar, name-first credential classification, source-location reporting.
3. Mapper: literal-to-literal mapping into `provider.credentials`, `provider.entries`, `provider.chains`, `provider.profiles`; unmapped reporting.
4. Proposal builder: deterministic YAML, validation through the delivered validator and schema, stdout/diagnostic split, `--write` create-only.
5. Error table: one row; counts move.
6. Tests: subset accept/refuse matrix, canary firewall across stdout/stderr/envelope/written file, proposal validation, determinism, absent-source handling, `--write` conflict, and "policy resolves with the legacy paths absent".
7. Docs: migration guide (what imports, what refuses, what to do with a program-shaped hook), provider-engine CLI table.

## Verification Criteria

- Metric: legacy files executed, sourced, or word-split during migration — Target: 0 — Window: GH-350 CI (no-execution canary).
- Metric: canary credential strings appearing in any output or written file — Target: 0 — Window: GH-350 CI (byte scan).
- Metric: refusals that still emit a proposal or write a file — Target: 0 — Window: GH-350 CI.
- Metric: emitted proposals rejected by `config` — Target: 0 — Window: GH-350 CI.
- Metric: runtime reads of the legacy profile directory or hook — Target: 0 — Window: GH-350 CI (boundary test).
- Metric: byte differences between two runs on identical sources — Target: 0 — Window: GH-350 CI.

## Confidence Rating

**Medium.** The security posture and the refusal model are certain and follow delivered precedent. The uncertainty is empirical: the repository does not specify the legacy profile grammar, and the shipped hook is a program, so the *usefulness* of the reader depends on operator files the spec phase must sample. The decision is shaped so that low usefulness degrades to refusals plus documentation, never to unsafe behaviour.

## References

- [ADR-0007](ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md) — credential-port-only authorization, zero secret-read allowlist growth, fail-closed configuration.
- [TDR-0002](TDR-0002-pre-iteration-hook-contract-details.md) — the legacy hook contract being retired from the path.
- [TDR-0019](TDR-0019-dispatch-admission-credential-preflight.md) — credential preflight and refusal precedent.
- Feature specs: [Provider Engine](../spec/features/feature-provider-engine.md), [Configuration Layer](../spec/features/feature-config-layer.md), [Autonomous Delivery](../spec/features/feature-autonomous-delivery.md).
- Change artifacts: `doc/changes/2026-07/2026-07-15--GH-146--quota-aware-pre-iteration-hooks/`, `doc/changes/2026-08/2026-08-04--GH-150--quota-aware-delivery-wait/`.
- Flip plan: `doc/planning/oss-tooling/milestones/m4/flip-plan.md` §F2.
- Change: `doc/changes/2026-11/2026-11-19--GH-350--provider-policy/`.
