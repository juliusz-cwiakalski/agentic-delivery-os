---
change:
  ref: GH-184
  type: feat
  status: Proposed
  slug: privacy-and-no-cloud-guards
  title: "M0-S15: Privacy and no-cloud guards"
  owners: [engineering]
  service: delivery-os repository checks and metadata codec
  labels: [change, planning]
  version_impact: minor
  audience: internal
  security_impact: high
  risk_level: medium
  dependencies:
    internal:
      - monorepo scaffold and CI invariants
      - result contract
      - config layer
      - branding seam
      - adapter ports, credential port and embedded metadata envelope
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make the "private and hosted-only content never lands in committed files or public CI logs" boundary mechanical: one repository invariant with a committed hashed-literal registry and generic secret/private-shape rules, a hashed no-cloud class, no-echo reporting, and a required content policy at the metadata envelope's single serialization point — without committing the content it protects, adding a dependency, or breaking codec purity.

## 1. SUMMARY

Deliver the privacy guard as one repo invariant check (`scripts/checks/privacy-literals.ts` plus `scripts/checks/privacy-literals.registry.json`) built from two halves: generic, committed pattern rules for secret-shaped and private-identifier-shaped content, and a project-configurable hashed-literal registry whose raw values are never committed. Hosted-product/cloud content is guarded as hashed entries of class `cloud-term` in the same registry, so the no-cloud rule needs no raw term list. At the metadata layer, `serializeEnvelope` gains a required, injected, pure content policy that scans the exact representation to be embedded and returns a new fail-closed serialization failure carrying a rule id only; generic rule definitions are shared with the file check so coverage cannot drift. The guard is a binding CI step, proven non-vacuous by mutation tests, with a local authoring mode for producing new hashes without echoing or committing the literal.

## 2. CONTEXT

### 2.1 Current State Snapshot

- The repository is public and its CI logs are visible; ADR-0003 C-1/C-4/C-11 forbid cloud names, private references, and proprietary implementation in committed files.
- `scripts/checks/forbidden-literals.ts` is a mature registry-as-authority scan, but it holds only three already-public brand tokens as raw literals and scans brand-shaped content. Its registry model cannot hold private literals, because the registry itself is committed.
- `scripts/checks/secret-read-boundary.ts` is an AST allowlist for ambient environment reads. It does not inspect file content, so it cannot detect a private identifier pasted into a document or a credential-shaped value in a fixture.
- No privacy-literal guard, hashed-literal list, no-cloud check, or metadata content scan exists today.
- `serializeEnvelope` in the adapter I/O tier is the only envelope serialization point. The codec is adapter-internal, deterministic, and free of `node:*`/`bun:*` imports, ambient reads, clock, and randomness. No production comment emitter exists yet; the write-comment adapter path is not implemented.
- The envelope v1 payload is closed at the type level and admits no secret or credential field, but nothing inspects serialized content. Provider-visible artifacts built from that envelope are intended to be public.
- Existing repository invariants are binding, fail-closed, mutation-tested under `tests/checks/**`, and enforced through `ts-invariants`, `ts-test`, `ci-topology`, `ci-bindingness`, `ci-supply-chain`, `script-surface`, and the CI check mutation suite.

### 2.2 Pain Points / Gaps

- The strongest privacy rules in the repository are prose today; a contributor can land a private identifier or a credential-shaped value and no gate notices.
- A naive denylist cannot be committed: the guard would publish exactly the content it exists to keep out, and a verbose failure message would turn public CI logs into the leak channel.
- The no-cloud rule has the same construction paradox and additionally cannot name hosted-product terms anywhere in committed files.
- Adding a guarded literal currently has no supported path other than code change, which invites ad-hoc, unreviewed exceptions.
- The envelope payload is closed by type but not scanned before embedding; a future emitter would inherit a type-level promise with no runtime check.
- There is no way to prove an empty or unexercised guard is a working guard rather than a silently broken one.

## 3. PROBLEM STATEMENT

Because the privacy and no-cloud boundary is prose and the only existing content scanner is brand-only with raw already-public literals, a contributor can commit a private identifier, a credential-shaped value, or hosted-product content without any gate noticing — and any naive mechanical guard would leak the very content it protects through its committed list or its public failure output — resulting in a public repository that cannot honestly claim the ADR-0003 OSS boundary and metadata emitters that carry an unenforced secret-free promise.

## 4. GOALS

- **G-1**: Detect generic secret-shaped and private-identifier-shaped content in the working tree with committed, high-specificity rules that keep documentation false positives low.
- **G-2**: Detect project-private literals through a committed, schema-versioned hashed-entry registry, so adding a guarded literal is a reviewed data edit with no raw literal in the repository.
- **G-3**: Enforce the no-cloud boundary as hashed `cloud-term` entries in the same registry, with no raw hosted-product term committed and a non-vacuous activation proof.
- **G-4**: Make violations reportable in public logs without echoing content: rule/entry id, file, line, and a content-free fingerprint only.
- **G-5**: Scan metadata envelopes at the single serialization point through a required, injected, pure content policy that shares the generic rules with the file check and keeps codec purity.
- **G-6**: Prove the guard binding and non-vacuous in CI, including a local authoring path for new hashes and a minor release of the shared package surface.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Guarded generic rule classes with a positive, a near-miss negative, and a mutation case | 7/7 initial rules |
| Planted guarded values that fail the file scan with a named rule/entry, file, line and fingerprint | 100% of mutation cases |
| Planted content echoed in any output channel | 0 occurrences |
| Declared hashed-entry classes exercised by a synthetic activation case | 2/2 (`private-literal`, `cloud-term`) |
| Registry malformation classes that fail closed | 100% of the validation matrix |
| Committed raw private literals, raw hosted-product terms, salts, or keys | 0 |
| Metadata payloads scanned at the single serialization point | 1/1 serialization path; required policy, no default-open |
| New package dependencies or lockfile changes | 0 |
| Changeset coverage for the five-package fixed group | 1 minor changeset, 5 packages |

### 4.2 Non-Goals

- **NG-1**: No new package dependency, no external secret-scanning tool, no policy engine, and no secret manager; runtime built-ins at the check edge and injected pure inputs at the codec are the whole mechanism.
- **NG-2**: No configuration-layer production key for the hashed list; policy data placement remains the policy engine's later decision.
- **NG-3**: No git-history replay, corpus baseline, or retroactive remediation; the guard protects the tip of the working tree only.
- **NG-4**: No scanning of human-readable comment content at the emitter; the emitter scan covers the envelope payload, and the file guard remains the gate for committed document content.
- **NG-5**: No separate no-cloud script; the no-cloud rule is realized as the `cloud-term` hashed-entry class inside the same guard.
- **NG-6**: No production emitter, adapter, or provider integration; the scan attaches to the existing single serialization point and is inherited by later emitters.
- **NG-7**: No binary-content deep inspection at v1; binary files are skipped and counted, with the residual documented.
- **NG-8**: No new result-contract error code in this change; the content-policy failure is codec-local and its domain mapping belongs to the future emitter.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Generic privacy-literal detection with committed rule definitions | Covers content shapes that must never be committed, independently of any project-specific list. |
| F-2 | Hashed-literal registry with `private-literal` entries | Detects project-private content without committing it, as data rather than code. |
| F-3 | Hashed `cloud-term` class for the no-cloud boundary | Enforces the no-cloud rule without committing a hosted-product term. |
| F-4 | Fail-closed registry validation and a bounded working-tree scan | Malformed or weakening data cannot turn the gate green; the scan stays offline, deterministic, and finite. |
| F-5 | Content-free reporting and a local hashing helper | Public logs never become the leak channel; new digests can be produced safely. |
| F-6 | Required content policy at the single serialization point | Every current and future metadata emitter inherits the payload scan by construction. |
| F-7 | Binding CI wiring and a local command | The gate is enforced on every pull request, not advisory, and is reproducible locally. |
| F-8 | Versioned release metadata for the touched shared surfaces | The contract/codec change ships as one deliberate fixed-group release. |

### 5.1 Capability Details

- **F-1**: The committed generic rule set recognizes credential-shaped and private-identifier-shaped content in any scanned text file. The initial v1 rule ids and their abstract recognizer classes are:
  - `secret.provider-token-prefix` — a documented provider-issued access-token prefix followed by an opaque tail above the rule's minimum length.
  - `secret.private-key-block` — an armored private-key block header belonging to a recognized key-format family, which signals key material.
  - `secret.web-token` — a three-segment base64url credential with a decodable structured header/payload shape and a minimum length.
  - `secret.bearer-credential` — an authorization assignment carrying a bearer-scheme credential value.
  - `secret.credential-assignment` — a secret-named key assigned an opaque value under minimum-length and character-class heuristics.
  - `secret.connection-string-credential` — a connection URI or DSN whose user-information segment carries a password.
  - `private.absolute-user-path` — an absolute personal home/profile path containing a concrete user segment.

  Each rule is data in committed code (id, recognizer class, severity, pattern source and flags, minimum match length) and is compiled by the consumers. A committed placeholder-suppression list excludes documentation placeholders, redaction markers, and obviously fabricated sample values. Public documentation, change artifacts, and code samples are in scope; the false-positive corpus must stay at zero violations. Rule patterns are committed but never weakened through registry data.
- **F-2**: The registry holds hashed entries of class `private-literal`. An entry is exactly `{ id, class, algorithm, hash, length, reason }` with `algorithm` fixed to `sha256` at v1; the raw literal, the digest input, any salt, and any key never appear in the repository. Hashing uses a versioned, domain-separated SHA-256 over the normalized literal: the literal is trimmed, lowercased, prefixed with the versioned domain separator, and hashed; the registry stores only the lowercase hexadecimal digest and the normalized length. Detection enumerates fixed-length candidate windows of each distinct registered length over the scanned text, normalizes each window identically, and compares digests. Normalization and boundary semantics are implementation-owned, deterministic, and mutation-tested. Adding or removing an entry changes detection with no code change.
- **F-3**: The no-cloud boundary is enforced through hashed entries of class `cloud-term` in the same registry. The class ships empty with an explicit empty reason; an empty class is valid and is reported as scanned-and-vacuous. The mechanism is proven non-vacuous by a synthetic `cloud-term` entry and matching synthetic content in a temporary tree, so an empty production class cannot silently mean a broken check. Raw hosted-product terms are never committed anywhere — not in the registry, tests, docs, or examples.
- **F-4**: Registry validation is fail-closed. The registry is schema-versioned and declares the supported working-tree scope mode, the enabled generic rule ids, the two hashed-entry classes, the entries, the reason-bearing allowlist, and the reason-bearing exclusions. Validation rejects: missing or unknown schema version; unknown or weaker scope mode; missing, unknown, or extra enabled rule ids when compared with the committed rule set; unknown classes; empty classes without an empty reason; malformed entries; duplicate ids; duplicate digests; unknown algorithms; digest or length shape mismatches; duplicate digests with inconsistent lengths; reasonless entries; allowlist entries that match no scanned path; duplicate or reasonless allowlist/exclusion entries; and any entry or count beyond the caps. Invalid data stops the scan; no partial scan is reported as a pass. The scan covers the current working tree only — tracked plus untracked-but-not-ignored files — and never reads git history. Binary files are detected and skipped with a counted, reported exclusion. Enumerated exclusions (for example generated output, dependencies, temporary content) and allowlist entries each carry a written reason. The allowlist names the guard's own rule-definition module, check, registry, check/behaviour tests, and the dedicated synthetic-fixture root (`tests/fixtures/privacy-literals/`); the fixture root is the only directory-style allowlist entry, so a synthetic value can live beside a test without hiding a real value elsewhere.
- **F-5**: Violation reporting names the rule or entry id, the file, the line, and a short stable fingerprint derived only from the rule/entry id under a versioned domain separator. It never prints the matched literal, the digest input, any content window, or a digest of surrounding file content. Human-readable and machine-readable output modes obey the same content-free rule. A local authoring mode of the guard reads a new literal from standard input only (never from a command-line argument or environment variable), does not echo it, does not write the repository, and prints only the fields needed to paste a registry entry (id placeholder, class, algorithm, digest, length, reason placeholder). It prefers hidden terminal input, accepts piped standard input for controlled local use, and refuses to run when a CI environment is detected so it cannot run or leak in a shared job.
- **F-6**: `serializeEnvelope` takes a required, injected, pure content policy. The policy receives the exact compact JSON representation that would be embedded for the validated v1 envelope (payload included, so escaping cannot hide a match) and returns either an allow verdict or a deny verdict carrying one rule/entry id. The codec maps a deny verdict to a new fail-closed serialization failure kind, `content-policy-violation`, carrying only the rule/entry id and never content; no carrier is produced. Validation order is: closed-payload validation, size bound, then content policy, then carrier construction; every failure path is total and non-throwing. The policy combines the committed generic rule definitions with the project's hashed entries using an injected pure hash function and injected entry data. The codec imports only contract types and remains free of runtime imports, ambient reads, clock, randomness, filesystem, and network. Because the codec is the only serialization point, every later production emitter inherits the scan by construction. Human-readable comment content is explicitly outside this scan.
- **F-7**: The guard is wired bindingly into CI. The invariant runs by name in the `ts-invariants` job, which has no `continue-on-error`, no bypass construct, and no need for full git history because the scan is working-tree only. The new mutation and behaviour suites run under the binding `ts-test` job through `pnpm test`. A root script, `check:privacy-literals`, provides the local command; it is deliberately not chained into the aggregate `check` script, preserving the exact aggregate contract asserted by the existing CI checks. `ci-topology` sees the new check as invoked, `ci-bindingness` sees no bypass, `ci-supply-chain` sees no new job surface, `script-surface` remains satisfied, and `tests/checks/ci-checks.test.ts` stays green without weakening its exact assertions.
- **F-8**: The change ships one changeset declaring a minor bump for the five-package fixed group (`@delivery-os/core`, `@delivery-os/adapters`, `@delivery-os/cli`, `@delivery-os/mcp`, `@delivery-os/opencode`) because the envelope contract and codec signature change. Package manifest versions are not hand-edited; the lockfile is unchanged; the license audit stays green.

## 6. USER & SYSTEM FLOWS

1. **Contributor plants guarded content → local gate**: A contributor adds a private identifier or credential-shaped value to a scanned file → the local privacy command scans the working tree → it exits non-zero naming the rule/entry id, file, line, and fingerprint → the contributor removes or replaces the content without ever seeing the matched value reproduced in the log.
2. **Owner adds a guarded literal → data-only registry edit**: The owner runs the authoring mode locally and pastes a new entry into the registry → review sees only a digest, class, length, and reason → the next scan detects the literal in the working tree with no code change.
3. **No-cloud activation**: The production `cloud-term` class is empty and reported as vacuous → a synthetic class entry and synthetic content are used in the mutation suite to prove activation → when the owner supplies real hashes out-of-band, the same path enforces the no-cloud rule without a code change.
4. **Metadata write**: A caller builds a v1 envelope → `serializeEnvelope` validates closure and size → the injected policy scans the exact envelope JSON → a clean payload proceeds to the chosen carrier; a guarded payload returns `content-policy-violation` with a rule id only and produces no carrier.
5. **Registry corruption or weakening**: A malformed, duplicated, unknown-algorithm, inconsistent-length, empty-but-claimed, or out-of-bounds registry edit is introduced → validation fails closed naming the field or entry id → no scan result is reported as green.
6. **False positive in public documentation**: A legitimate document triggers a generic rule → review adds a reason-bearing, exact-path suppression if the pattern is genuinely safe, or the rule definition is tightened; broad or pattern-guessed suppression is rejected.

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- A new repository invariant check (`scripts/checks/privacy-literals.ts`) and its committed, schema-versioned registry (`scripts/checks/privacy-literals.registry.json`) as the single authority for scope mode, enabled generic rule ids, hashed-entry classes and entries, allowlist, exclusions, and caps.
- The seven initial generic rules listed in F-1, their committed definitions, placeholder suppression, and positive/near-miss/false-positive corpora.
- The hashed-entry schema, normalization and window-detection semantics, the `private-literal` and `cloud-term` classes, an explicit empty-class reason, and synthetic activation proofs.
- The local authoring/hashing mode with stdin-only input, no echo, no repository writes, and CI refusal.
- Content-free human-readable and machine-readable reporting, including the stable identifier-only fingerprint.
- A required injected pure content policy at `serializeEnvelope`, the new `content-policy-violation` serialization failure, shared generic rule definitions between the file check and the policy, and codec purity preservation.
- Binding CI wiring in `ts-invariants`, the local `check:privacy-literals` script, and the mutation/behaviour test suites under the existing test job.
- The five-package minor changeset and the documentation-sync touch points flagged for the system-spec update phase.

### 7.2 Out of Scope

- [OUT] Any new package dependency, external scanner, secret manager, keyed hashing, salt, or key rotation mechanism.
- [OUT] A configuration-layer production key or any user-overridable surface that could weaken the guard.
- [OUT] Git-history replay, corpus baselines, retroactive remediation, or a claim that history is covered.
- [OUT] Scanning human-readable comment content at the emitter.
- [OUT] A policy engine, policy DSL, rule-authoring UI, or policy mutation audit trail.
- [OUT] A separate no-cloud script, job, or registry; the no-cloud rule remains the `cloud-term` class.
- [OUT] Production emitters, provider adapters, or changes to parse/degradation behavior.
- [OUT] Binary deep inspection, archive inspection, or encoded/compressed payload decoding.
- [OUT] New result-contract error rows or domain error mappings for the codec-local failure.
- [OUT] Raw literals, raw hosted-product terms, real credentials, or owner private data in any fixture, test, document, or example.

### 7.3 Deferred / Maybe-Later

- Owner-supplied private and hosted-product digests after landing, which turn the mechanism into real coverage for this repository.
- Mapping `content-policy-violation` to a result-contract error identity when the first production emitter lands.
- Migrating the registry into the policy engine's placement (M3-S5), including keying or per-project registries if the threat model changes.
- Extending the scan to telemetry/event payloads when the telemetry emitter and storage path land.
- Binary, archive, and encoded-content inspection if a real exposure path appears.
- A human-readable metadata scan if a future decision gives it an owner and a false-positive budget.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

None. The guard is offline and read-only; no network surface is added.

### 8.2 Events / Messages

None. No new event, metric, or persisted schema is introduced. Scan summaries and failures are command output only.

### 8.3 Data Model Impact

| ID | Element | Contract |
|----|---------|----------|
| DM-1 | Privacy guard registry | Schema-versioned committed data: supported working-tree scope mode, enabled generic rule ids, declared classes, hashed entries, reason-bearing allowlist, reason-bearing exclusions, and caps. The single authority for scan configuration. |
| DM-2 | Hashed literal entry | Exactly `{ id, class, algorithm, hash, length, reason }`. `class` is `private-literal` or `cloud-term`; `algorithm` is `sha256` at v1; `hash` is a lowercase hexadecimal digest; `length` is the normalized literal length; `reason` is non-empty. No raw literal, digest input, salt, or key. |
| DM-3 | Generic rule definition | Committed code data: id, recognizer class, severity, pattern source and flags, minimum match length. The registry enumerates the enabled ids, which must exactly equal this set at v1; patterns themselves are code, not data. |
| DM-4 | Violation record | `{ ruleOrEntryId, file, line, fingerprint }`. The fingerprint is a short stable value derived only from the rule/entry id under a versioned domain separator; it is never derived from file content, the digest input, or a content window. |
| DM-5 | Envelope content policy | A pure, total function from the exact compact JSON of the validated v1 envelope to `{ ok: true }` or `{ ok: false, ruleOrEntryId }`. It is injected into serialization; it never throws, reads the environment, uses the clock, uses randomness, or performs I/O. |
| DM-6 | Extended serialization failure | `EnvelopeSerializationFailure` gains `content-policy-violation`, and that failure result carries one `ruleOrEntryId` only. Existing `payload-not-closed` and `size-bound-exceeded` failures and their fields are unchanged; no content is carried by any failure. |
| DM-7 | Authoring output | The local hashing mode emits a registry-entry-shaped record with an id placeholder, chosen class, algorithm, digest, normalized length, and reason placeholder. It never emits the literal, the digest input, or the domain-separated preimage. |

### 8.4 External Integrations

None. The guard uses runtime built-ins at the check edge, the codec receives pure injected inputs, and no vendor API, network call, or external scanner is involved. No package dependency is added and the lockfile is unchanged.

### 8.5 Backward Compatibility

- `serializeEnvelope` becomes stricter: the content policy is required in the serialization input. Every in-repo call site, fixture, and test supplies a policy; there is no default-open overload and no optional fallback. This is an intentional pre-release contract tightening captured by the fixed-group minor changeset.
- Envelope parsing, stripping, carrier encoding, degradation reasons, and size bounds are unchanged; existing round-trip and degradation suites remain green.
- Existing repository checks, CI jobs, aggregate scripts, and package boundaries are unchanged except for the additive check invocation and the local script. The bash job set is byte-unchanged.
- The registry format is additive but new; there is no prior privacy registry to migrate.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

**Hard constraints (binding, from TDR-0005):**

- **C-1**: No raw private literal, private identifier, hosted-product term, or secret is committed in any artifact of the guard.
- **C-2**: A committed file containing a guarded literal fails CI in a binding job.
- **C-3**: Envelopes are scanned at the single serialization point and fail closed; no serialization path bypasses the policy.
- **C-4**: The codec keeps its no-`node:*`/`bun:*`, no-ambient, no-clock, no-randomness purity; policy and hash are injected.
- **C-5**: No new dependency; runtime built-ins only at the check edge.
- **C-6**: Violation output never echoes matched content, digest input, or content windows.
- **C-7**: The registry is schema-versioned and fails closed; every allowlist entry and exclusion carries a written reason.

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism and read-only behavior | Two consecutive runs over the same tree and registry produce byte-identical output; 0 files written; 0 network calls; stable ordering by path, line, then id. |
| NFR-2 | Generic-rule precision | 0 violations on the committed false-positive corpus (prose, documentation, code samples, change artifacts); each enabled rule has at least one positive and at least one near-miss negative. |
| NFR-3 | Public-log safety | 0 occurrences of the planted literal, any content window from the scanned file body, or its digest input across stdout, stderr, and machine-readable output; fingerprint length ≤ 16 characters and derived only from identifiers. |
| NFR-4 | Non-vacuity | 100% of enabled generic rules have positive, near-miss, and mutation cases; 100% of declared classes are exercised by a synthetic activation case; every empty class carries an empty reason; 0 rules or classes can be silently unexercised. |
| NFR-5 | Scan performance and linearity | Full working-tree scan completes in ≤ 60 s on the CI reference runner for a text corpus ≤ 50 MiB; per-file hash work is linear in scanned bytes for each distinct registered length, with at most 32 distinct lengths and each window bounded by the literal-length cap; emitter policy adds ≤ 10 ms per 2048-byte envelope on the CI reference runner; no superlinear backtracking pattern is accepted. |
| NFR-6 | Codec purity and compatibility | 0 `node:*`/`bun:*` imports in the codec; 0 ambient environment, clock, randomness, filesystem, or network accesses; 100% of existing envelope behaviour tests green; 100% of serialization call sites pass a policy; no default-open path. |
| NFR-7 | CI bindingness and wiring integrity | 0 bypass constructs in the guard's job; the guard is invoked by name in `ts-invariants`; `ci-topology`, `ci-bindingness`, `ci-supply-chain`, `script-surface`, and `tests/checks/ci-checks.test.ts` are green; new suites execute under the binding test job and fail it on failure. |
| NFR-8 | Release and dependency integrity | Exactly one changeset declares a minor bump for all five fixed-group packages; 0 hand-edited manifest versions; unchanged lockfile; license audit green; 0 new dependencies. |
| NFR-9 | Registry bounds | ≤ 256 hashed entries total; ≤ 128 per class; ≤ 32 distinct normalized lengths; normalized literal length 4–512 characters; digest exactly 64 lowercase hexadecimal characters; registry file ≤ 256 KiB; every exceeded bound fails closed naming the bound. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

No new event schema, sink, or metric. Observability is the command output: the scan reports the working-tree scope counts, per-class file counts, the number of enabled rules, the number of hashed entries per class, and each explicitly vacuous class. Failures report the rule/entry id, file, line, and content-free fingerprint, plus a registry-validation message naming the offending field or entry id. A machine-readable output mode exposes the same fields for tests and CI assertions. No content, digest input, or content window is ever emitted.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Unsalted committed digests form an offline verification oracle for low-entropy guesses | M | M | Documented and accepted in TDR-0005; threat model is accidental inclusion, not a determined attacker with repository access; true secrets are covered by generic rules and must never be listed; revisit trigger on confirmed abuse. | M — low-entropy literals remain guessable by an offline attacker |
| RSK-2 | Generic rules produce false positives in public docs and invite allowlist erosion | M | M | High-specificity heuristics, placeholder suppression, a committed false-positive corpus, near-miss negatives, and reason-bearing exact-path suppressions reviewed in the change. | L |
| RSK-3 | Unlisted secret shapes or binary/encoded content slip through | H | M | Generic rules cover common credential and private-path shapes; owner-supplied hashes cover project literals; binary/encoded coverage is an explicit non-goal and a documented residual. | M — novel or encoded shapes can pass |
| RSK-4 | Empty `cloud-term`/`private-literal` classes give a false sense of coverage | M | H | Explicit empty reason, class-level vacuity reporting, and synthetic activation tests per class; owner digest population is a visible follow-up. | M — real coverage waits for owner hashes |
| RSK-5 | A future refactor adds a default-open policy or a second serialization path | H | L | Required parameter with no optional overload; single-serialization-point audit; codec-purity and call-site tests; revisit trigger in TDR-0005. | L |
| RSK-6 | Window hashing or a pathological pattern makes CI slow or superlinear | M | M | Caps on distinct lengths and literal length; bounded patterns; performance fixture and NFR-5 budget; measured in CI. | L |
| RSK-7 | The guard's own allowlist hides a real literal | H | L | Exact-path entries with reasons; the allowlist covers only rule definitions, registry, tests, and synthetic fixtures; an allowlist entry matching nothing fails closed; review of any growth. | M |
| RSK-8 | Registry weakening (scope, enabled rules, caps) silently disables coverage | H | L | Supported scope mode and enabled-rule set are exact-match validated; caps enforced; any change is a reviewed data edit; mutation tests prove fail-closed behavior. | L |
| RSK-9 | Generic definitions drift between the file check and the emitter | M | L | One shared pure rule-definition module consumed by both; a paired-fixture test asserts the same rule id at both surfaces. | L |

## 12. ASSUMPTIONS

- `serializeEnvelope` is the only envelope serialization point today, and no production emitter exists yet; attaching the policy there is the emitter scan.
- The owner holds the real private and hosted-product literals privately and can supply digests out-of-band after landing; the mechanism ships with no `private-literal` entries and an empty, explicitly reasoned `cloud-term` class.
- Runtime built-ins provide SHA-256 at the check edge; the codec receives the hash function and policy as injected pure inputs, so it needs no runtime import.
- Repository text content is UTF-8; binary detection and skipping are acceptable at v1 and are reported rather than silent.
- The registry is a reviewed data surface; adding a literal is a data edit, but changing scope, rules, or caps is a reviewed mechanism change.
- The public CI log is the threat channel for reporting; no diagnostic may carry content.
- Existing checks, CI topology, aggregate scripts, and boundary rules are authoritative and must remain green.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-170 / M0-S1 (monorepo scaffold and CI invariants) | Check conventions, `ts-invariants`, `ts-test`, topology/bindingness/supply-chain/script-surface, mutation-test discipline. |
| Depends on | GH-172 / M0-S3 (result contract) | Failure-shape discipline and the rule that a new identity must be deliberate; no new error row is introduced here. |
| Depends on | GH-173 / M0-S4 (config layer) | Confirms environment-only secrets and the empty production catalog; policy data is deliberately not placed there. |
| Depends on | GH-171 / M0-S2 (branding seam) | Brand-neutral constants and the registry-as-authority precedent. |
| Depends on | GH-181 / M0-S12 (adapter ports and embedded metadata) | The envelope contract and the single `serializeEnvelope` point that gains the required policy. |
| Depends on | TDR-0005 (guard mechanics) | Binding mechanics: hashing scheme, no-echo, class model, emitter policy, working-tree boundary, non-choice on config. |
| Depends on | ADR-0003 C-1/C-4/C-11, C-9/DEC-2 | OSS-only committed artifacts, codec purity, privacy baseline. |
| Constrains | Future metadata emitters | Must supply a content policy to serialize; no bypass path. |
| Constrains | M3-S5 policy engine | Absorbs or replaces this registry deliberately; placement is not decided here. |
| External | None | No vendor API, scanner, service, or new package. |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Which real private and hosted-product literals should the owner register? | The mechanism ships empty by design; real coverage requires owner-supplied digests. | Open — owner action after landing; not a delivery blocker. |
| OQ-2 | Should a future production emitter map `content-policy-violation` to a result-contract error code? | The failure is codec-local and carries a rule id only; no emitter exists to project it. | Deferred — Decision needed when the first emitter lands: consult `@decision-advisor`. |
| OQ-3 | What exact minimum lengths, entropy thresholds, and placeholder segments should each generic rule use? | The rule ids and classes are fixed; tuning is empirical against the real corpus. | Decision needed during delivery: consult `@decision-advisor` only if tuning changes the recognized classes materially. |
| OQ-4 | Where should policy data live after the policy engine (M3-S5) lands? | TDR-0005 records the config-key alternative and defers placement. | Deferred — Decision needed at M3-S5: consult `@decision-advisor`. |
| OQ-5 | Should binary/archive/encoded content ever be scanned? | Current scope is text working-tree content; deep inspection is a documented residual. | Deferred — revisit if a real exposure path appears. |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Conform to TDR-0005 in full: one check plus one committed hashed registry, domain-separated unsalted SHA-256, no-echo reporting, hashed `cloud-term` class, required policy at `serializeEnvelope`, working-tree-only scan, and no config-layer production key. | The TDR is the authoritative mechanics decision; the spec's job is to define WHAT and ACs without re-litigating it. | 2026-10-31 |
| DEC-2 | Generic rule definitions live in one pure, dependency-free module shared by the file check and the emitter policy; the registry holds enabled rule ids and data, never pattern overrides. | Single source of truth prevents drift and keeps patterns non-weakenable through data. The module stays pure so the codec can consume it without runtime imports. | 2026-10-31 |
| DEC-3 | No new CI job and no change to the aggregate `check` script. The guard runs by name in `ts-invariants`; the local command is a standalone `check:privacy-literals` script; new tests run under `ts-test`. | `ci-checks.test.ts` pins the exact `TS_JOBS` list, workflow job set, and aggregate string; adding a job or changing the aggregate would require weakening those assertions. Additive wiring in the existing binding job satisfies the ticket without that churn. | 2026-10-31 |
| DEC-4 | The registry declares the two classes explicitly; an empty class requires an explicit empty reason; caps are fixed at the NFR-9 values. | This distinguishes a deliberately vacuous class from a broken or silently emptied one, and bounds scan cost and oracle surface. | 2026-10-31 |
| DEC-5 | `content-policy-violation` is a codec-local serialization failure kind carrying one rule/entry id; no result-contract error row is added. | Existing serialization failures are codec-local; introducing a domain error code before any emitter exists would speculate on projection semantics. | 2026-10-31 |
| DEC-6 | The authoring helper is a local mode of the guard: stdin-only (never argv or environment), no-echo, no repository writes, prefers hidden terminal input, accepts piped stdin locally, and refuses CI execution. | A safe digest-production path is required for data-only extensibility; command-line arguments and accidental CI use are avoidable leak channels. | 2026-10-31 |
| DEC-7 | Scan scope is the current working tree (tracked plus untracked-but-not-ignored), text-only, with enumerated reason-bearing exclusions and allowlist; no history or baseline. | Matches the TDR boundary and the existing file-set discipline; history remediation is a separate owner action. Binary skipping is an accepted residual. | 2026-10-31 |
| DEC-8 | Human-readable comment content is not scanned at the emitter. | The ticket requires metadata-envelope scanning; human content has no envelope and its file-committed form is covered by the file guard. Scanning it at the emitter would exceed the decision and create an unowned false-positive surface. | 2026-10-31 |
| DEC-9 | Release the contract/codec change as one minor changeset for the five-package fixed group. | The required policy changes the serialization contract surface; the repository's fixed-group release model makes one deliberate minor release the correct shape. | 2026-10-31 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Repository invariant checks | New `privacy-literals` check and registry; shared rule definitions consumed by the check. |
| Adapter I/O tier | New pure rule-definition/policy module beside the envelope codec; codec gains the required policy and the new failure kind. |
| Core contracts | The envelope content-policy contract type joins the existing envelope contract surface (type-only; no new runtime behavior). |
| CI workflow | Additive invocation of the new check in `ts-invariants`; no new job, no bash change, no aggregate change. |
| Root workspace scripts | New `check:privacy-literals` local command; aggregate `check` unchanged. |
| Tests | New mutation suite under `tests/checks/**`, behaviour suite for the emitter policy, shared rule parity tests, and structure/inventory updates. |
| Release metadata | One minor changeset for the five fixed-group packages. |
| System documentation (sync phase) | New privacy-guard feature spec; touch points in the branding-seam, adapter-ports, scaffold/toolchain, and result-contract specs; glossary terms. |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the seven initial generic rules, **when** a synthetic positive value for each rule is planted in a non-allowlisted scanned file, **then** the scan exits non-zero once per planted value and names the rule id, file, and line. | F-1, DM-3, DM-4 |
| AC-F1-2 | **Given** the committed false-positive corpus and each rule's positive and near-miss negative cases, **when** the corpus is scanned or evaluated, **then** the false-positive corpus yields 0 violations and every enabled rule has at least one positive and one near-miss negative. | F-1, NFR-2, NFR-4 |
| AC-F2-1 | **Given** a synthetic `private-literal` registry entry and the matching literal planted in a scanned file, **when** the scan runs, **then** it fails naming the entry id, file, line, and fingerprint; with the literal removed, the same tree passes. | F-2, DM-2 |
| AC-F2-2 | **Given** a registry entry produced by the authoring helper, **when** it is added as data and the matching synthetic literal is planted, **then** the same scan detects it with no code change or rebuild. | F-2, F-5, DM-7 |
| AC-F2-3 | **Given** case and edge-whitespace variants of a registered synthetic literal, **when** all variants are planted, **then** every variant whose normalized form matches is detected, and repeated runs report the same violation set. | F-2, NFR-1 |
| AC-F3-1 | **Given** the production registry with an empty `cloud-term` class carrying an explicit empty reason, **when** the live working tree is scanned, **then** the scan passes and reports the class as explicitly scanned-and-vacuous. | F-3, NFR-4 |
| AC-F3-2 | **Given** a synthetic `cloud-term` entry and matching synthetic content, **when** the content is planted, **then** the scan fails naming the entry id; with the entry removed, the same content passes. | F-3, NFR-4 |
| AC-F4-1 | **Given** each malformed registry case (missing/unknown schema version, unknown class, duplicate id, duplicate digest, unknown algorithm, digest/length shape mismatch, duplicate digest with inconsistent length, reasonless entry, empty class without an empty reason, allowlist entry matching nothing), **when** validation or scanning runs, **then** each case fails closed with a non-zero exit naming the field or entry id and no scan pass is reported. | F-4, DM-1, DM-2 |
| AC-F4-2 | **Given** a temporary repository whose history contains a guarded value but whose working tree does not, **when** the scan runs, **then** it passes; **given** an untracked-but-not-ignored file with the value, **then** it fails; **given** an ignored file with the value, **then** it is not scanned. | F-4, DM-1, NFR-1 |
| AC-F4-3 | **Given** a registry that uses an unknown or weaker scope mode, omits or adds an enabled rule id, or exceeds any NFR-9 cap, **when** validation runs, **then** it fails closed naming the mode, rule id, or exceeded bound. | F-4, NFR-9 |
| AC-F4-4 | **Given** the same working tree and registry, **when** the scan runs twice, **then** output is byte-identical, the git working-tree status is unchanged, and no network access occurs. | F-4, NFR-1 |
| AC-F5-1 | **Given** any generic, hashed-entry, or cloud-term violation, **when** human-readable and machine-readable output are produced, **then** each contains the rule/entry id, file, line, and a fingerprint, and contains none of the planted literal, any content window from the scanned file body, or its digest input. | F-5, NFR-3 |
| AC-F5-2 | **Given** the authoring mode, **when** a synthetic literal is supplied on standard input, **then** it emits only registry-entry fields, never echoes the literal or digest input, and writes no repository file; **when** a CI environment is present, **then** it refuses to run. | F-5, DM-7, NFR-3 |
| AC-F6-1 | **Given** a v1 envelope with a guarded value in a payload field, **when** `serializeEnvelope` is invoked with the required policy, **then** it returns `content-policy-violation` with one rule/entry id, produces no carrier, and echoes no content. | F-6, DM-5, DM-6 |
| AC-F6-2 | **Given** a clean v1 envelope, **when** it is serialized with the policy across every declared carrier, **then** serialization succeeds, the byte bound holds, and the existing round-trip and degradation suites remain green. | F-6, NFR-6 |
| AC-F6-3 | **Given** the envelope codec, **when** its imports and ambient behavior are inspected, **then** it has 0 `node:*`/`bun:*` imports and 0 ambient environment, clock, randomness, filesystem, or network accesses; policy and hash are injected; dependency-cruiser and purity gates are green. | F-6, NFR-6 |
| AC-F6-4 | **Given** a guarded value that matches a committed generic rule, **when** the file scan and the emitter policy each evaluate it, **then** both report the same rule id from the shared rule set. | F-6, F-1, DM-3 |
| AC-F6-5 | **Given** human-readable comment content containing a guarded-looking value and a clean envelope payload, **when** the envelope is serialized, **then** the policy leaves the human content unchanged and the scan does not block it. | F-6, NFR-6 |
| AC-F7-1 | **Given** a guarded value planted in a tracked scanned file, **when** the binding CI jobs run, **then** `ts-invariants` invokes the guard by name and fails; `ci-bindingness` finds no bypass; `ci-topology`, `ci-supply-chain`, `script-surface`, and `tests/checks/ci-checks.test.ts` remain green. | F-7, NFR-7 |
| AC-F7-2 | **Given** a clean working tree, **when** the local `check:privacy-literals` command runs, **then** it exits 0 offline without a package build and reports scope, rule, entry, and vacuous-class counts. | F-7, NFR-7 |
| AC-F7-3 | **Given** the new mutation and behaviour suites, **when** the binding test job runs, **then** both suites execute under `pnpm test` and a deliberately failing case in either suite fails the job. | F-7, NFR-7 |
| AC-F8-1 | **Given** the completed change, **when** changeset and manifest state are checked, **then** exactly one changeset declares a minor bump for all five fixed-group packages, no manifest version is hand-edited, and the lockfile is unchanged. | F-8, NFR-8 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

Deliver the guard and the emitter scan in one change, in this order: shared pure rule definitions; the registry and fail-closed validation; the working-tree scan and no-echo reporting; the authoring mode; the mutation and behaviour suites; the CI wiring and local script; the required codec policy and new failure kind; the changeset. The guard must be green on the clean tree before the codec tightening lands, and the codec must be green with all call sites updated before the change is proposed. Documentation is reconciled in the system-spec-update phase.

**Definition of Done predicates:** all 22 ACs have passing, traceable evidence; the guard is proven to fire on every mutation case and to stay green on the clean tree; no output contains planted content; the registry validation matrix fails closed; the `cloud-term` class is explicitly vacuous and the synthetic activation case fires; every serialization call site passes a policy and the codec purity gates pass; the changeset is present for the five fixed-group packages; all existing binding gates (`pnpm check`, CI invariants, tests, boundaries, license audit) remain green; an open unmerged pull request targets the integration branch with all required jobs green.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

No migration. The privacy registry is new and ships with no `private-literal` entries and an empty, explicitly reasoned `cloud-term` class. Real entries are supplied by the owner after landing as reviewed data edits. No existing file is rewritten, no package manifest version is hand-edited, and no persisted state is affected.

## 20. PRIVACY / COMPLIANCE REVIEW

This change exists to satisfy the ADR-0003 C-11 privacy baseline and the C-1/C-4 OSS boundary without committing the protected content. The registry stores only domain-separated digests and lengths; raw literals never enter the repository, tests, docs, or CI logs. Reporting is content-free by construction so public CI logs cannot become the leak channel. The accepted residual — low-entropy digests are offline-guessable — is explicitly bounded to accidental-inclusion protection and is documented in TDR-0005. Human-readable comment content is not scanned at the emitter; the file guard governs committed human content. No personal data beyond existing repository metadata is collected or stored.

## 21. SECURITY REVIEW HIGHLIGHTS

- The guard is fail-closed: malformed, duplicated, unknown-algorithm, inconsistent-length, under-specified, or weakening registry data is an error, not a pass.
- The committed list is a digest list, not a secret store; true secrets must never be listed and are covered by generic rules.
- No salt, key, or keyed MAC is introduced, because keyless CI detection cannot use them; the residual is accepted and documented rather than hidden.
- The codec's required policy has no default-open path; a future second serialization path is the primary escape risk and is covered by the single-point audit and revisit trigger.
- The guard's own allowlist is a reviewed, exact-path, reason-bearing surface; an allowlist entry that matches nothing fails closed.
- No new dependency, no network, and no external scanner reduce supply-chain and data-exfiltration surface.
- The no-cloud class contains no raw term, satisfying ADR-0003 C-4 for the guard itself.

## 22. MAINTENANCE & OPERATIONS IMPACT

Maintainers own four guarded surfaces: the generic rule set (code review and corpus tuning), the registry (data edits with reasons and caps), the allowlist/exclusions (exact paths with reasons), and the required codec policy (purity and call-site discipline). Adding a real literal requires the authoring mode and a reviewed registry edit only. Tightening a rule or adding a rule requires a code and registry change in the same pull request, enforced by the exact-match enabled-rule validation. The scan is offline and read-only, so it has no operational runbook impact. When the policy engine lands (M3-S5), the registry is migrated deliberately under its own change, not silently.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Privacy-literal guard | The repository invariant that scans committed content for generic secret/private shapes and project-configured hashed literals. |
| Generic rule | A committed code definition recognizing a class of secret-shaped or private-identifier-shaped content by id. |
| Hashed literal entry | A registry record containing a digest, class, algorithm, normalized length, id, and reason — never the raw literal. |
| `private-literal` | The hashed-entry class for project-private content the owner wants never committed. |
| `cloud-term` | The hashed-entry class for hosted-product/cloud terms that must never be committed raw. |
| Normalized literal | The literal after trimming and lowercasing, used identically for hashing and candidate-window comparison. |
| Candidate window | A fixed-length span of scanned text, normalized and digested for comparison with a registered length. |
| Content-free fingerprint | A short stable value derived only from a rule/entry id, used in violation output instead of content. |
| Content policy | The injected pure predicate that scans the exact serialized envelope representation and returns allow or a denial rule id. |
| `content-policy-violation` | The fail-closed serialization failure kind produced when the content policy denies a payload. |
| Vacuous class | A declared hashed-entry class with no production entries, carrying an explicit empty reason and proven activatable by a synthetic test. |
| Working-tree scan | A scan of tracked plus untracked-but-not-ignored files at the current tip, with no history replay. |

## 24. APPENDICES

### A. Ticket acceptance-criterion traceability

| Ticket AC | Covered by | Evidence boundary |
|-----------|------------|-------------------|
| A committed file containing a guarded literal fails CI | AC-F1-1, AC-F2-1, AC-F3-2, AC-F4-2, AC-F5-1, AC-F7-1 | Planted-value mutation cases fire with named id/file/line/fingerprint; the guard is invoked by name in the binding `ts-invariants` job; no content is echoed. |
| Metadata envelopes are scanned at the emitter | AC-F6-1, AC-F6-2, AC-F6-3, AC-F6-4, AC-F6-5, AC-F7-3 | Guarded payload returns the new fail-closed failure with a rule id only; clean payload round-trips; codec purity and shared-rule parity proven; human content explicitly outside the scan. |

### B. TDR-0005 position traceability

| TDR position | Spec coverage |
|--------------|---------------|
| §1 One check, one registry authority, shared generic rules | F-1, F-2, F-4, DM-1, DM-3, DEC-2 |
| §2 Domain-separated unsalted digest; documented residuals | F-2, DM-2, RSK-1, §20 |
| §3 No-echo identifiers-only reporting | F-5, DM-4, NFR-3, AC-F5-1 |
| §4 No-cloud as hashed `cloud-term`, mechanism-only until supplied | F-3, AC-F3-1, AC-F3-2, RSK-4 |
| §5 Required injected policy at the single serialization point | F-6, DM-5, DM-6, NFR-6, AC-F6-1..5 |
| §6 Working-tree-only boundary; reason-bearing exceptions; fail-closed | F-4, DM-1, DEC-7, AC-F4-1..4 |
| §7 No config-layer production key in M0 | NG-2, DEC-1, OQ-4 |

### C. Non-vacuity and fail-closed evidence matrix

| Surface | Positive proof | Negative/clean proof | Fail-closed proof |
|---------|----------------|----------------------|-------------------|
| Generic rule | One synthetic positive per rule | False-positive corpus + near-miss per rule | N/A; rules are code-defined |
| `private-literal` entry | Synthetic entry + planted synthetic literal | Same tree without the literal | Duplicates, malformed entry, caps |
| `cloud-term` entry | Synthetic entry + planted synthetic content | Production class empty and explicitly vacuous; same content without the entry | Malformed class/entry, empty without reason |
| Registry scope/rules | Supported scope and exact rule set | N/A | Unknown/weaker scope, missing/extra rule id |
| Emitter policy | Guarded payload denied | Clean payload serialized across carriers | Codec purity and shared-rule parity |
| CI wiring | Guard invoked in `ts-invariants` | Clean tree passes | Bypass constructs rejected by bindingness/topology |

### D. Command and job surface

| Surface | Contract |
|---------|----------|
| Local guard command | `check:privacy-literals` root script invoking the check; offline, no build, no network. |
| Local authoring mode | A mode of the same check; stdin-only, no echo, no repository writes, refuses CI execution. |
| CI invariant job | `ts-invariants`, additive invocation by name; binding, no `continue-on-error`, no bypass construct, no history requirement. |
| CI test job | `ts-test`, which runs the new mutation and behaviour suites through `pnpm test`. |
| Aggregate script | Unchanged; the new check is deliberately not chained into `check`, preserving the exact aggregate contract. |
| Preserved invariants | `ci-topology`, `ci-bindingness`, `ci-supply-chain`, `script-surface`, and `tests/checks/ci-checks.test.ts` must stay green. |

### E. Requirement reconciliations

| Apparent tension | Resolution in this spec |
|------------------|-------------------------|
| The ticket names a "no-cloud-in-committed-files check"; TDR-0005 realizes it as a hashed class inside the privacy guard. | F-3 keeps it inside the single guard and reports `cloud-term` as a named class, so the no-cloud outcome stays visible without a second raw-term surface. |
| The ticket says metadata envelopes are scanned "at the emitter"; no production emitter exists. | F-6 attaches the required policy at the only serialization point; later emitters inherit it by construction. |
| A required policy changes the serialization signature. | §8.5 treats this as an intentional pre-release tightening, updates all in-repo call sites, and forbids a default-open overload; the fixed-group minor changeset records it. |
| Fail-closed rejects "empty-but-claimed" entries, yet `cloud-term` may ship empty. | F-3/F-4 require an explicit empty reason per empty class plus a synthetic activation proof, so an intentional empty class is distinguishable from a broken one. |
| Generic rules must be shared, but the codec must stay pure. | DEC-2 puts definitions in a pure shared module; the codec receives the policy and hash as injected inputs and imports only contract types. |
| Existing CI checks pin the exact job list and aggregate string. | DEC-3 wires the guard into the existing binding `ts-invariants` job and a standalone local script, adding no job and not changing the aggregate. |
| A new failure identity might imply a new result-contract error row. | DEC-5 keeps `content-policy-violation` codec-local; domain mapping is deferred to the first production emitter (OQ-2). |

### F. Sources

Ticket GH-184 (M0-S15); backlog story M0-S15; policy-as-code concept (privacy and no-cloud prose rows); embedded-metadata concept (guardrails and story mapping); TDR-0005; ADR-0003 (C-1/C-4/C-9/C-11, DEC-2); the delivered forbidden-literal scan and registry; the secret-read boundary check; the CI topology/bindingness/script-surface checks; the envelope contract and codec; the envelope round-trip and behaviour suites; the GH-184 clarify-scope ledger.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-10-31 | Change Spec Writer | Initial GH-184 specification from the ticket, TDR-0005, the backlog story, the policy-as-code and embedded-metadata concepts, ADR-0003, and the delivered check/codec precedents. |

---

## AUTHORING GUIDELINES

Grounded only in the ticket, TDR-0005, the planning concepts, and the delivered repository surfaces. The spec fixes WHAT and acceptance evidence, not implementation steps. Named scripts, jobs, contract modules, and commands are integration contracts required by the ticket and the repository's binding-check conventions; no line-level edits, code snippets, or step-by-step tasks are included. The no-cloud rule is expressed through the TDR's hashed-class mechanics rather than a separate raw list, and the emitter scan is expressed at the single serialization point because no production emitter exists. The specification contains no raw private literal, no hosted-product name, and no secret-shaped example; all recognizers are described by class and rule id.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-184); `owners` has at least one entry; `status` is Proposed.
- [x] All sections present in order (1–25 + authoring guidelines + checklist).
- [x] ID prefixes consistent and unique (F-, DM-, NFR-, RSK-, DEC-, OQ-, AC-).
- [x] Every AC is Given/When/Then, references at least one F-/DM-/NFR- ID, and is independently verifiable.
- [x] NFRs include measurable thresholds; risks include impact, probability, mitigation, and residual risk.
- [x] Out-of-scope items marked `[OUT]`; non-goals align with TDR-0005 and the ticket.
- [x] Ticket ACs and TDR positions traced in the appendices.
- [x] No raw private literal, hosted-product term, secret-shaped example, salt, key, or dependency is introduced.
- [x] Only this spec file was written; no other files were modified.
