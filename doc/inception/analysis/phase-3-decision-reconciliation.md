---
id: TOOLING-INCEPTION-PHASE-3-DECISIONS
status: Draft
created: 2026-11-01
last_updated: 2026-11-02
owners: [bootstrapper]
document_classification: working-analysis
links:
  related_changes: [GH-200]
summary: "Decision-advisor reconciliation of existing architectural homes, recorded acceptance, and implementation gaps."
---

# Phase 3: decision reconciliation

Initial read-only consultation with decision-advisor against `0b7d1ba`, refreshed
under OPEN-Q20 against integrated `main-tools` `5330809`. This is an audit, not a decision record or acceptance
event. Gate 2 carried OPEN-Q7..Q11 forward; Gate 3 cannot silently resolve them.
The [architecture overview](../../overview/architecture-overview.md) and
[tech stack](../../overview/tech-stack.md) distinguish shipped code from target
architecture. No decision record or tracker status was modified.

## Existing homes and acceptance boundary

| Topic | Canonical home | Recorded status | Execution boundary |
|---|---|---|---|
| Six-package structure, layered configuration, runtime neutrality and migration | [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md) | Accepted | Package structure implemented; shared composition implementation and cross-surface parity remain incomplete. |
| Config parser/schema/acquisition | [TDR-0003](../../decisions/TDR-0003-config-parser-schema-and-acquisition.md) | Proposed | Mechanics implemented by GH-173; closure does not record acceptance. |
| State storage | [TDR-0004](../../decisions/TDR-0004-state-storage-engine.md) | Proposed | JSONL truth with scan/SQLite index strategies implemented; operational/platform evidence remains bounded. |
| Delivery result and CLI exit taxonomy | [TDR-0005](../../decisions/TDR-0005-delivery-result-enum-and-cli-exit-taxonomy.md) | Proposed | GH-177 closed; change verification and exit taxonomy implemented; verify gates delivered by PR #217. |
| Additive closeout adapter contracts | [TDR-0008](../../decisions/TDR-0008-additive-adapter-contract-extensions-closeout-v1.md) | Proposed | Supported GitHub/Jira writes, command-specific production composition, real git/state replay substrate delivered; GitLab limited, live-write parity unproven. |
| Privacy guard mechanics | [TDR-0006](../../decisions/TDR-0006-privacy-and-no-cloud-guard-mechanics.md) | Proposed | Guard and emitter controls implemented; production hashed-literal classes are empty. |
| Compound SPDX evaluation | [TDR-0007](../../decisions/TDR-0007-license-gate-compound-spdx-expression-evaluation.md) | Proposed | Enforcement implemented; human license determination is a separate approval. |
| Runtime confinement of provider clients | [ADR-0005](../../decisions/ADR-0005-runtime-confinement-provider-client-subpaths.md) | Proposed | Implemented client boundaries; no general production host readiness claim. |
| Provider engine placement/parks/cost policy | [ADR-0007](../../decisions/ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md) | Proposed | Engine implemented, production factory mounting/spawn integration not established. |
| Harness adapter contract | [ADR-0008](../../decisions/ADR-0008-harness-adapter-contract.md) | Proposed | Contract proposal; typed dispatch adapters are future M1-S11 work. |
| Release model | [ADR-0009](../../decisions/ADR-0009-release-model-v1.md) | Proposed | Existing lockstep scaffolding, later public-release automation; not an operational release. |
| Session-admin mutation | [ADR-0010](../../decisions/ADR-0010-session-admin-port-mutating-contract.md) | Proposed | Implemented metadata/admin operations; owner C-11 privacy sign-off still needs explicit evidence. |
| ID scheme | [ODR-0002](../../decisions/ODR-0002-id-prefix-scheme-and-project-catalog.md) | Proposed | Existing conventions and proposed scheme; not a new accepted naming authority. |
| CLI naming lock | [ODR-0003](../../decisions/ODR-0003-cli-command-naming-v1-lock.md) | Proposed | Command registry exists; lock/ratification is not inferred from merge. |

The thirteen Proposed rows have null decision dates at this baseline. Their
mechanics being present does not convert them to Accepted. The
[register](../../decisions/00-register.md) explicitly states merge does not
auto-accept. These are the tooling-focused review batch, not every Proposed
record in the repository. Framework-scoped records are inputs, not implicitly
included in a ratification request.

## New decision seeds

**No new seed is proposed by this audit.** All foundational topics above have
existing homes. Missing `createRuntime`, executable mounting, MCP integration,
remain implementation/evidence gaps. `verify change | gates` and integrated
closeout are delivered, not missing architecture. These do not
automatically require fresh ADR IDs.

The decision-advisor recommends reconciling existing records rather than
manufacturing decisions from commit subjects. The owner can identify a genuinely
uncovered choice at Gate 3; any such choice returns to decision-advisor with
options before a record is authored. No identifiers have been allocated.

## Compatibility, alternatives and four risks

The reconstruction is compatible with the accepted six-package/strangler
direction; no superseding decision is indicated by the sampled evidence.
The [three-approach comparison](../../overview/tech-stack.md) evaluates the
existing six-package choice against a single tiered package and maximal tier
packages, including qualitative integration cost, scale and selection context.
It is a challenge to current assumptions, not an unrequested reselection.

| Risk lens | Architectural challenge | Proposed validation / existing register |
|---|---|---|
| Value | Package and engine completion may leave operator attention unchanged. | Direct attention collection and independent pilot artifacts; ASM-001/002, RSK-001. |
| Usability | Correct ledger, park and truncation semantics may still be misread as permission to merge. | Caller walkthroughs distinguishing observation, availability and authorization; ASM-003/004, RSK-002/009. |
| Feasibility | Shared composition, platform evidence, growing ledgers and external mutations may fail before package boundaries do. | Composition integration checks, interrupted-step replay, scoped performance/platform evidence; ASM-005/006/007/010, RSK-003/004/005. |
| Viability | Local maintenance, license determination and privacy evidence may consume the promised relief. | Track collection/upkeep cost, explicit legal/privacy review, configured-control evidence; ASM-008/009, RSK-006/007/008. |

Linked IDs refer to the [assumptions](assumptions.md) and [risks](risks.md)
registers. Proposed validation is not a reported experiment or successful pilot.

## Decision-substrate maintenance gaps

- [Decision index](../../decisions/00-index.md) lacks ODR-0002 and ODR-0003
  rows at this baseline, although the files and register links exist.
- The register is a foundational-topic projection, not an exhaustive inventory;
  broader omission claims require scope review, not automatic new rows.
- These are navigation/maintenance gaps, not permission to invent or accept
  decisions. Proposed correction route is recorded with OPEN-Q12 and the
  carried OPEN-Q11 write-authorization question. No canonical index was changed.

## Human acceptance route

Juliusz Cwiakalski is the recorded human decision authority; decision-advisor
is the record custodian, not a substitute decider. Acceptance must identify
the record and decision, then update its status, decision date and human-decider
metadata with evidence of that authorization. The batch may be reviewed at the
single inception PR, through per-record delivery, or through a dedicated
acceptance change; selecting the route remains an owner choice.

Three acts must remain separate: approving this reconstruction, accepting a
Proposed architecture record, and providing session/privacy or dependency-license
determination. Gate 3 approval alone supplies only the first unless the owner
explicitly says otherwise. See [Phase 3 questions](../open-questions/phase-3-open-questions.md).
