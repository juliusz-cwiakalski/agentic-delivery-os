---
id: TDR-0058
decision_type: tdr
status: Proposed
created: 2026-11-19
decision_date: null
last_updated: 2026-11-19
summary: "GH-350: `provider simulate --fixture <path>` is one composed invocation over the delivered pure engine, not a second evaluator. The fixture is a strict, versioned JSON document (`delivery.provider.simulate.v1`) declaring the clock instant, optional chain/profile selection, credential outcomes (resolved|missing|rejected — never a value), per-entry quota transport results, spend points, and an optional zone-offset table; unknown keys refuse. `data` is the delivered `resolve` payload in its delivered key order plus one additive `simulation` block (fixture path, schema version, now, stateWrites: 0, consumed inputs, bounded decision summary); no textual diff is produced because a diff needs an undefined baseline — equivalence with `resolve` is proven by a parity test instead. Zero state writes, zero credential resolution, zero network, zero spawn; fixture defects reuse input.value.rejected, decision failures reuse the delivered provider identities, and no new error row is added."
owners: ["Juliusz Ćwiąkalski"]
service: "delivery-os provider policy: offline simulation surface"
decision_scope: repo
review_date: null
business_impact: "GH-350's verification bar — 'policy simulation reproduces documented routing including parking' — becomes an executable, hermetic command instead of a hand-checked claim, which is what lets the flip evidence be trusted."
customer_impact: "An operator replays peak, quota, budget, and outage scenarios offline against a fixture, sees exactly the decision `resolve` would produce, and can diff two fixtures by comparing machine payloads — with a written guarantee that nothing was written, fetched, or spawned."
classification:
  domains: [contracts, tooling, operations]
  archetype: design
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: team
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-350 clarify_scope: `provider simulate` invocation and input contract)"
  decider: "Juliusz Ćwiąkalski — human acceptance at the GH-350 PR review; AI does not accept this R2 record"
  contributors:
    - "@pm (GH-350 clarify-scope: simulate absent; flip-plan F2 verification bar)"
    - "@spec-writer (GH-350 specification: fixture schema and payload shapes)"
    - "@decision-advisor (repository analysis and this record)"
  reviewers:
    - "@readiness-reviewer"
    - "@reviewer"
    - "Human owner (GH-350 PR review)"
  performers:
    - "@spec-writer (fixture schema, payload, refusals)"
    - "@test-plan-writer (parity and determinism oracles)"
    - "@coder (composition, fixture reader, CLI grammar)"
    - "@doc-syncer (provider-engine and command reference)"
  informed:
    - "Flip F2/F6 evidence owners"
    - "Operators authoring fixtures"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: true
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A fixture needs to express a seam the engine does not have (for example a provider-reported reset without a percentage): extend the fixture schema version, never overload an existing field."
  - "Operators ask for a diff against a second fixture: that is a new read/compare contract with its own semantics; decide it as an additive flag, not by making the default output a diff."
  - "Simulation and `resolve` ever disagree for identical facts: the parity test is the defect detector; fix the composition, never the fixture."
  - "A fixture is used as a production input (a real spawn reading a fixture): refuse and reopen the boundary — simulate must never become a policy source."
links:
  related_changes: ["GH-350"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-provider-engine.md"
    - "doc/spec/features/feature-provider-profiles.md"
  contracts:
    - "packages/core/src/contracts/provider.ts"
    - "packages/core/src/provider/engine.ts"
    - "packages/cli/src/commands/provider.ts"
  decisions: ["ADR-0007", "TDR-0031", "TDR-0038", "TDR-0057"]
  roadmap_items: ["M4-S4"]
---

# TDR-0058: `provider simulate` — One Strict Fixture, the Real Pure Engine, and a Zero-Write Guarantee

## Context

- **FACT:** The ticket requires "policy simulation (`provider simulate`) for offline verification", and the flip plan's F2 verification bar is "policy simulation reproduces documented routing; a delivery runs with the hook and profiles disabled".
- **FACT:** The engine is already pure over injected seams: `createProviderEngine({ clock, credentialPort, transport, sleep, stateStore?, newFenceToken? })` exposes `resolve`, `quota`, and `parks`, and `resolve` takes `{ config, chainName?, persist? }`. Tests already drive the engine with fakes; no production surface lets an operator do the same.
- **FACT:** `provider resolve` is a mutating command: it persists park generations and announcements when a state store is injected. Its `data` carries `summary`, `chain`, `decision`, `skipped`, `parks`, and `announcements`.
- **FACT:** The provider family's grammar is a small positional/flag parser in `packages/cli/src/commands/provider.ts` (`resolve`, `quota`, `parks list`, `profile resolve`, `watch status`), and invalid grammar refuses before any read, probe, credential resolution, or state write.
- **FACT:** A simulation that reimplemented routing would be a second source of truth and would drift; a simulation that executed a real transport or credential read would not be offline.
- **Why now:** GH-350 cannot claim "simulated quota/peak states produce the documented routing" without a surface that produces it, and the flip's evidence window depends on replays.

## Problem Framing (Clarified)

The requirement is an **offline replay of the real decision function**. That decomposes into:

1. **Facts in.** The invocation must be able to state: the instant, which chain/profile, which credential outcomes, what each quota endpoint answered, what spend exists, and what zone offsets apply — without a network, a real credential, or a real clock.
2. **Same evaluator.** The replay must call the delivered pure engine, so any drift is a defect in one place.
3. **Nothing out.** No state write, no spawn, no fetch, no credential resolution, no ambient read that would make the run non-reproducible on another host.
4. **A stable machine shape.** Automation compares runs; the payload must be the same shape the real command produces, with the simulation facts disclosed beside it.

The tension is between **fixture expressiveness** (it must express enough to reproduce a documented routing) and **fixture authority** (it must never become a policy source or a second config format). The resolution is a strict versioned schema that declares *facts only* — never policy — and a command that refuses unknown fields.

## Constraints (Hard Requirements)

### C-1: One evaluator, no second implementation

- **Statement:** Simulation calls the delivered pure engine (`createProviderEngine` / `resolve`) with fixture-supplied seams; no routing, condition, park, or announcement logic exists in the simulate path.
- **Source:** internal standard (one truth); TDR-0031 (engine-first evaluation surfaces)
- **Verification:** structure test (the simulate module imports the engine and contains no condition arithmetic) + a parity test that feeds identical facts through `resolve` and `simulate` and compares decisions byte-for-byte
- **Negotiable:** no

### C-2: Zero writes, zero network, zero credential resolution, zero spawns

- **Statement:** `provider simulate` performs no state append, no fence, no derived-document replace, no network call, no credential-port invocation, and no child process; `stateWrites: 0` is disclosed on the payload.
- **Source:** AC (ticket: offline verification; no credential values); provider-family "no path sleeps or spawns" rule
- **Verification:** byte-snapshot of the state root before/after; an injected credential port that fails the test if called; a transport that fails if called; no child-process import in the module
- **Negotiable:** no

### C-3: Determinism

- **Statement:** Identical fixture bytes and command invocation produce byte-identical machine and human output, including park identities and announcement identities; no ambient clock, environment, locale, or network input participates.
- **Source:** provider-engine NFR determinism
- **Verification:** paired-run byte equality + shuffle-invariance over fixture key order (canonicalised before evaluation)
- **Negotiable:** no

### C-4: Strict, versioned fixture; unknown keys refuse

- **Statement:** The fixture declares `schemaVersion: "delivery.provider.simulate.v1"`; every recognised key has a declared type; an unknown key, a missing required key, a wrong type, an unsupported version, or an oversized document refuses with `input.value.rejected` before any evaluation. A fixture never contains a credential value.
- **Source:** internal standard (fail-closed validation; no secret in any input); config-layer strictness precedent
- **Verification:** fixture-refusal matrix (unknown key, bad version, oversize, wrong type, credential-shaped value field) + canary scan
- **Negotiable:** no

### C-5: The payload is the delivered resolve shape plus one additive block

- **Statement:** `data` carries the delivered resolve keys in their delivered order (`summary`, `chain`, `decision`, `skipped`, `parks`, `announcements`) unchanged, followed by one additive `simulation` object; no delivered key is renamed, removed, re-ordered, or re-typed.
- **Source:** additive-stability standard; ticket AC (same routing as `resolve`)
- **Verification:** pinned key-order test; schema inventory
- **Negotiable:** no

### C-6: No new error identity

- **Statement:** Fixture defects and invocation defects reuse `input.value.rejected`; simulated decision failures reuse the delivered provider identities (`provider.chain.empty`, `provider.chain.invalid`, `provider.quota.exceeded`, `provider.outage`, `provider.peak.zone-unknown`, `provider.budget.exceeded`); no `provider.simulate.*` row exists.
- **Source:** lean-process driver; error-table growth discipline
- **Verification:** error-table sync; a matrix asserting each simulate outcome's code
- **Negotiable:** no

### C-7: Fixture facts are never a policy source

- **Statement:** No production composition reads a fixture; the fixture cannot supply configuration, credentials, or state, only simulated observations; the command is registered like every member and refuses at runtime if its composition is absent.
- **Source:** AC ("policy expressed only in Jaiship config")
- **Verification:** boundary test (fixture reader reachable only from the simulate composition) + code review
- **Negotiable:** no

> **Table stakes:** the family's grammar refusal discipline, the CommandResult envelope, the redaction chokepoint, and the bounded-output rules are unchanged and not scored.

## Decision Drivers

**Technical drivers (ranked):**

1. **Fidelity** — the simulated decision must equal the real decision for the same facts; anything else makes the evidence worthless.
2. **Hermeticity** — offline, no credential, no network, no writes; a replay must be reproducible on a reviewer's machine.
3. **Expressiveness sufficient for the documented routing** — peak windows (including zones), quota exhaustion with resets, outages, budgets, disabled entries, paid-fallback policy.
4. **One implementation** — no second evaluator to drift.

**Operational drivers:**

5. **Comparability** — automation diffs two runs; stable shape and ordering matter.
6. **Legibility** — a human reads the same lines `resolve` prints, plus what was simulated.
7. **Low surface cost** — one verb in an existing family; no new error row, no new state kind.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-350 clarify-scope).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance at the GH-350 PR review; the AI does not accept this record.
- **Contributors:** `@pm` (verification bar), `@spec-writer` (schema and payload), `@decision-advisor` (analysis).
- **Required reviewers:** `@readiness-reviewer`, `@reviewer`, human owner.
- **Performers:** `@spec-writer`, `@test-plan-writer`, `@coder`, `@doc-syncer`.
- **Informed:** flip evidence owners, operators authoring fixtures.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| The engine is created from injected seams and `resolve` accepts `persist: false` | FACT | `packages/core/src/provider/engine.ts`; `feature-provider-engine.md` §API contracts | Simulation would need a new entry point | High |
| `resolve` is mutating and its payload has six keys in a pinned order | FACT | `feature-provider-engine.md` §CLI surface; `packages/cli/src/commands/provider.ts` | C-5 would be wrong | High |
| The CLI family already validates grammar before any read or write | FACT | `packages/cli/src/commands/provider.ts` | Simulate could inherit a weaker posture | High |
| Tests already drive the engine with fake clock, credential port, transport, and state | FACT | provider test suites (hermetic) | A fixture schema would be new invention rather than a projection of test seams | High |
| Zone offsets can be declared as a step table, so a replay is reproducible without host tz data | ASSUMPTION | ADR-0012 port shape | Non-UTC fixtures would rely on host tz data and lose byte-stability across hosts | Medium |
| Operators can author the fixture shape without a generator | ASSUMPTION | schema size (six optional blocks) | A `provider simulate init` helper would be needed later (additive) | Medium |
| No consumer needs a textual diff of two runs in the machine payload | ASSUMPTION | repository search: no diff contract exists | A diff contract would be an additive decision | Medium |

## Mental Models & Techniques Used

- **First principles:** a simulation is the decision function applied to stated facts. If it is the same function and the facts are complete, the output is not an approximation — it *is* the decision.
- **Inversion:** how does a simulator lie? By reimplementing policy, by reading the host clock, by fetching live, by writing state, or by silently defaulting a missing fact. C-1 … C-4 each close one.
- **Second-order thinking:** a permissive fixture (unknown keys ignored) would let a typo silently simulate a different scenario than the author intended — the worst failure for a verification tool.
- **Boundary thinking:** facts versus policy. The fixture may say "this endpoint answered 200 with these limits"; it may not say "the chain is X" beyond selecting a declared chain, and it may never supply a credential value.
- **KISS:** the payload is the delivered one; the only new thing is a disclosure block.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| | C-1 one evaluator | C-2 zero side effects | C-3 determinism | C-4 strict fixture | C-5 resolve shape + block | C-6 no new identity | C-7 facts not policy |
|---|---|---|---|---|---|---|---|
| ALT-0 no simulate surface | ❌ (requirement declined) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-1 `--fixture <path>` JSON facts through the real engine (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 inline flags for every fact | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ |
| ALT-3 read a state snapshot / run `resolve` with captured state | ⚠️ | ❌ | ⚠️ | ✅ | ✅ | ✅ | ❌ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (none claimed).

### Alternative 0 — No Simulate Surface, Rely on Unit Tests

- **Eligibility:** Not eligible (declines the ticket's explicit requirement and the flip's verification bar).
- **Summary:** Keep simulation as test-only; the operator has no replay surface.
- **Constraint compliance:** All constraints pass; the requirement is unmet.
- **Driver fit:** Fails drivers 1, 5, 6 for the operator; the evidence bar has no command to point at.
- **Pros:** Zero surface.
- **Cons:** "Simulated states produce the documented routing" remains a claim about tests, not a capability; the flip's F2 evidence is weaker.
- **Why rejected:** The ticket and the flip plan both require the surface.

### Alternative 1 — `--fixture <path>` JSON Facts Through the Real Engine (selected)

- **Eligibility:** Eligible (passes C-1 … C-7).
- **Summary:** One required flag names a strict versioned JSON document; the command composes the delivered engine with fixture seams, calls `resolve` with `persist: false`, and emits the resolve payload plus a `simulation` disclosure block.
- **Constraint compliance:** C-1 by construction; C-2 because the fixture seams replace every side effect and no store is injected; C-3 because every temporal and observational input is a fixture value; C-4 by strict parsing; C-5 by appending one block; C-6 by reusing identities; C-7 by scope.
- **Driver fit:** Best on all seven.
- **Pros:** Fidelity (same engine), reviewable fixtures in a PR, stable machine shape, one flag to learn.
- **Cons:** Fixtures are verbose for a trivial case; the operator must learn the schema; a fixture is a document to keep in sync with the provider names it references (refusals catch stale names).
- **Why chosen:** It is the only option that is simultaneously faithful, hermetic, and expressive.

### Alternative 2 — Inline Flags for Every Fact

- **Eligibility:** Eligible with an accepted-risk exception on C-4 (⚠️: a flag grammar cannot express per-entry limit lists and reset instants without a second encoding).
- **Summary:** `--now`, `--quota-percent`, `--quota-reset`, `--spend-cost`, … on the command line.
- **Constraint compliance:** C-4 degrades: there is no strict schema, and the flag surface grows with every provider fact. Expressiveness is capped at one entry per invocation unless flags become indexes, which is a worse document format.
- **Driver fit:** Fails driver 3 (cannot express a realistic multi-entry scenario) and driver 5 (no stable document to diff).
- **Pros:** Discoverable through `--help`; no file to author.
- **Cons:** A flag dialect that will always lag the facts; no way to commit a scenario as evidence.
- **Why rejected:** It cannot express the documented routing scenarios the requirement names.

### Alternative 3 — Read a State Snapshot or Reuse Captured State

- **Eligibility:** Not eligible (fails C-2, and weakens C-3 and C-7).
- **Summary:** Point the command at a copied state directory and run the real `resolve` against it.
- **Constraint compliance:** C-2 fails: a state-root read is a live store read, and a naive implementation writes a park if the store is injected; C-3 degrades: the decision depends on ledger history rather than stated facts; C-7 is at risk if the snapshot substitutes for configuration.
- **Driver fit:** Fails drivers 1, 2, 5.
- **Pros:** Realistic history.
- **Cons:** Not offline-by-construction; not a stated-fact replay; cannot simulate a future quota reset without fabricating records.
- **Why rejected:** It simulates *state*, not *facts*, and it cannot be side-effect-free without a second store implementation.

## Decision

- **Decision:** Adopt **ALT-1**.

### D1 — Invocation grammar

`provider simulate --fixture <path> [--json]`. `--fixture` is required; a missing value or a missing flag refuses `input.value.rejected` before any read. The command accepts no `--chain`, `--profile`, `--all`, or positionals: chain and profile selection live **inside** the fixture so one document is one scenario and there is no second authority. An undeclared flag refuses through the shared parser as `fallback.invocation`.

### D2 — Fixture schema (`delivery.provider.simulate.v1`)

A strict JSON object; unknown keys refuse. Policy (providers, chains, credentials references, budgets, profile definitions) comes from the resolved configuration, never from the fixture; the fixture supplies only observations and the instant.

| Key | Shape | Required | Meaning |
|---|---|---|---|
| `schemaVersion` | `"delivery.provider.simulate.v1"` | yes | Version discriminator; any other value refuses. |
| `now` | ISO-8601 instant with explicit zone | yes | The injected clock instant; every instant in the payload derives from it. |
| `chain` | declared chain name | no | Simulates `--chain`; when absent the declared `defaultChain` applies. |
| `profile` | declared profile name | no | Simulates the `resolve --profile` scope. |
| `credentials` | record of reference name → `"resolved"` \| `"missing"` | no | The credential port's outcome per reference; **no value field exists**. An undeclared name defaults to `"resolved"` for the references the selected chain needs, and is disclosed. |
| `quota` | record of entry name → `{ "httpStatus": number, "body": string }` or `{ "transport": "outage" }` | no | The transport result per entry; the delivered normalizer and evaluator consume it unchanged. An entry with no block is not probed (treated as an entry without a quota policy). |
| `spend` | `{ "telemetryState": "present" \| "absent", "points": [{ "atMs": number, "cost": number, "tokens": number }] }` | no | The spend-totals port's facts; `absent` is the verified-empty reading. Points are projected per budget window exactly as the production projection does. |
| `zones` | record of zone name → ordered list of `{ "fromMs": number, "offsetSeconds": number }` | no | A step table for zone offsets. When absent, the edge's zone resolver is used (ADR-0012) and `simulation.inputs.zones` records `runtime`. |

Credential-shaped fields are structurally impossible: the `credentials` value is an enum, and the schema has no `value`, `secret`, `token`, or `key` field anywhere. A fixture containing one refuses as unknown-key.

### D3 — Composition and the zero-effect guarantee

The simulate composition builds `createProviderEngine` with: a clock returning the fixture's `now`; a credential port answering the fixture outcomes (missing → the delivered resolution failure shape, without any material); a transport answering the fixture `quota` blocks (and throwing for `transport: "outage"`); a spend-totals port projecting the fixture `points`; a zone resolver reading the fixture `zones` or the edge port; and **no state store**. `resolve` is called with `persist: false`, so no park generation, announcement record, or derived document is written even if a store were accidentally supplied. The command imports no child-process, network, or credential implementation.

### D4 — Output contract

`data` is the delivered `resolve` payload in delivered key order — `summary`, `chain`, `decision`, `skipped`, `parks`, `announcements` — followed by one additive `simulation` object:

```
simulation: {
  fixturePath,            // the resolved path as given
  fixtureSchemaVersion,   // "delivery.provider.simulate.v1"
  now,                    // the fixture instant
  stateWrites: 0,         // constant, declared
  inputs: {               // which seams the fixture supplied
    credentials: "fixture",
    quota: "fixture",
    spend: "fixture" | "none",
    zones: "fixture" | "runtime"
  },
  summary: {              // bounded, deterministic
    decision: "selected" | "parked",
    providerName?,        // selected only
    parkCause?,           // parked only
    resumeAt?,            // parked only
    skippedCount,
    announcementCodes: [] // the codes present, in payload order
  }
}
```

**No textual diff is produced.** A diff needs a baseline, and there is no baseline whose semantics this decision can honestly define (a previous fixture is a different scenario; the live configuration is a different fact set). The machine-comparable contract is instead: *the resolve keys of a simulation equal the resolve keys of `resolve` fed the same facts*. A parity test asserts that equality, and automation diffs two simulation payloads directly.

Human mode prints the same lines `resolve` prints, preceded by one `simulate` header naming the fixture, the instant, and `stateWrites=0`, and followed by the skipped-count and announcement-code summary line.

### D5 — Determinism, exits, errors

Fixture parsing canonicalises object keys before evaluation, so key order in the document never affects output; arrays keep their declared order because order is meaningful (points, zone steps). Exit `0` for a selected decision, `2` for a parked or fully-skipped decision, `1` for a fixture or invocation defect or a classified decision failure — mirroring `resolve`. Fixture defects (missing file, unreadable, malformed JSON, unknown key, bad type, unsupported version, oversize) reuse `input.value.rejected` with a bounded summary naming the field; decision failures reuse the delivered provider identities; **no `provider.simulate.*` error row exists**. The fixture read is one bounded read with a declared byte cap; no fixture content is echoed in a failure.

- **Decider:** Juliusz Ćwiąkalski — pending at the GH-350 PR review.
- **Conditions for revisit:** see `revisit_triggers`.

### Constraint Compliance Attestation

The chosen alternative satisfies C-1 … C-7: the delivered engine performs every decision (C-1); no store, credential implementation, transport, or child process is reachable and `stateWrites: 0` is disclosed (C-2); all temporal and observational inputs are fixture values with canonicalised key order (C-3); the schema is strict and versioned and cannot carry a credential value (C-4); the payload appends exactly one block to the delivered shape (C-5); no new error row exists (C-6); and no production composition reads a fixture (C-7). No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- The F2 verification bar becomes executable evidence, and a delivery's routing can be replayed on a reviewer's machine.
- Fidelity is structural: the simulator cannot drift from `resolve` without failing the parity test.
- Fixtures are committable scenario documents, reviewable in the change's PR.
- The zero-write guarantee is disclosed on every payload, not just documented.

### Negative Outcomes

- The fixture schema is real surface and must be versioned when facts grow.
- Non-UTC fixtures that omit `zones` inherit host tz data, so byte-stability across hosts requires the table; the payload names which source was used.
- Operators must understand that a fixture is facts, not policy: changing a budget in a fixture is impossible by design.
- Verbose fixtures for trivial scenarios; a future `simulate init` helper would be additive.

### Unresolved Questions

- [ ] Whether a `simulate --against <fixture>` comparison should exist (owner: `@pm`; recommendation: no — automation can diff payloads, and a second document would need its own semantics).
- [ ] Whether `credentials` should default to `missing` rather than `resolved` for undeclared references (owner: `@spec-writer`; recommendation: default `resolved` for references the chain needs and disclose it, so a minimal fixture reproduces the happy path).

## Implementation Plan

1. Contracts: the fixture schema constant and types (declaration-only), the `simulation` block type.
2. CLI: grammar (`provider simulate --fixture`), the fixture reader in the file adapter or the command's composition, the composed runtime.
3. Composition: engine wiring with fixture seams and no store; `persist: false`.
4. Payload: append `simulation`, keep the resolve key order pinned.
5. Tests: parity with `resolve`, zero-write snapshot, no-credential/no-transport call guards, fixture-refusal matrix, determinism and key-order shuffle, exits.
6. Docs: provider-engine CLI table and a fixtures reference page.

## Verification Criteria

- Metric: simulation-versus-resolve decision differences for identical facts — Target: 0 — Window: GH-350 CI.
- Metric: state writes, network calls, credential resolutions, and spawns during simulate — Target: 0 each — Window: GH-350 CI (byte snapshot + throwing fakes).
- Metric: unknown-key, bad-version, oversize, and credential-shaped fixtures accepted — Target: 0 — Window: GH-350 CI.
- Metric: byte differences between two runs of one fixture — Target: 0 — Window: GH-350 CI.
- Metric: new error identities for simulate — Target: 0 — Window: GH-350 CI (error-table sync).

## Confidence Rating

**High.** The engine's injected-seam design already provides every fact the fixture declares, and the payload is the delivered one plus a disclosure block. The medium-confidence element is fixture ergonomics (verbose documents, host tz data when `zones` is omitted), both bounded by additive follow-ups rather than semantic risk.

## References

- [ADR-0007](ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md) — the pure engine and its injected seams.
- [ADR-0012](ADR-0012-zone-aware-peak-windows-iana-zone-resolution.md) — the zone port the fixture can pin.
- [TDR-0031](TDR-0031-engine-first-evaluation-surfaces.md) — engine-first evaluation surface precedent.
- [TDR-0038](TDR-0038-simulated-stateful-tracker-double-declared-effects.md) — declared-effect simulation precedent.
- Feature specs: [Provider Engine](../spec/features/feature-provider-engine.md), [Provider Profiles](../spec/features/feature-provider-profiles.md).
- Change: `doc/changes/2026-11/2026-11-19--GH-350--provider-policy/`.
