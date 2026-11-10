---
id: TDR-0021
decision_type: tdr
status: Proposed
created: 2026-11-09
decision_date: null
last_updated: 2026-11-09
summary: "Add an additive `optional?: boolean` marker to `HarnessEnvironmentVariable` (absent or `false` = required; `true` = omit an absent key and forward a present one), so a legitimately absent allowlisted variable such as `TMPDIR` cannot abort a spawn, while credential entries stay strictly required, every existing `{ name }` entry keeps fail-closed semantics, and no schema version, failure code, token, classifier rule, or error-table row changes."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os harness adapters
decision_scope: repo
review_date: null
classification:
  domains: [architecture, security, tooling]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: high
  uncertainty: low
  blast_radius: team
  recurrence: recurring
governance:
  driver: "@decision-advisor (GH-277 spec OQ-1)"
  decider: "Juliusz Ćwiąkalski (owner; acceptance pending at the GH-277 PR review)"
  contributors:
    - "@spec-writer (chg-GH-277-spec F-3, DM-1/DM-2, DEC-3, OQ-1 framing)"
    - "@decision-advisor (repository analysis and record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Owner (human final acceptance)"
  performers:
    - "@coder (GH-277 delivery)"
  informed:
    - "GH-277 harness default allowlist repair"
    - "M1-S9 typed engine dispatch path on a default installation"
    - "M1-S11 harness ports and delivery adapters"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "Optionality is ever requested for a credential entry: that is a credential-resolution change (NG-5) and needs its own record; it never arrives by widening this marker."
  - "A caller needs to distinguish 'declared but absent' from 'declared and empty': the builder forwards empty strings today, so that distinction would be a new semantics question, not a marker tweak."
  - "A platform-conditional default allowlist (Windows host profile, deferred by GH-277 DEC-6) is proposed: decide the platform dimension deliberately instead of accumulating optional entries."
  - "Any change to the meaning of the marker (per-entry requiredness, tri-state, or a default-optional mode) is a v1-breaking configuration change and must be decided deliberately, not by accretion here."
  - "A second descriptor-construction site or a second adapter needs a different optionality mechanism: revisit the descriptor shape rather than adding a parallel list beside `environment`."
links:
  related_changes: ["GH-277"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/changes/2026-11/2026-11-09--GH-277--harness-default-allowlist/chg-GH-277-spec.md"
    - "doc/spec/features/feature-harness-adapters.md"
    - "doc/spec/features/feature-adapter-ports.md"
  contracts:
    - "packages/core/src/contracts/harness.ts"
    - "packages/core/src/config/harness.ts"
    - "packages/core/src/config/catalog.ts"
    - "packages/core/src/domain/harness-spawn-env.ts"
    - "packages/cli/src/production.ts"
  diagrams: []
  decisions: ["ADR-0008", "TDR-0008", "TDR-0016", "TDR-0003"]
  experiments: []
  metrics: []
  roadmap_items: ["M1-S9", "M1-S11"]
---

# TDR-0021: Additive Optional Marker on Declared Harness Environment Variables

## Context

- **FACT:** The declared variable entry is `{ kind: "variable"; name: string }`, the credential entry is `{ kind: "credential"; name: string; reference: CredentialReference }`, `HarnessEnvironmentEntry` is their union, and the execution-environment descriptor carries `environment: readonly HarnessEnvironmentEntry[]` — there is no required/optional distinction (`packages/core/src/contracts/harness.ts` lines 120–148, read 2026-11-09).
- **FACT:** The deny-by-default builder fails closed on the first declared variable absent from the record and the injected parent, returning `harness.spawn.variable-missing` with the variable name in `field` and no partial environment (`packages/core/src/domain/harness-spawn-env.ts` lines 38–67, read 2026-11-09).
- **FACT:** Configuration validation accepts `name` plus optional `credentialRef`, rejects a literal `value` as `config.secret.forbidden`, and rejects any other key on a variable entry as `config.value.invalid` (`packages/core/src/config/harness.ts` lines 110–145, read 2026-11-09); the catalog's entry field list is `name`, `credentialRef`, `value` (`packages/core/src/config/catalog.ts` lines 276–318, read 2026-11-09).
- **FACT:** The shipped default allowlist declares `HARNESS_MODEL`, `HARNESS_SMALL_MODEL`, and `DELIVERY_WORK_PATH`, so no default entry is optional and the set cannot start the default harness (`packages/core/src/config/defaults.ts` lines 45–63, read 2026-11-09). GH-277 DEC-1 replaces that set with `PATH` and `HOME` required, `TMPDIR` optional, and the existing `DELIVERY_WORK_PATH` injection.
- **FACT:** The delivered evolution rule is explicit and current: "The contract evolves additively within v1, and a decision record governs each adapter-contract change", and "further evolutions stay additive within v1 and remain decision-record governed" (`doc/spec/features/feature-adapter-ports.md` lines 98 and 329, read 2026-11-09). TDR-0008 states the rule and is itself the record for the prior round; TDR-0016 applies it to this exact file, recording that "GH-275 adds types to `packages/core/src/contracts/harness.ts`, which is the class that rule covers, so a record is required" (`doc/decisions/TDR-0016-harness-streaming-spawn-seam.md` line 85).
- **FACT:** TDR-0008's no-record scope note covers an item that "adds no contract element" (GH-183 OQ-2, a scope boundary). This change does add a contract element — one optional field on a contract type — so that note does not reach it.
- **FACT:** GH-277 requires the marker (F-3, DM-1/DM-2, DEC-3) and routes the governance question here as OQ-1, offering "a short TDR or an explicit owner waiver" (`chg-GH-277-spec.md` §13, §14).
- **FACT:** The harness port family, including `HarnessExecutionEnvironmentDescriptor`, is part of the adapter-era contract substrate governed by that rule (`doc/spec/features/feature-adapter-ports.md` line 56).
- **Scope note:** GH-277 DEC-4's additive `data.error.detail` is a command-envelope field in the result-contract surface; it adds no adapter-contract element and no error-table identity, so the adapter-contract rule does not reach it. This record decides the environment marker only and neither decides nor depends on DEC-4.

## Problem Framing (Clarified)

The defect is not "a variable is missing"; it is that **the declaration language cannot say which absences are legitimate**. Every declared variable currently means "must be present", which is the correct default for `PATH`, `HOME`, and `DELIVERY_WORK_PATH`, and the wrong default for `TMPDIR`, which is legitimately unset on Linux. A fail-closed builder can only be told the difference if the declaration carries it.

That produces three sub-problems that must be answered together:

1. **Where optionality is declared.** Optionality is a property of a declaration, not of a platform and not of the builder's policy. Encoding it in a platform-aware default provider or in a builder switch would move the decision away from the declaration that owns it, and would make the resolved configuration host-dependent.
2. **What optionality must never touch.** A credential reference has no "absent" case to tolerate: an unresolved reference is either a configuration error or a secret that must not be silently skipped. Optionality therefore cannot be a property of the entry in general; it must be a property of the *variable* entry.
3. **What additive means here.** The delivered entry shape `{ name }` already means "required". Making absence universally tolerable would be additive in syntax but breaking in meaning, and would remove the fail-closed guarantee every existing configuration relies on.

The governance question follows from the substrate, not from preference: the rule says a decision record governs each adapter-contract change, adding a field to `packages/core/src/contracts/harness.ts` is exactly that class (TDR-0016 applied it to this file), and the rule states no size threshold and no waiver mechanism. **A standalone record is therefore required, and this TDR is that record.** The change decision log's DEC-3 remains the in-change rationale; it is not a waiver of the rule, because the rule provides none.

## Constraints (Hard Requirements)

> **Table stakes:** every alternative keeps the injected-parent-environment boundary, credential resolution through `CredentialPort`, the record-precedence rule, the generated-schema discipline, and the single host child-process site unchanged — acknowledged once rather than per alternative.

| ID | Pass/fail requirement | Source | Verification | Negotiable |
|---|---|---|---|---|
| C-1 | Additive within v1 **in form and in meaning**: no delivered field is removed, retyped, or made required; no existing entry's delivered semantics change (an entry without the marker stays required); no schema-version bump; no second optionality mechanism beside `environment`. | Prior decision (TDR-0008; ADR-0004/ADR-0006; feature-adapter-ports evolution discipline) | Contract/field-shape probes, `pnpm typecheck`, config-resolution tests | no |
| C-2 | Contracts-tier neutrality: the change is type shape only in `core ./contracts` — no behavior, clock, I/O, ambient environment, or platform read enters that module. | ADR-0003 DEC-2; feature-harness-adapters §2 | `tests/structure/port-neutrality.test.ts`, `tests/structure/harness-neutrality.test.ts`, review | no |
| C-3 | Deny-by-default preserved: the child environment is exactly the declared and present entries plus resolved credentials; every undeclared parent variable is absent; no ambient read is added in core, the builder, or the composition. | GH-277 F-4, NFR-3, AC-F4-1; `feature-harness-adapters` §1 | Ambient-leak canary; boundary and secret-read invariants | no |
| C-4 | Required absence still fails closed: `harness.spawn.variable-missing`, the variable name in `field`, no partial environment, no child spawn. | GH-277 F-3, AC-F3-1, NFR-2; delivered builder behaviour | Builder behaviour tests; field assertion | no |
| C-5 | Credentials stay strictly required: the marker is valid only on a variable entry; a credential entry carrying it is `config.value.invalid`; an unresolved reference still fails `config.credential.missing`; no optional credentials; a literal `value` remains `config.secret.forbidden`. | GH-277 F-3, F-6, AC-F3-4, AC-F3-5, NG-5; delivered credential-port boundary | Config-classification tests; builder credential-path tests | no |
| C-6 | Vocabulary stability: no new failure code, delivery-result token, classifier rule, or error-table row; the existing `config.value.invalid`, `config.secret.forbidden`, `harness.spawn.variable-missing`, and `config.credential.missing` identities are reused. | GH-277 NFR-4, AC-F5-4; TDR-0010 closed-token floor | Error-table equality probes; classifier conformance | no |
| C-7 | Compatibility and parity: an existing `{ name }` entry needs no edit and keeps its resolved meaning; the generated schema, defaults-position manifest, and source hashes regenerate and pass parity. | GH-277 §8.5, AC-F6-1, AC-F6-2, NFR-8 | Backwards-compatibility test; `pnpm` schema/default parity checks | no |
| C-8 | The change's acceptance criteria become satisfiable: the default declares exactly `TMPDIR` optional (AC-F1-3), an absent optional variable is omitted while a present one is forwarded (AC-F3-2/AC-F3-3), and invalid marker shapes are classified rather than silently accepted (AC-F3-5). | GH-277 AC | Behaviour suite on the default and on explicit entries | no |

## Decision Drivers

1. **Legitimate absence must not abort a spawn (the defect).** A platform variable that is normally unset must be expressible as "may be absent" without deleting it from the allowlist.
2. **Fail-closed discipline retained (security).** Optionality must be an explicit opt-in per declaration; it must never become the entry default, and it must never reach a credential.
3. **Every existing configuration keeps its meaning (compatibility).** `{ name }` must keep failing closed, with no migration and no silent relaxation of a security-relevant guarantee.
4. **Minimal additive surface (paved road).** One boolean on one entry form, following the additive-within-v1 precedent already traversed four times (ADR-0004, ADR-0006, TDR-0008, TDR-0016).
5. **One mental model (cognitive load).** "Absent marker = required" is one rule a reader can hold; a second entry kind, a second list, or a platform-conditional default adds a second axis of reasoning to every allowlist.
6. **Deterministic testability.** Required vs optional and present vs absent must be assertable offline with no real CLI and no host-dependent input.
7. **Solo-maintainer cost.** One contract field, one config key, one builder branch, no new vocabulary, no migration, no new generated artifact kind.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-277 spec OQ-1 delegates this call).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at GH-277 PR review. AI does not accept this R2 record.
- **Contributors:** `@spec-writer` (F-3, DM-1/DM-2, DEC-3, OQ-1 framing); `@decision-advisor` (repository analysis and record).
- **Required reviewers:** `@readiness-reviewer` and `@reviewer` on GH-277; the owner for final acceptance of this record.
- **Performers:** `@coder` (contract field, config key and validation, builder projection, composition mapping, defaults, tests).
- **Informed:** GH-277, the M1-S9 typed dispatch path, and M1-S11 harness ports.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The variable entry has no required/optional distinction today. | FACT | `packages/core/src/contracts/harness.ts` 120–148 (read 2026-11-09) | The marker would be redundant; the decision is void. | High |
| The builder fails closed on every absent declared variable and returns no partial environment. | FACT | `packages/core/src/domain/harness-spawn-env.ts` 38–67 (read 2026-11-09) | Optional absence could already be tolerated; no contract change needed. | High |
| Config validation currently rejects any key other than `name` on a variable entry and any literal `value`. | FACT | `packages/core/src/config/harness.ts` 110–145; `catalog.ts` 276–318 (read 2026-11-09) | The new key would already be accepted; the classification work shrinks but the contract decision stands. | High |
| The evolution rule is current, explicit, and record-governed, with TDR-0016 applied to this exact file. | FACT | `doc/spec/features/feature-adapter-ports.md` 98, 329; TDR-0016 line 85 (read 2026-11-09) | The governance answer could be "no record". It is not: the rule states no size threshold and no waiver mechanism. | High |
| The harness environment descriptor is part of the adapter-contract substrate. | FACT | `doc/spec/features/feature-adapter-ports.md` line 56 | If it were not, the adapter rule would not reach this change; the general record-worthiness bar (precedent-setting, cross-component) would still apply. | High |
| `TMPDIR` is legitimately absent on Linux and present on many macOS shells, and is not required by the harness to boot. | FACT (POSIX behaviour) / ASSUMPTION (harness tolerance) | GH-277 §2.1, §12; OQ-2 evidence pending | If the harness genuinely needs a temporary directory, `TMPDIR` becomes required and the marker loses its first consumer — the contract decision would then be premature. | Medium-High |
| No shipped default entry other than `TMPDIR` is optional. | ASSUMPTION | GH-277 §12, §7.3 | A second optional default entry would need its own justification under §22 of the spec. | High |
| No consumer outside the spawn path reads the entry shape. | ASSUMPTION | Repository search; `packages/cli/src/production.ts` mapping | An undiscovered consumer would need a compile-time update; the additive field is producer-compatible so the blast radius stays small. | Medium-High |
| The marker's documented naming (`optional`) matches the spec's language and can be carried verbatim into config and descriptor. | ASSUMPTION | GH-277 DM-1/DM-2 wording | A rename would be a naming decision made inside the change, not a reopening of this record's semantics. | High |

## Mental Models & Techniques Used

- **First principles:** What must a declaration assert? Which names may reach the child, and which of those must exist. Presence-only is one bit short of what the declaration needs; the marker supplies exactly the missing bit.
- **Inversion:** What would make optionality unsafe? Optional credentials (a resolution failure becomes a silent skip), optional-by-default entries (a fail-closed guarantee disappears without a version boundary), a second declaration surface (two lists can disagree), and platform-conditional defaults (the resolved configuration stops being reproducible from the file). Each is excluded by C-1, C-3, and C-5.
- **Second-order thinking:** The marker becomes the supported way to declare a legitimately absent entry (GH-277 §22), so it will be reused. Fixing the semantics now — explicit opt-in, variable-only, absent means required — is cheaper than re-litigating optionality per future entry.
- **Least privilege / minimal surface:** One optional boolean on one entry form; no new kind, no new list, no new failure identity, no new config branch.
- **Paved road:** Additive-within-v1, record-governed is the substrate's declared path, executed four times (ADR-0004, ADR-0006, TDR-0008, TDR-0016). This record extends that precedent rather than inventing a fifth mechanism.
- **KISS / cognitive load:** "No marker means required" is one sentence. A second entry kind or a second allowlist makes every reader check two things before knowing whether a missing variable is fatal.
- **Reversibility:** The field is removable while the shipped default is its only producer, and no persisted state, schema version, or migration is involved.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (requires `Negotiable: yes`; C-1…C-8 are all `no`, so ⚠️ is diagnostic only and never rescues an alternative).

| | C-1 additive meaning | C-2 neutrality | C-3 deny-by-default | C-4 required fails closed | C-5 credentials strict | C-6 vocabulary | C-7 compat/parity | C-8 AC satisfiable |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 no marker (required-only) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ALT-1 optional-by-default for every variable entry | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| ALT-2 platform-conditional defaults, contract unchanged | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| ALT-3 separate `optionalEnvironment` list | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-4 new `kind: "optional-variable"` entry member | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-5 additive `optional?: boolean` on the variable entry (chosen) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

C-2 and C-3 are table stakes across every alternative; they are retained as explicit rows because they are the tier and security gates this record must attest.

### Alternative 0 — Do Nothing / Keep Every Declared Entry Required

- **Eligibility:** Not eligible (fails C-8).
- **Summary:** Keep the contract unchanged; either leave `TMPDIR` out of the shipped default or declare it required and accept that a Linux parent without `TMPDIR` fails the spawn.
- **Constraint compliance:** Passes C-1…C-7 trivially by changing nothing; fails C-8 — AC-F1-3 requires exactly one optional entry (`TMPDIR`), and AC-F3-2/AC-F3-3 require an absent optional variable to be omitted and a present one forwarded.
- **Driver fit:** Fails driver 1 outright (legitimate absence still aborts the spawn); every other driver is moot because the change delivers nothing.
- **Pros:** Zero contract change; zero ripple.
- **Cons:** The GH-277 repair either ships an unviable default on Linux or ships a contract that cannot express the case the ticket names; the next platform variable re-opens the same question.
- **Why rejected:** It fails the change's own acceptance criteria and leaves the declaration language one bit short.

### Alternative 1 — Optional by Default for Every Variable Entry

- **Eligibility:** Not eligible (fails C-1, C-4, C-7).
- **Summary:** Change the builder so an absent declared variable is always omitted and the build continues; requiredness disappears.
- **Constraint compliance:** Fails C-4 (no declared variable can be required, so `harness.spawn.variable-missing` becomes unreachable and AC-F3-1/NFR-2 fail); fails C-1 and C-7 (an existing `{ name }` entry silently changes from fail-closed to tolerant — additive in syntax, breaking in meaning, with no version boundary).
- **Driver fit:** Serves driver 1 only by deleting driver 2; destroys the security posture that makes the allowlist trustworthy.
- **Pros:** No new field; the builder branch is simpler.
- **Cons:** A missing `PATH`, `HOME`, or `DELIVERY_WORK_PATH` becomes a silent omission, so the failure moves downstream into an opaque harness failure — the exact diagnosis problem GH-277 repairs.
- **Why rejected:** It trades a loud, named failure for a silent one and weakens a delivered security guarantee without a deliberate version change.

### Alternative 2 — Platform-Conditional Defaults, Contract Unchanged

- **Eligibility:** Not eligible (fails C-8).
- **Summary:** Keep the entry shape required-only; have the default provider emit `TMPDIR` only on hosts where it is expected to exist (or omit it everywhere).
- **Constraint compliance:** Passes C-1…C-7; fails C-8 — the shipped default would no longer be one declared set, AC-F1-3's exact optional entry cannot be asserted, and the resolved configuration becomes host-dependent (a determinism cost the defaults-position and parity checks are built to prevent).
- **Driver fit:** Fails driver 6 (not deterministically assertable from the file) and driver 5 (a second, implicit platform axis).
- **Pros:** No contract field; no config key.
- **Cons:** Host-dependent defaults; the platform dimension is exactly what GH-277 §7.3 and NG-6 defer, so this option smuggles it in; a user cannot express the same tolerance for their own entry.
- **Why rejected:** It solves one platform's case by making defaults non-reproducible, and it gives no answer for any other legitimately absent variable.

### Alternative 3 — A Separate `optionalEnvironment` List Beside `environment`

- **Eligibility:** Not eligible (fails C-1).
- **Summary:** Keep `environment` required-only and add a second declared list of names whose absence is tolerated.
- **Constraint compliance:** Fails C-1 — a second optionality mechanism beside `environment` is a parallel surface: the same name can appear in both lists with no defined precedence, and "which list wins" becomes a rule every reader must learn.
- **Driver fit:** Fails driver 4 (surface growth) and driver 5 (two lists to reason about).
- **Pros:** Existing entry shape untouched.
- **Cons:** Duplicate/conflicting declarations; ordering and precedence rules to specify and test; two config keys where one boolean suffices.
- **Why rejected:** It is the parallel-surface failure the substrate forbids, bought for no semantic gain over a field.

### Alternative 4 — A New `kind: "optional-variable"` Entry Member

- **Eligibility:** Eligible.
- **Summary:** Widen the closed `HarnessEnvironmentEntry` union with a third member `{ kind: "optional-variable"; name }` that behaves like the variable form but tolerates absence.
- **Constraint compliance:** Passes C-1…C-8 (additive union member, type-only, deny-by-default preserved, required absence still fails closed, credentials untouched, no new identifiers, existing entries unchanged, AC satisfiable).
- **Driver fit:** Weaker than ALT-5 on drivers 4, 5, and 7 — it widens a closed union (every exhaustive consumer gains a branch), and it creates two ways to declare a variable, so a reader must inspect `kind` before knowing whether absence is fatal.
- **Pros:** No boolean whose `false` value duplicates the default; the intent is visible in the discriminant.
- **Cons:** Compile-time ripple into exhaustive switches; a name could be declared under both kinds with no defined meaning; more surface than the semantics require.
- **Why rejected:** It is eligible but strictly heavier: the same expressive power costs a union member, an exhaustiveness ripple, and a duplicate-name question.

### Alternative 5 — Additive `optional?: boolean` on the Variable Entry (chosen)

- **Eligibility:** Eligible.
- **Summary:** Add `readonly optional?: boolean` to `HarnessEnvironmentVariable` and the equivalent `optional` key to the configuration entry. Absent or `false` means required — exactly today's behaviour; `true` means an absent key is omitted and a present key forwarded. `HarnessEnvironmentCredential` is unchanged, and a configuration entry combining `optional` with `credentialRef` is `config.value.invalid`.
- **Constraint compliance:** Passes C-1…C-8 (matrix above). The change is one optional field in the contracts tier (C-1, C-2); the builder still reads only the descriptor plus the injected parent and record (C-3); required absence is the unchanged path (C-4); the credential form is untouched and the invalid combination is classified (C-5); every failure identity is reused (C-6); `{ name }` keeps its meaning and the generated artifacts are regenerate-and-parity only (C-7); and the ACs become satisfiable (C-8).
- **Driver fit:** Best on every driver: the smallest possible surface (4), one mental model (5), explicit opt-in (2), no migration (3), assertable as a four-case table (6), and one field plus one key (7).
- **Pros:** One boolean; no new union member, no second list, no platform branching; requiredness remains the default and the marker is variable-only by construction; `false` is an explicit way to state the default for readers who prefer it.
- **Cons:** `false` and absence encode the same thing (an intentional redundancy accepted because configuration files are read by humans); the marker is one more key to validate and one more mapping to keep aligned between config and descriptor.
- **Why chosen:** It is the only eligible option that expresses the missing bit without a new mechanism, and it keeps every delivered guarantee intact.

## Decision

- **Decision:** Adopt **ALT-5**. Add an additive optional marker to a declared harness environment *variable* entry:
  1. **Contract shape:** `HarnessEnvironmentVariable` gains `readonly optional?: boolean`. `HarnessEnvironmentCredential` is unchanged, and `HarnessEnvironmentEntry` keeps its two delivered members. The addition is type-only in `core ./contracts`.
  2. **Semantics:** absent or `false` = required (today's behaviour); `true` = optional. An absent required entry fails with `harness.spawn.variable-missing`, names the variable in `field`, returns no partial environment, and spawns no child. An absent optional entry omits the key and the build continues. A present optional entry is forwarded with the record value taking precedence over the injected parent value, exactly as for a required entry. Every undeclared parent variable stays absent.
  3. **Credential strictness:** the marker applies only to the variable form. A configuration entry that combines `optional` with `credentialRef` is `config.value.invalid`; a credential entry without a valid reference still fails closed with `config.credential.missing`; the marker can never make a credential optional or a literal `value` acceptable.
  4. **Configuration shape:** the variable entry accepts `name` plus optional `optional: boolean`. A non-boolean marker, a marker combined with `credentialRef`, and any still-unknown key are `config.value.invalid`; `value` remains `config.secret.forbidden`. The catalog entry, the generated schema, the defaults-position manifest, and the source hashes are regenerated and parity-checked; no schema version changes.
  5. **Marker spelling:** `optional`, not `required`. The additive default must be "no change", so the new key exists only to opt into the new behaviour; a `required` key would make the default depend on a key's absence and would read as a behaviour change to every existing entry.
  6. **No schema bump, no migration:** the contracts tier is types plus `as const` data, no persisted state carries the entry shape, and existing configuration resolves unchanged.
  7. **Shipped default (reference only, decided in GH-277 DEC-1):** `PATH`, `HOME`, and `DELIVERY_WORK_PATH` required; `TMPDIR` optional. This record fixes the mechanism, not which entries use it.
- **Rationale (tied to drivers):** The declaration language lacked one bit — whether an absence is legitimate — and the builder was correctly strict about the bits it had (drivers 1, 2). An explicit variable-only marker restores that bit without touching credential behaviour or the fail-closed default (drivers 2, 3), and it does so with the smallest surface that expresses the semantics, which is also the surface a reader can hold in one sentence (drivers 4, 5, 7). Because the semantics are per-entry and offline, the four required/optional × present/absent cases are directly assertable in the behaviour suite (driver 6).
- **Governance resolution (GH-277 OQ-1):** A standalone record is required under the delivered rule — "a decision record governs each adapter-contract change", with TDR-0016 applying it to additions in `packages/core/src/contracts/harness.ts`. The rule states no size threshold and no waiver mechanism, so an entry in the change decision log cannot discharge it; this TDR is the record, and GH-277 DEC-3 is its in-change rationale. Authoring this record does not re-open DEC-3's design, which it adopts.
- **Decider:** Juliusz Ćwiąkalski (owner).
- **Authorization:** Status `Proposed`. Human acceptance is recorded at the GH-277 PR review; AI does not accept this R2 record and grants no authority until then. On acceptance, `decision_date` is set and a `review_date` is fixed for the first post-implementation retrospective.
- **Conditions for revisit:** See `revisit_triggers`; the first GH-277 post-implementation retrospective confirms that required absence still names the field and that no consumer treats absence of the marker as optional.

### Constraint Compliance Attestation

The chosen alternative (ALT-5) satisfies every constraint C-1 through C-8. No accepted-risk exceptions are taken and no constraint is violated.

| Constraint | Attestation |
|---|---|
| C-1 | One optional field is added to `HarnessEnvironmentVariable`; no field is removed, retyped, or made required, no existing entry's meaning changes, no schema version moves, and no second optionality mechanism is introduced. |
| C-2 | The contracts change is a `type` declaration only; the validation, the projection, and the defaults live in the config/domain/composition tiers, so `core ./contracts` stays type-only. |
| C-3 | The builder still iterates the descriptor and reads only the injected parent and validated record; the optional branch omits a key rather than consulting anything new. |
| C-4 | The required branch is the delivered code path: it returns `harness.spawn.variable-missing` with the name in `field` and no partial environment. |
| C-5 | The credential branch is untouched; the marker is rejected on a credential entry at validation, and unresolved references keep `config.credential.missing`. |
| C-6 | No identifier is added to any closed vocabulary; every classification reuses `config.value.invalid`, `config.secret.forbidden`, `harness.spawn.variable-missing`, or `config.credential.missing`. |
| C-7 | `{ name }` resolves to required; the schema, defaults manifest, and source hashes are regenerated and parity-checked rather than migrated. |
| C-8 | AC-F1-3, AC-F3-2, AC-F3-3, AC-F3-5, and AC-F6-2 are directly satisfiable with this shape. |

## Trade-offs & Consequences

### Positive Outcomes

- The allowlist can declare a legitimately absent variable, so `TMPDIR` joins the default without making a Linux spawn fail.
- Fail-closed behaviour stays the default and the required-absence failure stays loud, named, and pre-spawn.
- Credentials are untouched by construction: optionality cannot become a resolution bypass.
- One boolean and one config key instead of a new entry kind, a second list, or platform-conditional defaults.
- The marker becomes the supported, documented way to add a future conditionally-present variable, so the question is decided once.

### Negative Outcomes

- `optional: false` and an absent marker mean the same thing; the redundancy is accepted for human readability but it is a second spelling of one state.
- The config validation gains a combination rule (marker + `credentialRef` is invalid) that must stay tested; a future refactor that loosens unknown-key handling would silently relax it.
- The marker widens the entry shape that every future consumer of the descriptor must understand, even consumers that only construct required entries.
- Optionality is a per-entry policy: a user who wants "tolerate all absences" cannot express it, which is intentional and must be explained operationally.

### Unresolved Questions

- [ ] Whether the harness genuinely boots with `TMPDIR` absent on the supported POSIX profile; the bounded real dispatch proof (GH-277 AC-F8-1, OQ-2) is the evidence source, and a contrary result makes `TMPDIR` required rather than optional (owner: `@coder`, GH-277 delivery).
- [ ] Whether any further boot variable discovered by that proof is legitimately absent (optional) or universally required (owner: `@coder`/owner, GH-277 delivery; spec §18 already routes this decision).
- [ ] Whether an operator-facing "tolerate all absences" mode is ever justified; explicitly out of scope here and a policy decision, not a contract extension (owner: future named need).

## Implementation Plan

1. **Contracts:** add `readonly optional?: boolean` to `HarnessEnvironmentVariable` in `packages/core/src/contracts/harness.ts`; leave `HarnessEnvironmentCredential`, `HarnessEnvironmentEntry`, the descriptor, the session port, and every closed vocabulary untouched.
2. **Configuration:** add the optional marker to `HarnessEnvironmentSetting`'s variable form and to `HARNESS_ENVIRONMENT_ENTRY` in `packages/core/src/config/catalog.ts`; in `packages/core/src/config/harness.ts` accept `optional` only as a boolean on a variable entry, classify a non-boolean, a marker combined with `credentialRef`, and any still-unknown key as `config.value.invalid`, and keep `value` as `config.secret.forbidden`.
3. **Generated artifacts:** regenerate the configuration schema, the defaults-position manifest, and the source hashes; keep every parity check green and bump no schema version.
4. **Builder:** in `packages/core/src/domain/harness-spawn-env.ts`, treat `entry.optional === true` as "omit when absent"; keep the delivered required path and the record-over-parent precedence; leave the credential branch unchanged.
5. **Composition and defaults:** map the marker verbatim onto the descriptor in `packages/cli/src/production.ts`, keep the `DELIVERY_WORK_PATH` record injection and the bare `opencode` command, and ship `PATH`/`HOME`/`DELIVERY_WORK_PATH` required with `TMPDIR` optional (GH-277 DEC-1).
6. **Tests:** pin the four required/optional × present/absent cases, the required-absence field name and no-spawn guarantee, the invalid marker combinations, the credential-marker rejection, the unchanged `{ name }` behaviour, the ambient-leak canary, and the exact shipped default shape.
7. **Docs:** the phase-7 system-spec update reconciles the descriptor entry table in `doc/spec/features/feature-harness-adapters.md` and the `harness.environment` entry shape and default table in the configuration-layer spec, and notes the marker as the supported way to declare a conditionally-present entry.

## Verification Criteria

- Metric: contract probe — `HarnessEnvironmentVariable` carries exactly one additive optional boolean, `HarnessEnvironmentCredential` is byte-identical, and no contracts-tier behavior appears. Target: exact shape. Window: GH-277 CI.
- Metric: configuration classification — non-boolean marker, marker with `credentialRef`, and unknown key each classify `config.value.invalid`; literal `value` classifies `config.secret.forbidden`. Target: 100% of cases. Window: GH-277 CI.
- Metric: builder semantics — absent required → `harness.spawn.variable-missing` with the name in `field`, no partial environment, no spawn; absent optional → key omitted, build succeeds; present optional → forwarded, record wins over parent. Target: 100% of the four cases. Window: GH-277 CI.
- Metric: deny-by-default — zero undeclared parent variables present in the child across the test matrix. Target: 0. Window: GH-277 CI.
- Metric: compatibility — an entry written `{ name: "X" }` resolves to required with no edit, and the regenerated schema/defaults artifacts pass parity. Target: 100%. Window: GH-277 CI.
- Metric: shipped default shape — required `PATH`, `HOME`, `DELIVERY_WORK_PATH`; optional `TMPDIR`; no model variable. Target: exact set equality. Window: GH-277 CI.
- Metric: vocabulary stability — no new failure code, token, classifier rule, or error-table row. Target: exact set equality. Window: GH-277 CI.

## Confidence Rating

**High** for the shape, the semantics, and the governance answer: the contract and builder gaps are verified in delivered source, the evolution rule is stated in the current spec, TDR-0016 applies that rule to this exact file, and four prior additive rounds establish the pattern.

**Medium-High** for `TMPDIR` being the right first optional entry: its legitimate absence is a POSIX fact, while the harness's tolerance of its absence is proven by the bounded real dispatch in GH-277 rather than by source. A contrary result changes which entries use the marker, not whether the marker should exist — although if no entry were optional, the marker would be premature, which is the one outcome that would send this record back.

## References

- GH-277 change spec (F-1…F-8, §8.3 DM-1/DM-2, §8.5, §12, §13, §14 OQ-1/OQ-2, §15 DEC-1/DEC-3, §18, §22, AC-F1/AC-F3/AC-F6/AC-F8): `doc/changes/2026-11/2026-11-09--GH-277--harness-default-allowlist/chg-GH-277-spec.md`
- Current system spec (harness environment descriptor, deny-by-default spawn narrative): `doc/spec/features/feature-harness-adapters.md`
- Current system spec (adapter-contract evolution rule): `doc/spec/features/feature-adapter-ports.md`
- Delivered contracts and seams: `packages/core/src/contracts/harness.ts`, `packages/core/src/config/harness.ts`, `packages/core/src/config/catalog.ts`, `packages/core/src/domain/harness-spawn-env.ts`, `packages/cli/src/production.ts`
- [ADR-0008](ADR-0008-harness-adapter-contract.md) — harness adapter contract; engine neutrality and capability gaps
- [TDR-0008](TDR-0008-additive-adapter-contract-extensions-closeout-v1.md) — additive-within-v1, record-governed adapter-contract evolution
- [TDR-0016](TDR-0016-harness-streaming-spawn-seam.md) — prior additive extension in the same contract module; applies the record-governed rule to it
- [ADR-0004](ADR-0004-workitem-activity-timestamp-additive-v1.md) / [ADR-0006](ADR-0006-workitem-custom-fields-and-comment-omission-representation.md) — additive optional-field precedent with absence semantics
- [TDR-0003](TDR-0003-config-parser-schema-and-acquisition.md) — configuration parsing, schema, and acquisition mechanics
