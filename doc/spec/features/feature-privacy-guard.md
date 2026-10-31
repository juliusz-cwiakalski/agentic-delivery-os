---
id: SPEC-PRIVACY-GUARD
status: Current
created: 2026-10-31
last_updated: 2026-10-31
owners: ["engineering"]
service: delivery-os
summary: "The two-part privacy and no-cloud guard: a binding working-tree invariant with seven generic secret/private-shape rules and a schema-versioned hashed-literal registry, plus a required injected pure content policy at the envelope codec's single serialization point; content-free reporting, a stdin-only CI-refusing authoring mode, fixed caps, and explicit accepted residuals."
links:
  related_changes: ["GH-184"]
  related_decisions: ["ADR-0003", "TDR-0005"]
  contracts:
    - "packages/core/src/contracts/envelope.ts"
---

# Feature: Privacy and No-Cloud Guards

## Overview

The privacy and no-cloud guard keeps project-private content, secret-shaped content, and hosted-only terms out of committed files and out of the metadata envelopes that later become public provider artifacts. It has two parts that share one rule definition set:

- A binding repository invariant (`scripts/checks/privacy-literals.ts`) scans every text file in the current working tree. It applies seven committed generic rules for secret-shaped and private-identifier-shaped content and matches project-configured literals through a committed, schema-versioned registry of domain-separated SHA-256 digests.
- A required, injected, pure content policy at `serializeEnvelope` scans the exact compact JSON representation that would be embedded in a metadata carrier and returns a fail-closed `content-policy-violation` serialization failure carrying a rule or entry id only.

The registry is the single authority for scan scope, enabled generic rule ids, hashed-entry classes and entries, the reason-bearing allowlist, reason-bearing exclusions, and the fixed caps. The guard never commits a raw private literal, hosted-product term, salt, or key. Violation output names an id, file, line, and identifier-only fingerprint, never matched content, so public CI logs cannot become the leak channel.

The pure rule vocabulary lives in `packages/adapters/src/io/privacy-rules.ts`; the policy builder lives in `packages/adapters/src/io/envelope-content-policy.ts`; the check consumes both across the established dev edge. The envelope contract additions (`ContentPolicyVerdict`, `EnvelopeContentPolicy`) live in `packages/core/src/contracts/envelope.ts`. The unrelated branding scan is described in [Branding Seam and Working Name](feature-branding-seam.md); the envelope contract and codec in [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md); the workspace and CI inventory in [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md). The authoritative decision is [TDR-0005](../../decisions/TDR-0005-privacy-and-no-cloud-guard-mechanics.md); the OSS boundary is [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md).

## Business Context

### Problem Statement

- **Problem:** The boundary "private, secret, or hosted-only content never lands in committed files or public CI logs" is prose unless it is mechanical. A naive denylist would commit the very content it protects; a verbose failure message would publish a match through public logs; and a type-level secret-free envelope offers no runtime scan before a future emitter embeds it.
- **Affected Users:** Maintainers and AI agents committing files, security and privacy reviewers, the owner supplying private and hosted-product digests, and every future metadata emitter that serializes an envelope.
- **Business Impact:** Without the guard, accidental inclusion can only be caught by reviewer attention, and a metadata promise has no mechanical enforcement. With it, both channels are closed at the tip of the working tree and at the single serialization point, without a new dependency or a weakening user-facing override.

### Goals & Success Metrics

- **Primary Goal:** A committed file containing a guarded literal fails a binding CI job, and a guarded envelope payload fails serialization, with zero content echoed.
- **KPIs:**
  - 7/7 generic rules have a positive, a near-miss negative, and a mutation case.
  - 2/2 hashed-entry classes are proven activatable by a synthetic case even while the production classes are empty.
  - 100% of malformed or weakening registry states fail closed.
  - 0 raw private literals, raw hosted-product terms, salts, or keys are committed.
  - 1/1 envelope serialization path scans the exact embedded representation through a required policy with no default-open path.

## User Experience & Functionality

### Two-part guard

| Part | Boundary | Enforcement |
|------|----------|-------------|
| Working-tree invariant | Every tracked and untracked-but-not-ignored text file at the current tip | `scripts/checks/privacy-literals.ts` in `ts-invariants`; local `check:privacy-literals` |
| Envelope content policy | The exact compact JSON of a validated v1 envelope at `serializeEnvelope` | Required `policy` input; denial returns `content-policy-violation` and no carrier |

Both parts consume the same pure rule definitions, so file scanning and emitter scanning cannot report different ids for the same generic shape.

### Generic rule set

The committed rules are data in `packages/adapters/src/io/privacy-rules.ts`; the registry enumerates the enabled ids and may not override patterns. Each definition carries an id, a recognizer class, `severity: error`, a pattern source, flags, and a minimum match length.

| Rule id | Recognizer class |
|---------|------------------|
| `secret.provider-token-prefix` | A documented provider-issued access-token prefix followed by an opaque tail above the minimum length. |
| `secret.private-key-block` | An armored private-key block header for a recognized key-format family. |
| `secret.web-token` | A three-segment base64url credential with a structured header/payload shape and a minimum length. |
| `secret.bearer-credential` | An authorization assignment carrying a bearer-scheme credential value. |
| `secret.credential-assignment` | A secret-named key assigned an opaque value satisfying minimum-length and character-class heuristics. |
| `secret.connection-string-credential` | A connection URI or DSN whose user-information segment carries a password. |
| `private.absolute-user-path` | An absolute personal home or profile path containing a concrete user segment. |

The patterns are high-specificity by design: they prioritize low false positives over recall, and rule tuning happens in code review rather than through registry data. A committed placeholder-suppression list recognises documentation placeholders, redaction markers, and obviously fabricated sample markers. Marker evaluation is scoped to the rule's protected value segment — the user segment for home/profile paths, the password portion of URI userinfo, the assigned value for credential assignments, and the token tail for bearer credentials — never to the separator, prefix, or key that introduces it. A markerless value therefore still fires even when its separator contains a bare marker token (for example, the `user` in `/Users/` or the `apikey` key in an assignment). The emitter policy is different: it deliberately does not apply documentation-placeholder suppression, because machine-generated metadata has no documentation context.

### Registry authority and schema

`scripts/checks/privacy-literals.registry.json` is the single authority. Its schema version is `privacy.registry.v1`, and its scope mode is `working-tree`.

| Registry field | Contract |
|----------------|----------|
| `schemaVersion` | Exactly `privacy.registry.v1`; a missing or different value fails closed. |
| `scopeMode` | Exactly `working-tree`; any weaker or unknown mode fails closed. |
| `enabledRuleIds` | Exactly the seven committed rule ids, with no missing, extra, unknown, or duplicate id. |
| `classes` | Exactly the two declared class ids, `private-literal` and `cloud-term`. |
| `classes.<id>.emptyReason` | A non-empty reason when the class has zero entries; `null` when it has entries. |
| `classes.<id>.entries` | Hashed entries of exactly `{ id, class, algorithm, hash, length, reason }`. |
| `allowlist` | Reason-bearing `{ id, kind, path, rules, reason }` entries for guard-owned sources, tests, and the synthetic fixture root. |
| `exclusions` | Reason-bearing file entries for generated content that is never hand-authored. |

A hashed entry fixes `algorithm` to `sha256`, stores `hash` as exactly 64 lowercase hexadecimal characters, stores `length` as the normalized literal length between 4 and 512 characters, and requires a non-empty `reason`. The raw literal, digest input, salt, and key never appear in the repository. Adding or removing a guarded literal is a reviewed data edit with no code change.

Allowlist entries are exact paths with a written reason and a rule scope. A rule scope is either `["*"]` alone or a non-empty subset of committed rule ids; unknown ids, duplicates, mixed wildcard scopes, absolute paths, POSIX-invalid paths, parent segments, trailing separators, and prefix or wildcard path forms fail closed. Only the synthetic fixture root (`tests/fixtures/privacy-literals/`) may be a directory entry, so a synthetic value can live beside a test without hiding a real value elsewhere. An allowlist entry that matches no enumerated path fails closed. Exclusions are file-only and must exist. The guard's own rule module, check, registry, suites, fixture root, and the enumerated pre-existing or archival paths that cannot be remediated in this change are the only allowlisted surfaces.

### Normalization, hashing, and matching

A literal is normalized exactly once: trimmed, then lowercased. Entry building and window matching call the same normalization, so the two paths cannot drift.

- The digest input is a versioned domain separator (`privacy.literal.v1`) followed by the normalized literal.
- Hashing is unsalted SHA-256 rendered as lowercase hexadecimal. No salt, key, or keyed MAC exists, because keyless CI detection on committed data cannot use one.
- Detection enumerates fixed-length candidate windows for each distinct registered length, normalizes each window identically, skips any window whose normalized length differs from the registered length, and compares digests.
- Case and edge-whitespace variants that normalize to a registered literal are detected. Repeated runs over the same tree and registry are byte-identical.

**Accepted residual risk.** A committed digest list is an offline verification oracle for low-entropy guesses. This is accepted because the guard protects against accidental inclusion in public artifacts, not against a determined attacker with repository access. True secrets must never be listed as hashed entries; secret-shaped content is covered by the generic rules instead. This residual is bound in TDR-0005 and is revisited if oracle abuse is confirmed.

### No-echo reporting

Every violation reports `{ ruleOrEntryId, file, line, fingerprint }` in both human-readable and machine-readable modes.

- The fingerprint is a short, stable FNV-1a-64 value derived only from the rule or entry id under the versioned separator `privacy.fingerprint.v1`. It is never derived from file content, a digest input, or a content window.
- Output never prints the matched literal, the digest input, any content window, or a digest of surrounding content.
- Summary output reports the scanned-file count, binary-skipped count, excluded count, allowlisted count, enabled-rule count, entry count per class, distinct-length count, and each explicitly vacuous class with its reason.
- Exit codes are `0` for green, `1` for violations or fail-closed validation, and `2` for usage errors and authoring-mode refusal. A usage or refusal exit is distinct from a finding.

### Scan boundary

The scan enumerates the working tree exactly once through `git ls-files --cached --others --exclude-standard`. It covers tracked files and untracked files that are not ignored; it never reads git history, `.git`, ignored content, or a corpus baseline. The current tip is the whole claim.

- Binary detection skips a file when its leading window contains a NUL byte or is not decodable as UTF-8. Binary skips are counted and reported, never silent.
- Exclusions are applied before binary detection; allowlisted files are still scanned, and the allowlist suppresses only the rules named by each entry at that exact path.
- Violations are sorted by path, then line, then id using deterministic code-unit ordering, independent of locale or ICU. Nothing is written and no network-capable module is imported by the check.
- History, archive, encoded-content, and binary deep inspection are outside the claim; a literal that landed before the guard remains in history until a separate owner action.

### Fail-closed validation

Registry validation runs before any scan result can be reported green. The sequence is: registry presence and size cap; JSON parse and object shape; schema version; scope mode; enabled-rule set equality; class declarations; entry shape, algorithm, digest, length, reason, duplicates, and cross-entry digest/length consistency; entry and class caps; allowlist and exclusion path shape, rule scope, reasons, duplicates, and existence against the enumerated tree. A malformed or weakening edit stops the scan and names the field or entry id; no partial scan is reported as a pass.

Rejected states include a missing or unknown schema version, an unknown or weaker scope mode, a missing, extra, or unknown enabled rule id, an undeclared or extra class, an empty class without an `emptyReason`, a non-empty class with a non-null `emptyReason`, a malformed entry, a duplicate id, a duplicate digest, a duplicate digest with an inconsistent length, an unknown algorithm, a digest or length shape mismatch, a reasonless entry, an allowlist entry matching no path, a duplicate or reasonless allowlist or exclusion entry, a non-existent exclusion, and any count above the caps.

### Authoring mode

`bun run scripts/checks/privacy-literals.ts --author [--class private-literal|cloud-term]` produces a paste-ready registry entry from a literal supplied on standard input.

- Input is read from hidden terminal input when a TTY is present, or from piped standard input for controlled local use. Command-line arguments and environment variables are never input channels.
- The command never echoes the literal, the digest input, or the domain-separated preimage. It prints only the record fields: an id placeholder, the chosen class, `sha256`, the digest, the normalized length, and a reason placeholder.
- It writes no repository file and refuses to run when a CI environment is detected.
- The default class is `private-literal`. The normalized length must be between the minimum and maximum caps; failures do not echo the supplied value.

### CI binding

The guard is binding and additive.

- `.github/workflows/ci.yml` invokes `bun run scripts/checks/privacy-literals.ts` by name in the existing `ts-invariants` job. The job has no `continue-on-error`, no bypass construct, and no history requirement.
- The root script `check:privacy-literals` is the local command. It is deliberately not chained into the aggregate `check` script, so the aggregate contract stays exactly as pinned by the existing CI invariants.
- The guard's mutation, registry, scope, reporting, authoring, performance, CI-wiring, release, and import-purity suites run under the binding `ts-test` job through the workspace test command.
- `ci-topology`, `ci-bindingness`, `ci-supply-chain`, `script-surface`, and the CI-check assertions remain green; the guard adds no job and no bash change.

### Emitter content-policy contract

`packages/core/src/contracts/envelope.ts` declares two contract types:

```ts
type ContentPolicyVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly ruleOrEntryId: string };

type EnvelopeContentPolicy = (compactJson: string) => ContentPolicyVerdict;
```

`serializeEnvelope` requires `policy: EnvelopeContentPolicy` in its input; there is no default-open overload and no optional fallback. Serialization validates in this order:

1. Closed v1 payload validation.
2. Serialized byte-size bound (`ENVELOPE_MAX_BYTES`).
3. Content-policy evaluation over the exact compact JSON that would be embedded, payload included, so escaping cannot hide a match.
4. Carrier construction.

A denial returns `{ ok: false, failure: "content-policy-violation", byteLength, ruleOrEntryId }` and produces no carrier. The failure carries the rule or entry id only and never content. Existing `payload-not-closed` and `size-bound-exceeded` failures are unchanged. `content-policy-violation` is codec-local; it is not an error-table row and has no result-contract projection in this feature.

The policy builder `buildEnvelopeContentPolicy({ hash, entries })` combines the shared generic rules with injected hashed entries. Generic rules take deterministic precedence, then hashed entries are consulted through the injected hash. The returned policy is total, non-throwing, and free of I/O, ambient reads, clock, and randomness. The builder validates its injected inputs at construction time and fails closed (throws) on a non-function hash, malformed or duplicate digests, duplicate ids, out-of-range lengths, and more than 32 distinct lengths; this is the fail-closed point for injected entries. The emitter policy intentionally does not apply documentation-placeholder suppression, so a marker-carrying guarded payload is still denied. The distinct-length guard inside the window matcher is a belt-and-braces check that is unreachable after registry and builder validation. The codec imports only contract types and receives the policy and hash as injected inputs, so codec purity is preserved. Human-readable comment content is outside the policy input and is never scanned at the emitter; committed human content is governed by the file scan.

### Flows

1. **Contributor plants guarded content:** the local or CI scan enumerates the working tree, matches a generic rule or hashed entry, exits non-zero naming id, file, line, and fingerprint, and never reproduces the value.
2. **Owner adds a guarded literal:** the owner runs the authoring mode locally, reviews the digest-only record, and pastes it into the registry; the next scan detects the literal with no code change.
3. **No-cloud activation:** the production `cloud-term` class is empty and reported as vacuous; a synthetic class entry and synthetic content in a temporary tree prove activation; owner-supplied digests later exercise the same path.
4. **Metadata write:** a caller builds a v1 envelope and passes a policy to `serializeEnvelope`; a clean payload proceeds to the declared carrier, and a guarded payload returns `content-policy-violation` with an id only.
5. **Registry corruption or weakening:** validation stops the scan, names the field or entry id, and never reports a green result.

## Technical Architecture & Codebase Map

### Core components

| Path | Responsibility |
|------|----------------|
| `packages/adapters/src/io/privacy-rules.ts` | Pure, dependency-free rule definitions, suppression classes, domain separators, caps, normalization, generic matcher, candidate-window matcher, and identifier fingerprint. |
| `packages/adapters/src/io/envelope-content-policy.ts` | Pure policy builder combining generic rules with injected hashed entries. |
| `packages/adapters/src/io/envelope-codec.ts` | Required policy input, validation order, and the `content-policy-violation` failure. |
| `packages/adapters/src/io/index.ts` | Internal `#io/*` re-export surface for the policy builder types. |
| `packages/core/src/contracts/envelope.ts` | `ContentPolicyVerdict` and `EnvelopeContentPolicy`. |
| `packages/core/src/contracts/index.ts` | The `core ./contracts` export surface for the two policy types. |
| `scripts/checks/privacy-literals.ts` | Registry validation, working-tree enumeration and scan, content-free reporting, and authoring mode. |
| `scripts/checks/privacy-literals.registry.json` | The scan authority: scope, rule ids, classes, entries, allowlist, exclusions. |
| `tests/checks/privacy-*.test.ts` | Mutation and behaviour suites for detection, registry validation, scope, reporting, authoring, performance, CI wiring, and release integrity. |
| `tests/checks/privacy-support.ts` | Shared synthetic harness for the privacy suites. |
| `tests/behaviour/envelope-content-policy.test.ts` | Emitter policy denial, ordering, carrier coverage, purity, and shared-rule parity. |
| `tests/structure/privacy-imports.test.ts` | Rule-module purity and definition-set assertions. |
| `tests/structure/envelope-contract.test.ts` | Required-policy contract and single-serialization-point assertions. |
| `tests/types/envelope-policy.type-test.ts` | Compile-time proof that a policy-less call is rejected. |
| `tests/fixtures/privacy-literals/**` | The synthetic-only fixture root, the sole directory-style allowlist entry. |

### Constants and caps

| Constant | Value | Rule |
|----------|-------|------|
| `privacy.registry.v1` | Schema version | Any other value fails closed. |
| `working-tree` | Scope mode | Any weaker or unknown mode fails closed. |
| `PRIVACY_HASH_DOMAIN` | `privacy.literal.v1` | Versioned digest-input separator. |
| `PRIVACY_FINGERPRINT_DOMAIN` | `privacy.fingerprint.v1` | Versioned identifier-only fingerprint separator. |
| `maxEntries` | 256 | Total hashed entries. |
| `maxEntriesPerClass` | 128 | Entries in one class. |
| `maxDistinctLengths` | 32 | Distinct normalized lengths. |
| `minLength` / `maxLength` | 4 / 512 | Normalized literal length bounds. |
| `digestHexLength` | 64 | Lowercase hexadecimal digest length. |
| `maxRegistryBytes` | 262144 | Registry file ceiling (256 KiB). |

### Interface contracts

- **Scan result:** summary counts, per-class entry counts, vacuous classes with reasons, and violation records of `{ ruleOrEntryId, file, line, fingerprint }`.
- **Human and machine output:** both carry the same content-free fields; the machine mode is the JSON rendering used by tests and CI assertions.
- **`serializeEnvelope(input)`:** returns `{ ok: true, carrier, byteLength }`, `{ ok: false, failure: "payload-not-closed" | "size-bound-exceeded", byteLength }`, or `{ ok: false, failure: "content-policy-violation", byteLength, ruleOrEntryId }`.
- **`buildEnvelopeContentPolicy(inputs)`:** returns an `EnvelopeContentPolicy`; its inputs are a pure hash function and hashed entries carrying only `{ id, hash, length }`.
- **Authoring record:** `{ id, class, algorithm, hash, length, reason }` with placeholders for id and reason; the literal and digest input are never output.

## Non-Functional Requirements

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Determinism and read-only behavior | Two runs over the same tree and registry are byte-identical; 0 writes; 0 network calls; stable path → line → id ordering. |
| NFR-2 | Generic-rule precision | 0 violations on the committed false-positive corpus; at least one positive and one near-miss negative per enabled rule. |
| NFR-3 | Public-log safety | 0 occurrences of a planted literal, a scanned content window, or a digest input in human or machine output; fingerprint derived only from identifiers. |
| NFR-4 | Non-vacuity | Every enabled rule has positive, near-miss, and mutation coverage; every declared class has a synthetic activation case; every empty class carries a reason. |
| NFR-5 | Scan performance and linearity | Full working-tree scan within 60 s on the CI reference runner for a text corpus up to 50 MiB; window hashing linear per distinct registered length with at most 32 lengths; emitter policy within 10 ms per 2048-byte envelope; no superlinear backtracking pattern. |
| NFR-6 | Codec purity and compatibility | 0 `node:*`/`bun:*` imports in the codec; 0 ambient environment, clock, randomness, filesystem, or network accesses; all existing envelope behaviour suites green; every serialization call site supplies a policy. |
| NFR-7 | CI bindingness | The guard is invoked by name in `ts-invariants`; no bypass construct; the binding test job runs the new suites; topology, bindingness, supply-chain, script-surface, and CI-check assertions stay green. |
| NFR-8 | Release and dependency integrity | 0 new dependencies; unchanged lockfile; one deliberate fixed-group minor release for the contract/codec surface. |
| NFR-9 | Registry bounds | The caps in “Constants and caps” are enforced; every exceeded bound fails closed naming the bound. |

## Quality Assurance Strategy

| Level | Scope | Evidence |
|-------|-------|----------|
| Detection | Each generic rule, placeholder suppression, hashed entries, case and whitespace variants, length boundaries, synthetic class activation | `tests/checks/privacy-literals.test.ts` |
| Registry validation | Schema, scope, enabled rules, class declarations, entry shape, duplicates, caps, allowlist and exclusion policy | `tests/checks/privacy-registry.test.ts` |
| Scope | History versus working tree, untracked-but-not-ignored files, ignored files, binary skips, exclusions, deterministic ordering | `tests/checks/privacy-scope.test.ts` |
| Reporting | Human and machine output, no content echo, fingerprint stability, read-only and offline behavior | `tests/checks/privacy-reporting.test.ts` |
| Authoring | Record shape, no echo, no writes, CI refusal, no argv or environment channel | `tests/checks/privacy-authoring.test.ts` |
| Performance | Corpus timing, N/2N scaling, pattern-shape lint, emitter budget | `tests/checks/privacy-performance.test.ts` |
| CI wiring | Invocation by name, additions-only workflow, local command, binding test execution | `tests/checks/privacy-ci-wiring.test.ts` |
| Release | Changeset shape, package set, lockfile, dependency integrity | `tests/checks/privacy-release.test.ts` |
| Emitter policy | Field × carrier denial, validation order, totality, clean round-trip, shared-rule parity, human-content exclusion | `tests/behaviour/envelope-content-policy.test.ts`, `tests/types/envelope-policy.type-test.ts`, `tests/structure/envelope-contract.test.ts` |
| Rule-module purity | Shared definition set, zero-import module, inventory registration | `tests/structure/privacy-imports.test.ts`, `tests/structure/content-inventory.test.ts` |
| Existing envelope regression | Parse, strip, carriers, degradation, and write path unchanged | `tests/behaviour/envelope-roundtrip.test.ts`, `envelope-degradation.test.ts`, `envelope-write-path.test.ts` |
| Aggregate | The whole workspace | `pnpm check` |

## Operational & Support

### Configuration

The registry is committed data and the only configuration surface. The production `private-literal` and `cloud-term` classes ship empty with explicit reasons until the owner supplies digests out-of-band. There is no configuration-layer production key and no user-overridable weakening surface in this feature.

### Observability

The scan summary reports scope and vacuity facts; every violation names the rule or entry id, file, line, and fingerprint. Registry failures name the offending field or entry id. No output channel carries content. The authoring mode reports only paste-ready record fields.

### Maintenance

Maintainers own four guarded surfaces: the generic rule set (code and corpus tuning), the registry (data edits with reasons and caps), the allowlist and exclusions (exact paths with reasons), and the required codec policy (purity and call-site discipline). Tightening or adding a rule requires a code change and an enabled-rule registry change in the same pull request, because the enabled set must equal the committed set exactly.

## Dependencies & Risks

- **Depends on** the monorepo scaffold for check conventions, `ts-invariants`, `ts-test`, and the topology, bindingness, supply-chain, and script-surface invariants.
- **Depends on** the envelope contract and codec for the single serialization point that gains the required policy.
- **Depends on** the branding seam for the registry-as-authority and CI-binding precedent.
- **Constrains** every future metadata emitter: serialization requires a policy, and no bypass path exists.
- **Risk — digest guessability:** unsalted digests are offline-verifiable for low-entropy guesses. Accepted and documented; true secrets must never be listed.
- **Risk — empty classes:** the production classes are vacuous until the owner supplies digests. Mitigation: explicit empty reasons, class-level vacuity reporting, and synthetic activation proofs.
- **Risk — unlisted shapes:** a novel secret shape that matches no rule and is not hashed can pass; binary, archive, and encoded content are not inspected.
- **Risk — allowlist erosion:** a broad suppression could hide a real value. Mitigation: exact paths, rule-scoped entries, written reasons, a single directory entry, and fail-closed "matches nothing" validation.
- **Risk — registry weakening:** scope and enabled rules are exact-match validated, caps are fixed in code, and any change is a reviewed data edit.

## Known Limitations

- The production `private-literal` and `cloud-term` classes contain no entries until the owner supplies digests out-of-band; the mechanism is proven non-vacuous by synthetic activation cases.
- Git history is not scanned, and no baseline or retroactive remediation is claimed.
- Binary files are skipped and counted; archive, encoded, and compressed payloads are not decoded or inspected.
- Human-readable comment content is not scanned at the emitter; committed human content is covered by the file scan only.
- File-scan placeholder suppression remains marker-based. A value whose protected segment itself carries a committed fabricated-sample marker (for example, a `test-`-prefixed bearer tail) is treated as fabricated at the file scan; the emitter still denies it.
- No policy engine, policy DSL, rule-authoring UI, salt, key rotation, or configuration-layer policy key exists in this feature; registry placement is revisited with the policy engine.
- `content-policy-violation` has no result-contract error identity yet; projection belongs to the first production emitter.

## Glossary & References

| Term | Definition |
|------|------------|
| Privacy-literal guard | The binding repository invariant that scans committed content for generic secret/private shapes and project-configured hashed literals. |
| Guarded content | A value the guard is designed to detect: a private literal, a secret-shaped value, or a hosted-only term. |
| Generic rule | A committed code definition that recognizes a class of secret-shaped or private-identifier-shaped content by id. |
| Hashed-literal registry | The schema-versioned registry that stores only domain-separated digests, classes, lengths, ids, and reasons for project-configured literals. |
| Hashed literal entry | A registry record of `{ id, class, algorithm, hash, length, reason }`; it never contains the raw literal. |
| `private-literal` | The hashed-entry class for project-private content that must never be committed. |
| `cloud-term` | The hashed-entry class for hosted-product or cloud terms that must never be committed raw. |
| Normalized literal | The literal after trimming and lowercasing, used identically for hashing and candidate-window comparison. |
| Candidate window | A fixed-length span of scanned text, normalized and digested for comparison with a registered length. |
| Content-free fingerprint | A short stable value derived only from a rule or entry id, used in violation output instead of content. |
| Content policy | The injected pure predicate that scans the exact serialized envelope representation and returns allow or a denial id. |
| `content-policy-violation` | The fail-closed codec-local serialization failure produced when the content policy denies a payload. |
| Vacuous class | A declared hashed-entry class with no production entries, carrying an explicit reason and proven activatable by a synthetic test. |
| Working-tree scan | A scan of tracked plus untracked-but-not-ignored files at the current tip, with no history replay. |

See also: [Adapter Ports, Credential Resolution, and Embedded Metadata](feature-adapter-ports.md), [Branding Seam and Working Name](feature-branding-seam.md), [Monorepo Scaffold and Toolchain](feature-monorepo-scaffold-toolchain.md), [Result Contract and Error Table](feature-result-contract.md), the [repository glossary](../../overview/glossary.md), [TDR-0005](../../decisions/TDR-0005-privacy-and-no-cloud-guard-mechanics.md), and [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md).

**Change record:** `doc/changes/2026-10/2026-10-31--GH-184--privacy-and-no-cloud-guards/`.
