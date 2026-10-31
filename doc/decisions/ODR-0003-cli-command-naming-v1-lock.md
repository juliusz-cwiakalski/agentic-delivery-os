---
id: ODR-0003
decision_type: odr
status: Proposed
created: 2026-10-31
decision_date: null
last_updated: 2026-10-31
summary: "The v0 command registry is accepted as the v1-locked public command surface: one meaning per name, near-synonym pairs rejected, family grouping, domain nouns not used for narrower commands, one-glance distinguishability and guessability; the provider family, the provider-quota adapters subpath, and the DeliveryRequest primitive term are confirmed; no renames occur, and after M0 a rename requires a superseding record plus a code change."
owners:
  - "Juliusz Ćwiąkalski"
service: delivery-os command surface
decision_scope: repo
review_date: null
classification:
  domains: [tooling, ux, operations]
  archetype: policy
  environment: clear
  rigor: R2
  reversibility: hard
  stakes: medium
  urgency: high
  uncertainty: low
  blast_radius: org
  recurrence: one-off
governance:
  driver: "@decision-advisor (GH-186)"
  decider: "Juliusz Ćwiąkalski (human; acceptance pending at GH-186 PR review)"
  contributors:
    - "@spec-writer (GH-186 spec §5.1 F-2)"
    - "@decision-advisor (analysis and record)"
  reviewers:
    - "@reviewer"
    - "Owner (human acceptance)"
  performers:
    - "@coder (future command additions)"
  informed:
    - "CLI, MCP, and documentation contributors"
    - "M4-S1 product/brand naming freeze"
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A command name is found to violate one-meaning-per-name or near-synonym rejection in a way that misroutes operators: a rename requires a superseding decision record plus a code change."
  - "A new command family is proposed: add it to the registry and apply the same naming rules rather than extending an unrelated family."
  - "The M4-S1 product/brand naming freeze changes the working product name: command names remain locked; only name-derived branding values change."
links:
  related_changes: ["GH-186"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/planning/oss-tooling/cli-command-registry.md"
    - "doc/planning/concepts/agent-primitive-surface.md"
  contracts: []
  diagrams: []
  decisions: ["ADR-0007", "ADR-0003"]
  experiments: []
  metrics: []
  roadmap_items: ["M4-S1"]
---

# ODR-0003: CLI Command Naming v1 Lock

## Context

- **FACT:** `doc/planning/oss-tooling/cli-command-registry.md` is the man page v0 and command registry. Its naming audit already applied four deferred renames — `change`→`phase`, `validate`→`lint`, `workspace`→`repos`, and `opencode`→`harness` — and three naming items remained explicitly open: the `provider` command family name, the `provider-quota` adapters subpath name, and the unified PR/MR primitive term.
- **FACT:** The registry states that command names are locked before M0 ends "via a decision record or the man-page v1 acceptance"; this record is that decision.
- **FACT:** The v1 adapter contract already uses `DeliveryRequest` as the unified PR/MR primitive term (`feature-adapter-ports.md`); `provider-quota` exists as the working adapters subpath name and is referenced by ADR-0007 DC-1 with a revisit trigger pointing at the M0-S17 naming lock.
- **FACT:** Renaming after consumers exist would invalidate help text, docs, MCP tool names, and user habits; the lock is therefore prospective and performs zero renames.
- **Why now:** M0 exit requires the command surface to be frozen, and later stories (M1-S11 harness adapters, M4-S1 branding) assume stable command names.

## Problem Framing (Clarified)

The question is what the **v1 public command surface** is and what rule governs future names. Two things must be separated:

1. **The surface:** the command names and family names in the registry, plus the `provider` family, the `provider-quota` adapters subpath, and the `DeliveryRequest` primitive term.
2. **The rule:** how future commands are named and what a rename costs.

The registry's terminology already establishes one-meaning-per-name (`verify`, `lint`, `status`, `state`) and rejects near-synonyms. The remaining work is to accept the current surface as v1 and state the freeze rule so no documentation-only edit can rename a command.

## Constraints (Hard Requirements)

| ID | Pass/fail requirement | Source | Verification | Negotiable |
|---|---|---|---|---|
| C-1 | Each command name has exactly one meaning in the delivery domain; near-synonym pairs are rejected. | registry TERMINOLOGY; GH-186 §5.1 F-3 | registry review; naming audit | no |
| C-2 | Commands are grouped into families, and new commands join an existing family where one fits. | registry COMMAND FAMILIES | registry review | no |
| C-3 | A domain noun (for example `change`) is not reused as a narrower command name when it already names a broader domain concept. | registry naming audit; `change`→`phase` precedent | registry review | no |
| C-4 | Names are distinguishable at a glance and guessable from their help line. | registry naming audit ("disambiguating help lines") | naming-audit review | no |
| C-5 | The `provider` family, the `provider-quota` adapters subpath, and the `DeliveryRequest` primitive term are confirmed as v1, with zero renames in this change. | GH-186 §5.1 F-3; ADR-0007 DC-1 | registry/ADR diff; repo rename check | no |
| C-6 | After M0, a rename requires a superseding decision record **and** a code change, never a documentation-only edit. | registry introduction; GH-186 DEC-5 | decision/index review | no |

> **Table stakes:** all alternatives keep the existing `ados` working-name branding seam and the registry structure; acknowledged once rather than per alternative.

## Decision Drivers

1. **Predictability for operators and agents** — a guessed command should be the right command.
2. **No silent drift** — names cannot move through a docs-only change.
3. **Family coherence** — related commands read as a group.
4. **Cheap future evolution** — adding a command is easy; renaming is deliberate and recorded.
5. **Consumer stability** — help text, MCP tool names, and docs keep working.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` (GH-186).
- **Decider / Approver:** Juliusz Ćwiąkalski — human acceptance pending at GH-186 PR review. The record remains `Proposed` until then.
- **Contributors:** `@spec-writer` (GH-186 §5.1 F-2), the registry's naming audit.
- **Required reviewers:** `@reviewer`; the owner for acceptance.
- **Performers:** `@coder` for any future command addition.
- **Informed:** CLI/MCP/documentation contributors and M4-S1.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|---|---|---|---|---|
| The v0 registry is the intended v1 surface and no pre-lock rename is required. | FACT | registry naming audit; GH-186 §5.1 F-3 | A rename before the lock would be needed, contradicting the prospective-lock decision. | High |
| `DeliveryRequest` is already the v1 adapter-contract term. | FACT | `feature-adapter-ports.md` | The primitive term would need a new decision rather than a confirmation. | High |
| `provider-quota` exists as the adapters subpath working name. | FACT | ADR-0007 DC-1; `packages/adapters/` | The confirmation would target a non-existent name. | High |
| `provider` is the AI-model routing family and does not mean tracker/VCS/CI adapters. | FACT | registry `ados provider` row; naming audit | The family name would be ambiguous across domains. | High |
| No later consumer requires a different command name for v1. | ASSUMPTION | story map; M1-S11/M4-S1 scope | A superseding record would be required; the freeze rule bounds the cost. | Medium |

## Mental Models & Techniques Used

- **One meaning per name:** a name is an identity, not a label.
- **Near-synonym rejection:** two names for one operation force a choice the user cannot make reliably.
- **Family grouping:** names read as a coherent vocabulary.
- **Freeze + supersede:** stability is the default; change is explicit and priced.
- **Inversion:** design from a user guessing a command — the guessed name must be right or clearly unavailable.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

|          | C-1 one meaning | C-2 families | C-3 no domain-noun reuse | C-4 distinguishable | C-5 confirm three, zero renames | C-6 rename rule |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|
| ALT-0 no lock | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| ALT-1 accept v0 as v1 + prospective freeze (selected) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ALT-2 rename now to a cleaner surface | ✅ | ✅ | ⚠️ | ✅ | ❌ | ✅ |
| ALT-3 lock only some commands | ✅ | ❌ | ✅ | ⚠️ | ❌ | ❌ |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via an accepted-risk exception (none taken).

### Alternative 0 — Do Nothing (No Lock)

- **Eligibility:** Not eligible (fails C-1, C-3, C-4, C-5, C-6).
- **Summary:** Leave the surface unlocked.
- **Pros:** Maximum future flexibility.
- **Cons:** Any docs change can rename a command; consumers break silently.
- **Why rejected:** M0 exit requires the surface to be locked, and the registry already states the intent.

### Alternative 1 — Accept v0 as v1 with a Prospective Freeze (selected)

- **Eligibility:** Eligible.
- **Summary:** The current registry surface is v1; `provider`, `provider-quota`, and `DeliveryRequest` are confirmed; no rename occurs; later renames need a superseding record plus a code change; new commands join existing families.
- **Constraint compliance:** Passes C-1…C-6.
- **Pros:** No consumer breakage; a clear rule; cheap additive evolution.
- **Cons:** A latent imperfection, if any, is frozen (bounded by the superseding-record cost).
- **Why chosen:** It satisfies every constraint and matches the registry's already-applied audit.

### Alternative 2 — Rename Now to a Cleaner Surface

- **Eligibility:** Not eligible (fails C-5; the C-3 pass would need an accepted-risk exception that is not taken).
- **Summary:** Rename `provider` or other names before the v1 lock.
- **Pros:** A potentially cleaner vocabulary.
- **Cons:** Breaks help text, docs, MCP tool names, and habits in a docs-only change; the audit already applied the four necessary renames.
- **Why rejected:** No latent defect justifies a pre-lock rename, and a rename is out of scope for this change.

### Alternative 3 — Lock Only Some Commands

- **Eligibility:** Not eligible (fails C-2, C-5).
- **Summary:** Freeze the stable commands but leave the disputed family or primitive term open.
- **Pros:** Keeps negotiating room.
- **Cons:** The surface remains ambiguous; the three deferred items are exactly what M0-S17 must resolve.
- **Why rejected:** A partial lock fails the purpose of the M0 exit condition.

## Decision

- **Recommendation:** Alternative 1.
- **Authorized Decision:** pending — the owner accepts or adjusts at GH-186 PR review. Until then the record is `Proposed` and grants no authority. The lock date recorded in the registry banner is **2026-10-31**.

### DC-1 — Naming rules for v1

Each command has exactly one meaning in the delivery domain; near-synonym pairs are rejected. Commands are grouped into families, and a domain noun already used for a broader concept is not reused for a narrower command. Names must be distinguishable at a glance and guessable from their help line.

### DC-2 — Confirmed names and subpath

The `provider` command family (AI model routing only; tracker, VCS, and CI providers are adapters, not this family), the `provider-quota` adapters subpath, and the `DeliveryRequest` primitive term are confirmed as the v1 surface. No rename occurs in this change; the `provider-quota` name is mechanically fixed and behavior-independent.

### DC-3 — No renames

This change performs zero command, option, package, adapters-subpath, or product renames. The registry promotion from man page v0 to v1 is annotation-only; every command-table row and command token stays byte-identical.

### DC-4 — Freeze rule after M0

After M0, new commands join existing families and follow the naming rules. A rename of a locked command name, family name, `provider-quota` subpath, or `DeliveryRequest` term requires a **superseding decision record plus a code change**; a documentation-only edit never renames a command. The lock does not freeze global option names, configuration key names, or the product/brand name (M4-S1).

- **Decider:** Owner (Juliusz Ćwiąkalski) — acceptance pending at GH-186 PR review.
- **Conditions for revisit:** see `revisit_triggers`; the most important is a demonstrable naming defect that misroutes operators.

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints C-1 through C-6: names have one meaning (C-1); families group commands (C-2); domain nouns are not reused narrowly (C-3); names are distinguishable and guessable (C-4); the three deferred items are confirmed with zero renames (C-5); and future renames require a superseding record plus a code change (C-6). No accepted-risk exceptions are taken.

## Trade-offs & Consequences

### Positive Outcomes

- The v1 command surface is stable and citable.
- Operators and agents can trust a guessed command name.
- Help text, docs, MCP tool names, and habits stay valid.
- New commands evolve additively within families.

### Negative Outcomes

- Any latent naming imperfection is frozen until a superseding record.
- A future rename carries an explicit decision-record cost.
- The lock does not cover global options, config keys, or the product/brand name.

### Unresolved Questions

- [ ] None blocking; owner acceptance is the PR-review gate.
- [ ] M4-S1 remains responsible for the product/brand naming freeze, which this record deliberately does not cover.

## Implementation Plan

1. `cli-command-registry.md` is promoted from man page v0 to v1 by annotation: title, man-page heading, lock banner naming this record and the 2026-10-31 lock date, the introduction sentence, and the `provider` naming-audit bullet.
2. Every command table row, command token, family name, and deferred-rename record stays byte-identical.
3. Future command additions follow the naming rules and join existing families.
4. Future renames require a superseding decision record plus a code change.

## Verification Criteria

- Metric: command-table rows or command tokens changed by this change — Target: 0 — Window: GH-186 diff.
- Metric: renames in the change diff — Target: 0 — Window: GH-186 diff.
- Metric: future renames without a superseding record — Target: 0 — Window: decision/index review.

## Confidence Rating

**High.** The surface is current truth, the three deferred items are confirmed by existing artifacts, and the audit already applied the necessary renames. The only risk is a latent naming defect, which the superseding-record rule bounds.

## References

- [GH-186 change specification](../changes/2026-10/2026-10-31--GH-186--decision-records-measurement-baseline/chg-GH-186-spec.md) — §5.1 F-3 (command-name lock).
- [Command registry and man page](../planning/oss-tooling/cli-command-registry.md) — command surface, naming audit, and deferred renames.
- [Agent primitive surface concept](../planning/concepts/agent-primitive-surface.md) — `DeliveryRequest` term.
- [Adapter ports feature spec](../spec/features/feature-adapter-ports.md) — the v1 adapter contract uses `DeliveryRequest`.
- [ADR-0007](ADR-0007-provider-engine-v1-placement-fail-loud-parks-cost-policy.md) — DC-1 records the `provider-quota` working name and its M0-S17 revisit trigger.
- [ADR-0003](ADR-0003-oss-monorepo-structure.md) — working-name branding seam and the command-surface context.
