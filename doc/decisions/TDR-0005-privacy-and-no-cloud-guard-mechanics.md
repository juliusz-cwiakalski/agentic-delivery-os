---
id: TDR-0005
decision_type: tdr
status: Proposed
created: 2026-10-31
decision_date: null
last_updated: 2026-10-31
summary: "Adopt one repo invariant check (scripts/checks/privacy-literals.ts) with a committed schema-versioned hashed-literal registry as the single authority; SHA-256 over a versioned domain prefix plus normalized literals, no salt and no keyed HMAC; no-echo violation reporting; cloud terms stored only as hashed entries of class cloud-term; a required injected content policy at the envelope codec's single serialization point; a working-tree-only scan boundary with reason-bearing allowlist and exclusions; and no config-layer production key for the list until the policy engine (M3-S5)."
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os repository checks and metadata codec
decision_scope: repo
review_date: null
business_impact: "Keeps private and hosted-only content out of public artifacts and public CI logs while the OSS/public boundary from ADR-0003 holds, without new dependencies or config-layer coupling."
classification:
  domains: [security, privacy, tooling, operations]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: moderate
  stakes: medium
  urgency: medium
  uncertainty: medium
  blast_radius: local
  recurrence: one-off
governance:
  driver: "@pm"
  decider: "Juliusz Ćwiąkalski (human acceptance pending)"
  contributors:
    - "@pm (clarify-scope findings and decided positions, 2026-10-31)"
    - "@decision-advisor (analysis and record)"
  reviewers: ["@reviewer", "@readiness-reviewer", "Human owner (PR review)"]
  performers: ["@coder"]
  informed: []
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "The policy engine (M3-S5) lands; migrate registry placement and authority to it and retire or absorb this mechanism deliberately."
  - "A committed hash is abused as an offline verification oracle (confirmed guess attribution) or a CI log leaks matched content despite no-echo; reopen the hashing and reporting model."
  - "A production metadata emitter lands that serializes envelopes anywhere other than the single serialization point; reopen emitter-scan enforcement."
  - "Registry growth makes data-only editing painful or a second project needs its own list; revisit placement (config key, policy engine, per-project registries)."
  - "The first real violation or false-positive flurry shows the generic pattern rules or normalization rules are wrong in practice."
links:
  related_changes: ["GH-184"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-branding-seam.md"
    - "doc/spec/features/feature-config-layer.md"
  contracts:
    - "packages/core/src/contracts/envelope.ts"
  diagrams: []
  decisions: ["ADR-0003"]
  experiments: []
  metrics: []
  roadmap_items: []
---

# TDR-0005: Privacy and No-Cloud Guard Mechanics

## Context

- **FACT:** GH-184 (story M0-S15, milestone M0) delivers privacy and no-cloud guards: a privacy-literal guard built from generic pattern rules in committed code plus a project-configurable hashed-literal list (raw private literals are never committed; only their hashes are), a no-cloud-in-committed-files check, no secrets or private identifiers in embedded ADOS metadata, all wired into CI. Acceptance: a committed file containing a guarded literal fails CI, and metadata envelopes are scanned at the emitter (ticket GH-184; `doc/planning/oss-tooling/backlog.md` story M0-S15).
- **FACT:** The policy-as-code concept lists both rules as prose today: "No client identifiers or private content in committed files" (privacy-literal guard, M0-S15) and "No hosted-product content in committed files" (planned guard, M0-S15). The rules register's honesty layer requires each written rule to gain its mechanical check (`doc/planning/concepts/policy-as-code.md`).
- **FACT:** ADR-0003 C-1/C-4/C-11 forbid cloud code, cloud names, cloud designs, pricing, private references, and proprietary implementation in committed files. A no-cloud denylist therefore cannot be committed as a raw term list: the list itself would violate C-4.
- **FACT:** No privacy guard exists today. `scripts/checks/forbidden-literals.ts` is brand-only (three seed literals that are already public, stored raw in its registry — a model that cannot hold private literals), and `scripts/checks/secret-read-boundary.ts` is an AST allowlist for ambient environment reads, not a content scan. No no-cloud check and no metadata content scan exist (GH-184 clarify-scope finding, 2026-10-31).
- **FACT:** `serializeEnvelope` in `packages/adapters/src/io/envelope-codec.ts` is the only envelope serialization point. The codec is adapter-internal and declared free of `node:*`/`bun:*` imports and ambient reads. No production comment emitter exists yet (the write-comment adapter path is not implemented), so the emitter scan must be attached at the codec now and inherited by every later emitter by construction.
- **FACT:** The envelope contract closes the v1 payload and "admits no secret or credential material" (`packages/core/src/contracts/envelope.ts`), but that closure is type-level today; nothing scans serialized content. The embedded-metadata and telemetry concepts both require the privacy guard to scan metadata ("no private identifiers inside metadata that could leak through a public provider"; "no secrets, tokens, or private identifiers in events").
- **FACT:** The configuration layer's production catalog is deliberately empty (`PRODUCTION_CATALOG` in `packages/core/src/config/catalog.ts`), and the config layer already hard-errors on secret material in repository-scoped config (DEC-4 via the policy-as-code concept).
- **FACT:** CI logs are public: the repository is a public Apache-2.0 project with visible workflow logs, so any diagnostic printed by a guard can be read by anyone.
- **FACT:** Repository check conventions require every `scripts/checks/*.ts` to be invoked by `package.json` or CI (else `ci-topology` fails), to be mutation-tested under `tests/checks/**`, and to fail closed naming the offending field (`.ai/rules/testing-strategy.md`; precedents: `forbidden-literals.ts`, `secret-read-boundary.ts`, `error-table-sync.ts`).
- **FACT:** The PM fixed the decision positions recorded here during GH-184 clarify scope on 2026-10-31 (change ledger `doc/changes/2026-10/2026-10-31--GH-184--privacy-and-no-cloud-guards/chg-GH-184-pm-notes.yaml`); this record writes them as the decision with options, drivers, and risks.

## Problem Framing (Clarified)

The root problem is a paradox in the guard's own construction. The repository is public while the owner's broader program includes private and hosted-only work. The boundary "private or hosted-only content never lands in committed files or public CI logs" is currently prose. Converting it into a mechanical check naively would require committing a denylist of the very literals the check exists to keep out — the guard would leak what it protects. A second channel is equally leaky: a check that prints the matched content in its failure output publishes the literal through public CI logs, defeating the purpose at the moment of detection.

The decision question is therefore: what mechanism detects (a) project-private literals, (b) generic secret-shaped content, and (c) hosted-product/cloud terms — in committed files at the tip of the working tree and in metadata envelopes at the emitter — without committing any raw literal, without echoing content into public logs, without a new dependency, without breaking the codec's runtime purity, and without coupling policy data into the configuration layer before the policy engine (M3-S5) decides where policy lives?

Desired outcomes:

- A committed file containing a guarded literal fails CI (ticket AC).
- Serialized metadata envelopes are scanned at the single serialization point, fail-closed (ticket AC).
- Adding a guarded literal requires a registry edit only — no code change.
- Runs are deterministic and offline; the check is read-only over repository content.
- Residual risks (hash guessability, history, unlisted secret shapes) are documented and consciously accepted rather than discovered later.

Out of scope: the policy engine itself (M3-S5), the raw literal values (held by the owner, never in this repository), git-history remediation, and any hosted-product implementation.

## Constraints (Hard Requirements)

### C-1: Raw guarded literals are never committed

- **Statement:** No raw private literal, private identifier, cloud/hosted-product term, or secret may be committed in any artifact of the guard (registry, code, tests, docs, examples). Private literals enter the repository only as digests.
- **Source:** prior decision (ADR-0003 C-4, C-11)
- **Verification:** code review and audit; registry schema validation rejects non-digest entries
- **Negotiable:** no

### C-2: A committed file containing a guarded literal fails CI

- **Statement:** The file scan is a binding CI gate, not advisory: planting a guarded literal into a scanned committed file must produce a non-zero exit and a red job.
- **Source:** AC (GH-184)
- **Verification:** test (mutation tests per rule class and scope) and CI binding (`ci-topology`/`ci-bindingness`)
- **Negotiable:** no

### C-3: Envelopes are scanned at the emitter, fail-closed

- **Statement:** Metadata envelopes are scanned at the single serialization point (`serializeEnvelope`); guarded content yields a serialization failure, never a serialized carrier. No serialization path may bypass the scan.
- **Source:** AC (GH-184); internal standard (embedded-metadata concept guardrails)
- **Verification:** test and code review (single-serialization-point audit)
- **Negotiable:** no

### C-4: The codec keeps its runtime purity

- **Statement:** The envelope codec acquires no `node:*`/`bun:*` import, ambient read, clock, or randomness from this decision; the content policy and the hash function are injected, pure inputs.
- **Source:** prior decision (ADR-0003 C-9/DEC-2 tier purity; codec module purity contract)
- **Verification:** dependency-cruiser and ambient-globals AST guards; code review
- **Negotiable:** no

### C-5: No new dependency

- **Statement:** The guard adds no package dependency. Hashing uses runtime built-ins at the check edge and injection at the codec.
- **Source:** internal standard (`.ai/rules/typescript.md` §1 license-verdict rule; ADR-0003 C-2 license discipline)
- **Verification:** license audit and unchanged lockfile
- **Negotiable:** no

### C-6: Violation output never echoes content

- **Statement:** Failure output never prints the matched literal, the matched hash input, or any content window — only rule/entry id, file, line, and a redacted fingerprint derived from identifiers, not from file content.
- **Source:** internal standard (echo-free error precedent; public CI logs)
- **Verification:** test (mutation tests assert the planted literal is absent from output)
- **Negotiable:** no

### C-7: The registry is schema-versioned and fail-closed

- **Statement:** Malformed, duplicated, or empty-but-claimed entries (an entry that claims scope it does not fulfill, such as an allowlist id matching nothing) fail the check; every allowlist entry and exclusion carries a written reason and is enumerated, never pattern-guessed.
- **Source:** internal standard (`forbidden-literals.ts` registry validation precedent)
- **Verification:** test (registry mutation tests)
- **Negotiable:** no

## Decision Drivers

Ranked; a single ordered list is authoritative.

1. **Accidental-leak prevention fidelity** — detection coverage for private literals, secret-shaped content, and cloud terms at the working-tree tip and at the emitter, before content reaches public artifacts.
2. **Zero blast radius outside the guard** — no new dependency, no configuration-catalog change, no codec purity change, and no user-mutable surface that could weaken enforcement.
3. **Single source of truth** — generic pattern rules defined once in committed code and shared by the file check and the emitter policy; one registry authority for scope, entries, allowlist, and exclusions.
4. **Public-log safety** — reporting is designed so the diagnostic channel cannot become the leak channel.
5. **Precedent alignment** — registry-as-authority, fail-closed validation, reason-bearing allowlists, mutation tests, binding CI: the established `scripts/checks/` conventions.
6. **Data-only extensibility** — adding a guarded literal is a registry edit with no code change and no schema churn elsewhere.
7. **Policy-engine succession** — the mechanism is absorbable by M3-S5 without a schema revolt; placement questions stay open where they belong.

## Decision Rights (DACI)

- **Driver:** `@pm` — fixed the decided positions during GH-184 clarify scope (2026-10-31); `@decision-advisor` analyzed and authored this record.
- **Decider / Approver:** Juliusz Ćwiąkalski — the one accountable human authority. No acceptance is claimed by this record; it stays `Proposed` with `decision_date: null` until the owner accepts at PR review.
- **Contributors:** `@pm` (clarify-scope findings and positions); `@decision-advisor` (analysis, record).
- **Required reviewers:** `@reviewer` and `@readiness-reviewer` during delivery; the human owner at PR review. Security and privacy acceptance is human-owned (ADR-0003 precedent).
- **Performers:** `@coder` for the check, registry, codec policy injection, CI wiring, and tests.
- **Informed:** none beyond the PR; the GH-184 change artifacts and the feature-spec sync carry the outcome.
- **Timing and escalation:** recorded during GH-184 specification, before delivery tasks execute; implementation may proceed with acceptance pending (TDR-0003/TDR-0004 precedent). Unresolved disagreement escalates to the owner.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| No privacy guard, hashed-literal list, no-cloud check, or metadata content scan exists today; forbidden-literals is brand-only with raw already-public literals. | FACT | GH-184 clarify-scope finding 2026-10-31; `scripts/checks/forbidden-literals.ts` and registry | The gap analysis is wrong; the decision would duplicate an existing mechanism. | High |
| `serializeEnvelope` is the only serialization point; the codec is pure (no `node:*`/`bun:*`, no ambient reads); no production emitter exists yet. | FACT | `packages/adapters/src/io/envelope-codec.ts`; GH-184 clarify-scope finding 2026-10-31 | C-3/C-4 anchoring would be wrong; a second serialization path would already exist. | High |
| CI logs are public and readable by anyone. | FACT | Public Apache-2.0 repository; GitHub workflow log visibility | No-echo (C-6) would be over-engineering; violation output could print matches. | High |
| ADR-0003 C-4 forbids committing cloud names, so the no-cloud list cannot be raw. | FACT | ADR-0003 C-4 | Cloud terms could be committed raw in a simpler list; hashing would be unnecessary for them. | High |
| SHA-256 over a versioned domain prefix plus a normalized (trimmed, lowercased) literal, with no salt and no HMAC, is sufficient for the accidental-inclusion threat model. | ASSUMPTION | PM security decision 2026-10-31; accepted residual below | If the threat model grows to determined attackers with repository access, unsalted digests become guessable via offline dictionaries; revisit trigger covers this. | Medium-High |
| The owner holds the raw literals privately and can generate digests out-of-band to supply registry entries after landing. | ASSUMPTION | GH-184 clarify outcome 2026-10-31 | Without an offline digest-generation path, the registry could never be populated and the guard stays vacuous. | Medium-High |
| The production configuration catalog stays empty in M0 and policy-data placement is M3-S5's open question. | FACT | `packages/core/src/config/catalog.ts`; policy-as-code concept open questions | A config key would be the natural placement today; the non-choice below would be premature. | High |
| Fixed-length candidate-window digest comparison performs acceptably over the repository corpus at CI scale. | TO-CONFIRM | Design; validated by mutation tests and CI runtime during delivery | A pathological corpus would need window-length indexing or pre-filtering; mechanism unchanged. | Medium |
| Generic pattern rules recognize the repository's real secret-shaped and private-identifier-shaped content without untenable false positives. | TO-CONFIRM | Design; validated by mutation tests and the first real violations | Rules would need tuning via registry/code edits; false positives would create allowlist pressure. | Medium |
| Every `scripts/checks/*.ts` must be invoked by `package.json` or CI and mutation-tested, else `ci-topology` fails. | FACT | `.ai/rules/testing-strategy.md`; `scripts/checks/ci-topology.ts` convention | The new check could land advisory and silently unbound. | High |

## Mental Models & Techniques Used

- **Inversion:** ask "how would content leak?" — through the committed list itself, and through the failure output. Both channels are closed by construction (digests only; identifier-only reporting).
- **Threat-model separation:** the guard protects against accidental inclusion in public artifacts, not against a determined attacker with repository access. Conflating the two would demand keyed hashing that CI cannot use.
- **Second-order thinking:** a public digest list is also an offline verification oracle for guesses; that residual is accepted and documented rather than ignored. Public CI logs turn verbose diagnostics into leak channels.
- **Single source of truth:** pattern rules live once in committed code and are shared by the check and the emitter policy, so file scanning and envelope scanning cannot drift.
- **Fail-closed trust boundary:** malformed or vacuously-claimed registry data is an error, not a pass; the codec refuses guarded content rather than flagging-and-continuing.
- **Least mechanism:** no new dependency, no salt ceremony, no config schema change — the smallest mechanism that closes both leak channels.
- **Paved road:** the registry-as-authority, reason-bearing-allowlist, mutation-tested, CI-bound shape mirrors the existing checks, so the guard is legible to agents and reviewers who already know the pattern.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| Alternative | C-1 | C-2 | C-3 | C-4 | C-5 | C-6 | C-7 | Eligibility |
|-------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|-------------|
| ALT-0 Do nothing (prose discipline) | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | Not eligible (C-2, C-3) |
| ALT-1 Extend forbidden-literals with raw private/cloud literals | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | Not eligible (C-1) |
| ALT-2 Adopt an external secret-scanning tool | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | Not eligible (C-1, C-3, C-5) |
| ALT-3 Keyed HMAC (uncommitted key) over literals | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | Not eligible (C-2) |
| ALT-4 Hashed list as a config-layer production key | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Eligible; rejected on drivers |
| ALT-5 Dedicated check + committed hashed registry (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Eligible; chosen |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via accepted-risk exception (none used).

### Alternative 0 — Do Nothing / Keep Current Approach

- **Eligibility:** Not eligible (fails C-2, C-3).
- **Summary:** Keep the boundary as prose; rely on review discipline and the policy-as-code rules register listing the rules as advisory.
- **Constraint compliance:** Fails C-2 and C-3 by definition; nothing is committed (C-1 vacuously holds).
- **Driver fit:** Worst on driver 1; the honesty layer keeps visibly flagging the gap.
- **Pros:** Zero cost.
- **Cons:** Both ticket ACs fail; ADR-0003 C-4/C-11 stay mechanically unenforced; every future change relies on reviewer attention.
- **Why rejected:** Disqualifying constraint failures; the story exists because this option was already judged unacceptable.

### Alternative 1 — Extend the Existing forbidden-literals Check with Raw Literals

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Add private and cloud literals as raw entries in `forbidden-literals.registry.json`; reuse the existing scan.
- **Constraint compliance:** Fails C-1 — the registry is committed, so the raw literals and cloud terms would be committed (directly violating ADR-0003 C-4 for cloud names). Fails C-3 — no emitter hook.
- **Driver fit:** Superficially perfect on precedent alignment (driver 5); that is exactly why it is recorded: the paved road ends where the road itself becomes the leak.
- **Pros:** Minimal new surface; proven scan machinery.
- **Cons:** Commits the guarded content; the guard's own registry would be the largest single leak in the repository.
- **Why rejected:** Disqualifying C-1 failure.

### Alternative 2 — Adopt an External Secret-Scanning Tool

- **Eligibility:** Not eligible (fails C-1, C-3, C-5).
- **Summary:** Use an off-the-shelf secret scanner for generic pattern coverage.
- **Constraint compliance:** Fails C-1 — external scanners match known secret shapes; they cannot detect project-private literals or hosted-product terms whose raw form must not be committed anywhere, including tool config. Fails C-3 — no metadata-emitter hook inside the codec. Fails C-5 — a new dependency with a license-verdict requirement.
- **Driver fit:** Attractive on driver 1 for generic shapes only; fails the project-private half entirely.
- **Pros:** Mature pattern corpora; community-maintained rules.
- **Cons:** Cannot express hashed private literals; no emitter integration; dependency and supply-chain surface against a zero-dependency alternative.
- **Why rejected:** Disqualifying failures; the generic-shape half of the need is met instead by committed generic pattern rules (Decision §1).

### Alternative 3 — Keyed HMAC over Literals (Uncommitted Key)

- **Eligibility:** Not eligible (fails C-2).
- **Summary:** Store HMAC digests with a secret key held outside the repository, defeating offline dictionary attacks against the committed list.
- **Constraint compliance:** Passes C-1 (only MACs are committed) but fails C-2 — CI must digest fixed-length candidate windows from scanned text and compare against the committed list; without the key it cannot compute the MACs, and committing the key nullifies the keying (equivalent to no key while adding secret-management surface). Detection in CI on committed data is impossible by construction.
- **Driver fit:** Best imaginable on hash robustness; zero on feasibility.
- **Pros:** Would remove the dictionary-guessability residual.
- **Cons:** Incompatible with keyless CI detection; introduces secret-management requirements (key storage, rotation) into a repository that keeps secrets in the environment only.
- **Why rejected:** Disqualifying C-2 failure. The residual it would fix is accepted explicitly instead (Decision §2).

### Alternative 4 — Hashed List as a Configuration-Layer Production Key

- **Eligibility:** Eligible (all constraints passable).
- **Summary:** Add a schema-documented production key holding the hashed guarded-literal list to the layered configuration catalog; the check and the emitter policy read it through the config layer.
- **Constraint compliance:** Passes all — hashes only (C-1), CI-readable (C-2), injectable into the codec (C-3/C-4), no dependency (C-5); reporting and validation are mechanism-owned regardless of placement (C-6/C-7).
- **Driver fit:** Weak on drivers 2, 6, and 7 — every literal addition rides a configuration-schema change with its catalog, parser, precedence, and test churn (blast radius); the catalog is deliberately empty in M0; configuration layers are user-overridable by design, so a project-local layer could weaken or empty the guard, converting a hard gate into a preference; and it front-loads the exact policy-data placement question M3-S5 owns (the config layer already hard-errors on secret material in repository-scoped config, and policy data is adjacent territory).
- **Pros:** One placement for "project data" generally; configuration tooling (validation, provenance) comes free.
- **Cons:** Schema churn per addition; enforcement becomes overridable; couples policy data into a user-facing surface before the policy engine decides placement.
- **Why rejected:** Survives constraints but loses on drivers to ALT-5. Recorded so placement is not re-litigated ad hoc (Decision §7).

### Alternative 5 — Dedicated Check + Committed Hashed Registry (selected)

- **Eligibility:** Eligible.
- **Summary:** One new repo invariant check (`scripts/checks/privacy-literals.ts`) plus a committed schema-versioned registry as the single authority; generic pattern rules in committed code shared with the emitter; positions §1–§7 below.
- **Constraint compliance:** Passes all (see attestation).
- **Driver fit:** Best or tied on every driver: zero blast radius outside `scripts/checks/**` and the codec's injected parameter; single authority; data-only literal additions; precedent-aligned; absorbable by the policy engine.
- **Pros:** Closes both leak channels with the smallest mechanism; every addition is a reviewed data edit.
- **Cons:** Two authority files beside an existing registry (branding) until M3-S5 consolidates; hash-scheme residuals documented below.
- **Why chosen:** See Decision.

## Decision

- **Decision:** ALT-5. The positions below are binding for GH-184 delivery; the WHAT and ACs stay owned by the change spec.
- **Rationale (tied to drivers):** Only ALT-5 satisfies every constraint while keeping additions data-only (driver 6), the codec pure (driver 2), reporting content-free (driver 4), and the mechanism shaped like the checks agents already maintain (drivers 3, 5, 7). ALT-4 is the honest runner-up and is preserved as a recorded non-choice until M3-S5.
- **Decider:** Juliusz Ćwiąkalski — acceptance pending at PR review; not claimed by this record.
- **Conditions for revisit:** See `revisit_triggers` in the front matter; primary ones are the M3-S5 policy engine, any oracle abuse of the committed digests, and any serialization path that bypasses the codec.

### 1. Architecture — one check, one registry authority, shared generic rules

One new repo invariant check at `scripts/checks/privacy-literals.ts` plus a committed, schema-versioned registry (beside it, mirroring the `forbidden-literals` registry placement) as the single authority for scan scope, generic rule ids, hashed entries, the allowlist, and exclusions. The registry is the project-configurable surface: adding a guarded literal is a data edit with no code change. Generic pattern rules (recognizer classes for credential-shaped and private-identifier-shaped content) live in committed code and are the same definitions the runtime metadata emitter consumes — one source of truth, so file scanning and envelope scanning cannot drift. The check follows house conventions: read-only over repository content, offline, invoked by `package.json` or CI (else `ci-topology` fails), mutation-tested under `tests/checks/**`.

### 2. Hashing — domain-prefixed SHA-256, no salt, no HMAC; documented residuals

Digest input is a versioned domain prefix concatenated with the normalized literal (trimmed, lowercased). No committed salt and no keyed HMAC (ALT-3 is infeasible for keyless CI detection; Decision §Alternative 3). Hashed entries record their digest and normalized length; detection enumerates fixed-length candidate windows of each distinct registered length over scanned text, normalizes each window identically, and compares digests. Edge semantics (delimiters, case folding details) are implementation-owned and mutation-tested.

Documented and accepted residuals:

- **Low-entropy literals remain offline-dictionary-guessable.** An unsalted digest list is a verification oracle for guesses. This is accepted because the hash list protects against accidental inclusion of private literals in public artifacts — not against a determined attacker with repository access. True secrets must never be listed; secret-shaped content is covered by the generic pattern rules instead.
- **A future policy engine (M3-S5) may replace this scheme** (keying, placement, or both) without contest from this record; the domain prefix is versioned so scheme evolution is explicit.

### 3. No-echo reporting — identifiers only, never content

Violation output never prints the matched literal, the digest input, or any content window. A violation names: the rule or entry id, the file, the line, and a redacted fingerprint derived from the rule/entry identifiers (never a digest of surrounding file content, so output cannot serve as a guess-testing oracle for non-matched content). Rationale: CI logs are public; the diagnostic channel must not become the leak channel.

### 4. No-cloud scope — hashed `cloud-term` class, mechanism-only until supplied

Hosted-product/cloud terms are guarded as hashed entries of class `cloud-term` in the same registry, so no raw cloud name is ever committed (ADR-0003 C-4). The class ships empty: the guard is deliberately mechanism-only until the owner supplies digests out-of-band. An empty class is valid and is scanned as vacuous — the mutation tests prove the mechanism by registering a synthetic digest and planting synthetic content, so an empty production class cannot silently mean a broken check.

### 5. Emitter scan — required injected content policy at the single serialization point

`serializeEnvelope` takes a required content policy — an injected, pure predicate — and returns a new fail-closed serialization failure (a content-policy failure kind carrying the rule id only, never content) for guarded content. The policy combines the committed generic pattern rules with the project's hashed entries using an injected hash function, so the codec keeps its no-`node:*`/`bun:*` purity (C-4). Required, not optional-with-default-open: every current and future call site must supply a policy, and because the codec is the only serialization point, any later production emitter inherits the scan by construction. This satisfies the "metadata envelopes are scanned at the emitter" AC even though no production emitter exists yet.

### 6. Scan boundary — working tree only, reason-bearing exceptions, fail-closed validation

The file scan covers the current working tree (tracked plus untracked-but-not-ignored files, per the existing check's file-set discipline) — no history replay and no corpus baseline. Git history is explicitly not claimed as covered: the guard prevents landing, and history remediation would be a separate owner action. The guard's own sources (rule definitions, registry, tests) and synthetic fixtures are allowlisted with a written reason per entry; exclusions are enumerated, each with a written reason. Registry validation fails closed on malformed entries, duplicates, and empty-but-claimed entries (an id claiming scope it does not fulfill).

### 7. Non-choice — no configuration-layer production key in M0 (recorded to prevent re-litigation)

The hashed list is **not** a new production key in the layered configuration model in M0. The production catalog stays empty of policy data. Rationale: adding a literal must not require a code or schema change (driver 6); the blast radius on configuration artifacts is zero (driver 2); and where policy data lives is M3-S5's open question — deciding it now via a privacy guard would be an accident, not a decision. ALT-4 remains the recorded runner-up; when the policy engine lands, migration is a deliberate revisit, not a drift.

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints C-1 through C-7 by design, subject to the delivery tests: digests only in committed data (C-1); a binding, mutation-tested, topology-verified CI gate (C-2); the scan anchored at the only serialization point with a required policy (C-3); policy and hash function injected, codec purity untouched (C-4); runtime built-ins only, lockfile unchanged (C-5); identifier-only reporting with output-shape assertions (C-6); schema-versioned registry with fail-closed validation and reason-bearing exceptions (C-7). No accepted-risk exceptions are taken against any constraint; the residuals in §2 and §6 are risks accepted within a compliant design, not constraint violations.

## Trade-offs & Consequences

### Positive Outcomes

- Both ticket ACs become mechanically enforced: planted guarded content fails CI, and envelopes are scanned at serialization, fail-closed.
- The paradox is closed: the guard never commits what it guards, and its output never echoes what it finds.
- Adding a literal is a reviewed data edit — no code change, no config schema churn, no dependency.
- One definition of the generic rules serves the file check and the emitter, so coverage cannot drift between them.
- The mechanism follows the established check pattern, so it is legible to agents and cheap to maintain for a solo developer.

### Negative Outcomes

- **Dictionary-guessable digests:** low-entropy literals in the committed hash list can be confirmed by offline guessing. Accepted (§2): the threat model is accidental inclusion, not a determined attacker with repository access.
- **History not scanned:** a literal that somehow landed before the guard stays in git history; the guard protects the tip of the tree only.
- **Mechanism-only no-cloud until populated:** the `cloud-term` class ships empty; the no-cloud rule is enforced only after the owner supplies digests. Deliberate and visible (vacuous-class mutation tests), but a real coverage gap until then.
- **Unlisted secret shapes:** generic pattern rules recognize classes of secret-shaped content, not every possible secret; a novel shape not matching any rule and never hashed slips through.
- **Two registries temporarily:** the privacy registry coexists with the branding registry until the policy engine consolidates authority.
- **Scan cost:** fixed-length window digesting is linear per distinct registered length over the corpus; acceptable at repository scale, monitored via CI runtime.

### Unresolved Questions

- [ ] Supply the private/cloud literal digests out-of-band and populate the registry classes (owner: Juliusz Ćwiąkalski, after landing).
- [ ] Confirm the false-positive profile of the generic pattern rules against the real corpus during delivery (owner: @coder, mutation tests + first real runs).
- [ ] Confirm window-scan performance at CI scale on the full repository corpus (owner: @coder).
- [ ] Whether future emitter-side policy should also consult telemetry/event payloads (telemetry concept names the emitter and storage) — deferred with the policy engine (owner: @pm, M3-S5 sequencing).

## Implementation Plan

1. Land the check and registry first: generic pattern rules, schema-versioned registry (scope, rule ids, hashed-entry classes, reason-bearing allowlist and exclusions), fail-closed validation, and the working-tree scan with no-echo reporting.
2. Add the mutation-test battery under `tests/checks/**` (per rule class, per scope, registry validation, vacuous-class, no-echo output shape) and wire the CI job plus `package.json` invocation so `ci-topology`/`ci-bindingness` verify binding.
3. Inject the required content policy into `serializeEnvelope` with the new fail-closed serialization failure; combine committed rules and hashed entries via the injected hash function; keep codec purity guards green.
4. Document the delivered guard in the feature spec set (privacy guard feature spec; touch points in the branding-seam, adapter-ports, scaffold, and result-contract specs as flagged by the change) and sync `doc/spec/**` in the system-spec-update phase.
5. Present this record at PR review; the owner supplies registry digests out-of-band after landing. The record stays `Proposed` until the owner accepts.

## Verification Criteria

- Planted guarded literal (synthetic digest registered + synthetic content planted per rule class and scope) → non-zero exit naming rule/entry id, file, line, fingerprint; output asserted to contain none of the planted content (C-2, C-6).
- Registry mutations (malformed, duplicated, empty-but-claimed, reasonless exception) → fail closed (C-7).
- Guarded envelope payload → serialization failure of the new kind, rule id only, no content echoed; codec imports unchanged (no `node:*`/`bun:*`); policy and hash function proven injectable via a deterministic fake (C-3, C-4).
- Empty `cloud-term` class → green and explicitly vacuous; registering a synthetic class entry and planting matching synthetic content → red (Decision §4).
- `ci-topology` and `ci-bindingness` green with the new job; lockfile unchanged; license audit green (C-2, C-5).
- Registry edit adding a synthetic entry requires no code change (demonstrated by the mutation harness) (Decision §1, §7).

## Confidence Rating

**Medium-high.** The mechanism composes three in-repo precedents (registry-as-authority scan, AST/predicate injection, fail-closed validation) that are all delivered and mutation-tested today, and the codec's single-serialization-point anchor is verified fact. The crypto residual is not a correctness question but an explicitly accepted risk bound. The open halves are empirical: the false-positive profile of the generic rules and the window-scan cost on the real corpus (TO-CONFIRM above), both resolved by the delivery tests.

## References

- Ticket GH-184 (M0-S15: Privacy and no-cloud guards); backlog story `doc/planning/oss-tooling/backlog.md` (M0-S15).
- `doc/planning/concepts/policy-as-code.md` — prose-today rows for the privacy and no-cloud rules; M3-S5 story mapping.
- `doc/planning/concepts/embedded-metadata.md` — no-private-identifiers-in-metadata guardrail; M0-S15 extension.
- `doc/planning/concepts/telemetry-and-events.md` — no-secrets-in-events guardrail (emitter/storage scan).
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — C-1/C-4/C-11 (OSS-only committed artifacts), C-9/DEC-2 (codec purity), C-2 (license discipline).
- [TDR-0004](TDR-0004-state-storage-engine.md) — Proposed-during-delivery and acceptance-pending precedent.
- `scripts/checks/forbidden-literals.ts` + `forbidden-literals.registry.json` — registry-as-authority, baseline, allowlist, mutation-test precedent.
- `scripts/checks/secret-read-boundary.ts` — exact-path, reason-bearing, fail-closed allowlist precedent.
- `scripts/checks/error-table-sync.ts` — code/doc binding-sync precedent.
- `packages/core/src/contracts/envelope.ts`; `packages/adapters/src/io/envelope-codec.ts` — envelope contract and the single serialization point.
- `packages/core/src/config/catalog.ts`; `doc/spec/features/feature-config-layer.md` — deliberately empty production catalog (Decision §7).
- `doc/spec/features/feature-branding-seam.md` — guard contract precedent (scan semantics, CI binding).
- `.ai/rules/typescript.md` (dependency/license rule, purity, injected seams); `.ai/rules/testing-strategy.md` (check + mutation-test convention).
- Change ledger: `doc/changes/2026-10/2026-10-31--GH-184--privacy-and-no-cloud-guards/chg-GH-184-pm-notes.yaml`.
