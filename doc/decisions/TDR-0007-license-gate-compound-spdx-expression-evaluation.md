---
id: TDR-0007
decision_type: tdr
status: Proposed
created: 2026-10-31
decision_date: null
last_updated: 2026-10-31
summary: "Interpret ADR-0003 C-2's 'fails closed on compound expressions' as per-branch fail-closed SPDX evaluation: no branch may be unknown, non-asserted (`NOASSERTION`/`SEE LICENSE`), denied, or non-allow-listed; blanket rejection of all compound expressions is not the policy."
owners: ["Juliusz Ćwiąkalski"]
service: delivery-os
decision_scope: repo
review_date: null
business_impact: "Preserves the live MIT OR Apache-2.0 dependency while keeping the license gate fail-closed on any unknown, non-asserted (`NOASSERTION`/`SEE LICENSE`), denied, or non-allow-listed branch, and removes an authoritative-policy ambiguity that could invite an incompatible reinterpretation."
classification:
  domains: [legal, security, tooling, operations]
  archetype: policy
  environment: complicated
  rigor: R2
  reversibility: easy
  stakes: medium
  urgency: medium
  uncertainty: low
  blast_radius: local
  recurrence: one-off
governance:
  driver: "@decision-advisor"
  decider: "Juliusz Ćwiąkalski (owner; acceptance pending at PR review)"
  contributors:
    - "@pm (GH-187 DEC-3 and Appendix C, 2026-10-31)"
    - "@spec-writer (GH-187 specification and interpretation record)"
    - "@readiness-reviewer (readiness iteration 1, finding 3, 2026-10-31)"
  reviewers: ["@reviewer", "@readiness-reviewer", "Human owner (PR review)"]
  performers: ["@coder"]
  informed: ["@pm"]
ai_assistance:
  used: true
  roles: [repository-analyst, analyst, record-writer]
  external_data_shared: false
  citations_verified: false
  human_decider: null
  reviewers: []
revisit_triggers:
  - "A later decision rejects all compound SPDX expressions or changes the deny-over-allow model; that record supersedes this clarification."
  - "The license registry schema or gate mechanics change materially (for example a different expression grammar); re-read this interpretation against the new mechanics."
  - "A dependency ships a compound expression whose branches cannot all be allow-listed (for example an OR where one branch is proprietary); revisit the policy rather than exempting it ad hoc."
  - "A human legal/license review determines that per-branch allow-listing is not an acceptable proxy for compatibility; reopen the policy with the owner."
links:
  related_changes: ["GH-187", "GH-170"]
  supersedes: []
  superseded_by: []
  spec:
    - "doc/spec/features/feature-monorepo-scaffold-toolchain.md"
  contracts: []
  diagrams: []
  decisions: ["ADR-0003"]
  experiments: []
  metrics: []
  roadmap_items: []
---

# TDR-0007: License Gate Compound SPDX Expression Evaluation

## Context

- **FACT:** ADR-0003 (Accepted 2026-10-24) C-2 defines the repository license policy: the gate accepts only OSI-approved, Apache-2.0-compatible SPDX identifiers on the allow-list; it fails closed on unknown, `NOASSERTION`, `SEE LICENSE`, and compound expressions; and it denies SSPL, BUSL, Elastic License, Commons Clause, and CC-BY-NC (`doc/decisions/ADR-0003-oss-monorepo-structure.md`, C-2 at line 175). The license-registry metric at line 1202 repeats that "unknown and compound expressions fail closed".
- **FACT:** GH-170 seeded `doc/legal/dependency-licenses.yaml` and `scripts/checks/license-audit.ts`. The audit tokenizes and parses SPDX AND/OR/parentheses, then evaluates every identifier branch against the allow-list; a disallowed branch fails the whole expression (`scripts/checks/license-audit.ts`, `parseSpdxExpression` and `auditRegistry`).
- **FACT:** The live committed registry contains `@biomejs/biome` with `MIT OR Apache-2.0`, verdict `approved` (`doc/legal/dependency-licenses.yaml`). The live gate passes this entry today.
- **FACT:** The current system specification describes the same behavior: SPDX expressions are parsed (AND/OR/parentheses) and the gate fails closed on unregistered uses and non-allow-listed branches (`doc/spec/features/feature-monorepo-scaffold-toolchain.md`, "License registry").
- **FACT:** GH-187 records the intended interpretation as DEC-3 and Appendix C of `chg-GH-187-spec.md`, but no decision record or ADR-0003 amendment exists. Readiness iteration 1, finding 3 identified that ADR-0003 C-2 and the delivered behavior will otherwise still disagree about the controlling policy.
- **FACT:** GH-187 scope explicitly excludes removing the live compound dependency and excludes rejecting all compound SPDX expressions (`chg-GH-187-spec.md`, NG-4 and F-6).

## Problem Framing (Clarified)

The ambiguity is in an authoritative record's wording, not in a behavior defect. ADR-0003 C-2's phrase "fails closed on ... compound expressions" admits two readings:

1. **Blanket reading** — any expression containing an operator is rejected outright.
2. **Per-branch reading** — the expression is parsed, and the gate fails closed if any identifier branch is unknown, unparseable, denied, or not allow-listed.

Reading 1 cannot coexist with the live `MIT OR Apache-2.0` dependency or with the current system specification. Reading 2 is what the audit, GH-170, and GH-187 already do. The real problem is that reading 2 has never been stated in a durable, authoritative artifact, so a future change could implement reading 1 in good faith and break a legitimate dependency — or could quietly relax the gate by treating a compound expression as a single opaque token.

Because ADR-0003 is `Accepted`, its core decision statement is immutable under the repository's decision-record conventions. The correct mechanism is therefore a new record that **clarifies** the ambiguous clause and links back to ADR-0003, rather than rewriting accepted text or superseding the whole architecture decision.

## Constraints (Hard Requirements)

### C-1: The gate never accepts an unresolved, non-asserted, denied, or non-allow-listed license

- **Statement:** For every registry entry, the gate fails when a license is empty, unparseable, `NOASSERTION`, `SEE LICENSE`, a `LicenseRef-*` reference, an unknown identifier, a denied identifier, or a valid identifier absent from the allow-list — including when that identifier is one branch of a compound expression.
- **Source:** prior decision (ADR-0003 C-2); AC (GH-187 F-4, G-4)
- **Verification:** test + audit
- **Negotiable:** no

### C-2: Expressions are parsed, never prefix- or substring-matched

- **Statement:** Compound SPDX expressions are tokenized and parsed into identifier branches; no branch is accepted or rejected by prefix or substring matching against the allow-list.
- **Source:** AC (GH-187 F-4, F-6); internal standard (current system specification)
- **Verification:** test + code review
- **Negotiable:** no

### C-3: No gate weakening, no bypass, no new CI job

- **Statement:** The interpretation preserves the existing binding `ts-license-audit` gate as the only license gate; it adds no bypass and does not soften unknown or denied handling.
- **Source:** AC (GH-187 F-5, DEC-4)
- **Verification:** audit + code review
- **Negotiable:** no

### C-4: Interpretable within GH-187 scope without dependency or registry-entry churn

- **Statement:** The interpretation must leave the live dependency graph, lockfile, and existing registry entries (including `@biomejs/biome` at `MIT OR Apache-2.0`) unchanged; GH-187 does not add, remove, downgrade, or re-license a dependency.
- **Source:** AC (GH-187 scope and no-dependency-change control)
- **Verification:** audit + test
- **Negotiable:** no

## Decision Drivers

Prioritized (highest first):

1. **Preserve legitimate live dependency use.** The `MIT OR Apache-2.0` entry is a real, needed dependency; a policy that rejects it forces either dependency churn or a hidden exemption. *(C-4 is the binary scope gate; this driver is the value preference for keeping the tool without rework. They are related but distinct: an option can satisfy C-4 and still score poorly here if it keeps the dependency only by adding complexity or a special case.)*
2. **Preserve the fail-closed intent.** The policy must remain conservative: no unknown, non-asserted (`NOASSERTION`/`SEE LICENSE`), denied, or unallow-listed branch may slip through.
3. **Consistency with the current system specification and GH-170 behavior.** The interpretation should describe the delivered behavior, not create a second policy.
4. **Determinism and auditability.** Each branch's outcome should be explicit and testable, so reviewers can see exactly which identifier failed.
5. **Minimal change and lean process.** Prefer the paved road: no rewrite of an accepted ADR, no new gate, no new dependency.
6. **Precedent clarity.** Record the interpretation once so future changes do not re-litigate it or accidentally implement blanket rejection.

## Decision Rights (DACI)

- **Driver:** `@decision-advisor` — analyzed the ambiguity and authored this record.
- **Decider / Approver:** Juliusz Ćwiąkalski (owner) — acceptance is pending at PR review and is not claimed by this record.
- **Contributors:** `@pm` (GH-187 DEC-3 and Appendix C); `@spec-writer` (specification); `@readiness-reviewer` (finding 3).
- **Required reviewers:** `@reviewer` and `@readiness-reviewer` during delivery; the human owner at PR review.
- **Performers:** `@coder` — implements the deny-list hardening while preserving per-branch parsing.
- **Informed:** `@pm`.

## Evidence, Assumptions & Unknowns

| Item | Label | Source | Impact if false | Confidence |
|------|-------|--------|-----------------|------------|
| ADR-0003 C-2 literally says the gate "fails closed on ... compound expressions", and the metric repeats "compound expressions fail closed". | FACT | `doc/decisions/ADR-0003-oss-monorepo-structure.md` C-2 (L175), license metric (L1202) | The ambiguity this record resolves would not exist, or would be worded differently. | High |
| The live audit parses AND/OR/parentheses and evaluates every identifier branch against the allow-list. | FACT | `scripts/checks/license-audit.ts` (`parseSpdxExpression`, `auditRegistry`) | The interpretation would not match delivered behavior. | High |
| The live registry contains `@biomejs/biome` `MIT OR Apache-2.0` with verdict `approved`. | FACT | `doc/legal/dependency-licenses.yaml` | Blanket rejection would be harmless and this decision would be unnecessary. | High |
| GH-170 delivered the per-branch behavior and the live gate passes. | FACT | GH-170 artifacts; live audit run | The "current behavior" driver would be weaker. | High |
| GH-187 explicitly excludes rejecting all compound expressions and excludes dependency changes. | FACT | `chg-GH-187-spec.md` NG-4, F-6 | Blanket rejection could be considered in scope, changing eligibility. | High |
| `WITH` exception clauses are not supported by the current parser and fail closed. | FACT | `scripts/checks/license-audit.ts` (`WITH` is an unexpected token) | A legitimate `WITH` expression would be rejected; this is a residual, not a contradiction. | High |
| Per-branch allow-listing is an acceptable policy proxy for compatibility. | ASSUMPTION | Policy design; legal compatibility remains a human determination | If rejected, the policy needs a different compatibility model. | Medium |
| The owner will confirm the C-2 determination at PR review as the registry records. | ASSUMPTION | Registry header and GH-187 scope | The policy would be enforced without owner confirmation. | Medium |

## Mental Models & Techniques Used

- **First principles:** separate "what the policy protects against" (an unresolved or disallowed license passing) from "how an expression is spelled" (one token vs many). The protection is per identifier, not per string shape.
- **Inversion:** ask "how could a compound expression smuggle a bad license through?" — by treating the whole expression as one opaque allow-listed string, or by matching prefixes. Both are closed by parsing and per-branch checks.
- **Second-order thinking:** a blanket rejection would be safe in isolation but forces removal or special-casing of a legitimate dependency, which creates pressure for exactly the hidden exemption the policy exists to prevent.
- **Systems thinking:** ADR-0003 C-2, the system spec, the audit, and the registry are four surfaces of one policy. Leaving one surface ambiguous guarantees future drift.
- **Reversibility / least mechanism:** clarify with a linked record rather than rewrite an Accepted ADR; the clarification can be superseded cheaply if policy changes.
- **Opportunity cost:** a new gate or new dependency buys nothing here; the existing parser already implements the needed semantics.

## Alternatives Considered

### Per-Alternative Constraint-Compliance Evaluation

| Alternative | C-1 | C-2 | C-3 | C-4 | Eligibility |
|-------------|:---:|:---:|:---:|:---:|-------------|
| ALT-0 Do nothing (leave wording ambiguous, keep current behavior) | ✅ | ✅ | ✅ | ✅ | Eligible; rejected on drivers |
| ALT-1 Blanket rejection of all compound expressions | ✅ | ✅ | ✅ | ❌ | Not eligible (C-4) |
| ALT-2 Allow-list-only prefix/substring matching | ❌ | ❌ | ❌ | ✅ | Not eligible (C-1, C-2, C-3) |
| ALT-3 Per-branch fail-closed parsing (selected) | ✅ | ✅ | ✅ | ✅ | Eligible; chosen |

Legend: ✅ passes · ❌ fails · ⚠️ passes only via accepted-risk exception (none used).

### Alternative 0 — Do Nothing / Keep Current Approach

- **Eligibility:** Eligible (passes C-1 through C-4 mechanically).
- **Summary:** Leave ADR-0003 C-2's wording untouched, keep the current per-branch audit behavior, and rely on GH-187 DEC-3 (a change-scoped note) to explain the intent.
- **Constraint compliance:** Passes all constraints; the behavior already satisfies them.
- **Driver fit:** Weak on drivers 1, 3, and 6: the authoritative record still reads as blanket rejection, so a future change can implement reading 1 in good faith, and the change-scoped DEC-3 will be buried with GH-187 artifacts.
- **Pros:** Zero effort; no new artifact.
- **Cons:** Leaves the exact contradiction readiness finding 3 identified; invites re-litigation and possible accidental behavior change.
- **Why rejected:** Survives constraints but loses decisively on precedent clarity and consistency; the purpose of this record is to close that gap.

### Alternative 1 — Blanket Rejection of All Compound Expressions

- **Eligibility:** Not eligible (fails C-4).
- **Summary:** Implement ADR-0003 C-2 literally: reject any license string containing `AND`, `OR`, `WITH`, or parentheses.
- **Constraint compliance:** Fails C-4 — the live `@biomejs/biome` entry is `MIT OR Apache-2.0`, so blanket rejection would require removing, replacing, or exempting the dependency or its registry entry, all outside GH-187 scope. It would also contradict the current system specification.
- **Driver fit:** Strong on driver 2 (maximally conservative) but fails driver 1 and driver 3 outright.
- **Pros:** Simplest possible rule; no expression grammar to maintain.
- **Cons:** Breaks a legitimate live dependency; forces churn or a special-case exemption; contradicts delivered behavior and the spec.
- **Why rejected:** Disqualifying C-4 failure; GH-187 explicitly excludes it (NG-4).

### Alternative 2 — Allow-List-Only Prefix/Substring Matching

- **Eligibility:** Not eligible (fails C-1, C-2, C-3).
- **Summary:** Accept an entry when its license string contains an allow-listed identifier, without parsing the expression.
- **Constraint compliance:** Fails C-2 (no parsing; prefix/substring matching is explicitly forbidden). Fails C-1 and C-3 because a string such as `MIT OR SSPL-1.0` contains `MIT` and would pass, silently accepting a denied branch.
- **Driver fit:** Cheap on effort but catastrophically weak on driver 2.
- **Pros:** Trivial to implement.
- **Cons:** Defeats the fail-closed intent; accepts denied or unknown branches hidden inside a compound string.
- **Why rejected:** Disqualifying constraint failures; this is the anti-pattern the policy exists to prevent.

### Alternative 3 — Per-Branch Fail-Closed Parsing (selected)

- **Eligibility:** Eligible.
- **Summary:** Parse the SPDX expression into identifier branches and require every branch to be known, asserted (`NOASSERTION`/`SEE LICENSE` are never accepted), not denied, and allow-listed; the expression passes only when every branch passes.
- **Constraint compliance:** Passes all constraints. C-1: any unresolved, non-asserted (`NOASSERTION`/`SEE LICENSE`), denied, or non-allow-listed branch fails the expression. C-2: branches come from the parser, not string matching. C-3: the existing binding gate is retained and remains fail-closed. C-4: the live `MIT OR Apache-2.0` entry validates unchanged.
- **Driver fit:** Best on drivers 1–4 and 6: keeps the live dependency, preserves fail-closed intent, matches the spec and GH-170 behavior, and produces per-identifier diagnostics. Adequate on driver 5: no new gate, dependency, or ADR rewrite.
- **Pros:** Resolves the ambiguity in favor of the delivered behavior; no dependency churn; explicit, testable branch outcomes; no hidden exemptions.
- **Cons:** Stricter than SPDX OR semantics (an OR expression with any non-allow-listed branch is rejected even if one branch alone would be acceptable); `WITH` expressions remain unsupported; the Accepted ADR's literal text still needs a cross-reference to be discoverable.
- **Why chosen:** Only eligible option that satisfies every constraint and the fail-closed drivers; it is also the current behavior, so the decision records the status quo rather than changing it.

## Decision

- **Decision:** ALT-3. Compound SPDX expressions are parsed with per-branch fail-closed evaluation. No branch may be unknown, non-asserted (`NOASSERTION`/`SEE LICENSE`), denied, or non-allow-listed; the expression passes only when every branch passes. Blanket rejection of all compound expressions is **not** the policy.
- **Rationale (tied to drivers):** ALT-3 preserves the live `MIT OR Apache-2.0` dependency (driver 1), keeps the gate conservative on every branch (driver 2), matches the current system specification and GH-170 behavior (driver 3), yields explicit per-identifier diagnostics (driver 4), and requires no new gate, dependency, or ADR rewrite (driver 5). It also records the interpretation durably so it is not re-litigated per change (driver 6).
- **Decider:** Juliusz Ćwiąkalski (owner) — acceptance pending at PR review; this record does not claim approval.
- **Conditions for revisit:** See `revisit_triggers` in the front matter; primary triggers are a later decision to reject all compounds, a material change to the expression grammar, and any legal review that rejects per-branch allow-listing as a compatibility proxy.

### Relationship to ADR-0003 C-2

This record **clarifies** the compound-expression clause of ADR-0003 C-2. It does **not** amend the accepted text of ADR-0003, does **not** supersede ADR-0003 or any of its constraints, and does **not** change the registry location, allow-list, denied-family, SBOM, notice, or checksum policy.

Specifically, ADR-0003 C-2's phrase

> "it fails closed on unknown, `NOASSERTION`, `SEE LICENSE`, and compound expressions"

is read as:

> "it fails closed on every branch of a compound expression that is unknown, `NOASSERTION`, `SEE LICENSE`, denied, or not allow-listed; a compound expression is not accepted as an opaque whole."

The same reading applies to the license metric at ADR-0003 line 1202 ("unknown and compound expressions fail closed"): unknown identifiers and failing compound branches fail closed. ADR-0003's architecture decision and all other constraints remain in force. Because ADR-0003 is Accepted and immutable, this linked clarification is the mechanism; editing the ADR's C-2 or metric text is a separate owner-authorized editorial change, not part of this record.

### Non-goal: legal compatibility determination

This record interprets the gate's **policy mechanics**. It does not determine that `MIT OR Apache-2.0` or any other identifier is legally compatible with Apache-2.0. License compatibility and the registry verdicts remain a human determination recorded in `doc/legal/dependency-licenses.yaml` and confirmed by the owner at PR review.

### Constraint Compliance Attestation

The chosen alternative satisfies all constraints C-1 through C-4: every unresolved, non-asserted (`NOASSERTION`/`SEE LICENSE`), denied, or non-allow-listed branch fails (C-1); identifiers come from the parser, never from prefix/substring matching (C-2); the existing binding `ts-license-audit` gate is retained without a bypass or new job (C-3); and the live dependency graph, lockfile, and registry entries remain unchanged, including `@biomejs/biome` `MIT OR Apache-2.0` (C-4). No accepted-risk exceptions are taken against any constraint.

## Trade-offs & Consequences

### Positive Outcomes

- ADR-0003 C-2, the system specification, the audit, and the live registry now have one recorded interpretation instead of an implicit one.
- The live `MIT OR Apache-2.0` dependency continues to pass without a special case or dependency churn.
- Fail-closed behavior is preserved per branch, including denied branches inside nested AND/OR expressions.
- Failure output can name the exact identifier that failed, which is more actionable for reviewers than "compound expression rejected".
- The decision records the status quo, so delivery risk is low: no behavior change is required beyond GH-187's deny-list hardening.

### Negative Outcomes

- **Stricter than SPDX OR semantics.** An OR expression with any non-allow-listed branch is rejected even if the other branch alone would be acceptable. This is deliberate conservative policy, but it can reject a legitimate dual-licensed package until the allow-list is extended.
- **`WITH` expressions remain unsupported.** The current parser treats `WITH` as an unexpected token, so an exception clause fails closed. Supporting `WITH` would be a new decision.
- **Discoverability gap.** ADR-0003's literal wording still says "compound expressions fail closed"; a reader who does not follow the link to this record may still misread it. An owner-authorized editorial cross-reference or amendment would close this residual.
- **No legal determination.** Per-branch allow-listing is a policy proxy; it does not prove compatibility.

### Unresolved Questions

- [ ] Owner: accept this record at PR review and confirm that the C-2 determination remains as recorded (owner: Juliusz Ćwiąkalski).
- [ ] Owner: should ADR-0003 C-2 and the line-1202 metric be editorially amended to cite this clarification, or is the linked record sufficient? If amended, schedule it as a separate owner-authorized editorial change (owner: Juliusz Ćwiąkalski; @pm).
- [ ] Whether to support SPDX `WITH` exception clauses is a future decision, not part of GH-187 (owner: @pm / @decision-advisor).
- [ ] Legal compatibility of each approved identifier remains a human determination recorded in the registry (owner: Juliusz Ćwiąkalski).

## Implementation Plan

1. Keep the audit's tokenizer and parser (AND/OR/parentheses) and evaluate every identifier branch against the deny list first, then the allow-list, so deny wins over allow on each branch (GH-187 F-2/F-6). No behavior change beyond the deny-list hardening is required by this record.
2. Ensure the GH-187 test matrix covers: the live allowed compound (`MIT OR Apache-2.0`) passing; a compound with one denied branch failing for OR, AND, and nested forms; unknown, `NOASSERTION`, `SEE LICENSE`, and `LicenseRef-*` branches failing; and `WITH` failing closed.
3. Reference this record from the GH-187 change artifacts (spec/plan) as the authoritative interpretation of DEC-3/Appendix C (owner: @pm).
4. On acceptance, decide whether to add a cross-reference in ADR-0003's `links.decisions` or to editorially amend the C-2/metric wording; do not change the ADR without owner authorization.
5. During system-spec sync, describe the per-branch interpretation in the feature spec's license-registry section.
6. Present this record at PR review; it stays `Proposed` until the owner accepts.

## Verification Criteria

- Live registry validates with zero failures; `@biomejs/biome` `MIT OR Apache-2.0` passes — Window: every PR (`pnpm check`, `ts-license-audit`).
- `MIT OR SSPL-1.0` (and the AND/nested equivalents) fails naming the denied branch — Window: every PR (mutation tests).
- `NOASSERTION`, `SEE LICENSE`, `LicenseRef-*`, an unknown identifier, and an empty license each fail closed — Window: every PR (mutation tests).
- A `WITH` expression fails closed under the current parser — Window: every PR (mutation test).
- No dependency, lockfile, or existing registry-entry change is required — Window: GH-187 review and audit.
- The binding `ts-license-audit` job remains the only license gate, with no bypass — Window: CI topology/bindingness invariants on every PR.

## Confidence Rating

**High** for the interpretation itself: it matches delivered code, the current system specification, GH-170 behavior, GH-187 DEC-3/Appendix C, and the live registry. **Medium** for whether a linked clarification is sufficient for future readers versus editing ADR-0003's text; that is an owner call recorded above. This rating is not evidence of legal license compatibility, which remains a human determination.

## References

- ADR-0003 — OSS Tooling Monorepo Structure, C-2 (line 175) and license metric (line 1202): `doc/decisions/ADR-0003-oss-monorepo-structure.md`
- GH-187 change specification, DEC-3 and Appendix C: `doc/changes/2026-10/2026-10-31--GH-187--license-registry-hardening/chg-GH-187-spec.md`
- GH-187 readiness review, iteration 1, finding 3: `doc/changes/2026-10/2026-10-31--GH-187--license-registry-hardening/readiness-review/readiness-iter-1.md`
- Current system specification, "License registry": `doc/spec/features/feature-monorepo-scaffold-toolchain.md`
- License registry: `doc/legal/dependency-licenses.yaml`
- License audit: `scripts/checks/license-audit.ts`
- SPDX license expression syntax: <https://spdx.github.io/spdx-spec/>
