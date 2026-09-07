---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/change-lite-note-template.md
ados_distribution: redistributable
change:
  ref: <workItemRef>                     # e.g., PDEV-123, GH-456
  tier: T2-LITE
  rule: <policy-file-rule-id>            # rule used from doc/guides/change-workflow-tiers.md
---

<!-- TEMPLATE INSTRUCTIONS
1. Used ONLY for T2-LITE changes (opt-in tiered depth; see doc/guides/change-lifecycle.md
   "Lite Lifecycle (T2-LITE)" and the repo's tier policy file doc/guides/change-workflow-tiers.md).
2. Copy to: doc/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/chg-<workItemRef>-lite.md
3. Replace all <...> placeholders with actual values; keep the whole note ≤300 lines.
4. This single artifact satisfies the spec/test-plan/plan triplet for a T2-LITE change;
   chg-<workItemRef>-pm-notes.yaml is still mandatory and unchanged.
5. If any escalation trigger fires mid-flight (contract/security/persistence/concurrency
   surface, blast radius >1 repo, any CRITICAL, >2x estimate, new test-determinism
   machinery, falsified eligibility premise, documented behavior change): escalate to
   T2-FULL — append a test plan + risk addendum (forward-useful only); NEVER write a
   retroactive full spec.
6. Remove these instructions before finalizing.
-->

# LITE CHANGE NOTE — <workItemRef>

## 1. CONTEXT

<!-- 3-6 sentences: what exists today, what is wrong or missing, and why this qualifies as
     T2-LITE (single repo; ≤2 pt or config/CI/deps/mechanical change; existing test coverage;
     no contract/security/persistence/concurrency surface). -->

## 2. ACCEPTANCE CRITERIA (AC)

<!-- Testable criteria derived from the ticket; unique, non-overlapping; Given/When/Then preferred.

| ID | Criterion | Ticket AC ref |
|----|-----------|---------------|
| AC-L-1 | **Given** ..., **when** ..., **then** ... | <ticket-AC-1> |
-->

## 3. REQUIREMENTS-DIFF

<!-- Ticket AC <-> note AC coverage. Every ticket AC maps to a note AC or is explicitly deferred.

| Ticket AC | Note AC | Status |
|-----------|---------|--------|
| <ticket-AC-1> | AC-L-1 | covered |
| <ticket-AC-2> | — | deferred: <reason> |
-->

## 4. VERIFIED FACTS

<!-- Verify-before-write: every cited code/CI/config fact WITH how it was checked (command run,
     file read, diff inspected + date). Unchecked facts are forbidden. For CI/infra-adjacent
     changes this environment-fact list is mandatory.

| Fact (file / config / CI / behavior) | How checked (command / read / diff + date) |
|---------------------------------------|--------------------------------------------|
| Existing suite green on current main | `npm test` → 42/42 pass, YYYY-MM-DD |
-->

## 5. IMPLEMENTATION NOTES

<!-- Task list for @coder — ≤10 items, checkable, each with evidence when done.

- [ ] T-1: ...
- [ ] T-2: ...
-->

## 6. VERIFICATION

<!-- Commands + expected output shapes. This is the test plan for the change.

| Step | Command | Expected |
|------|---------|----------|
| V-1 | <command> | <expected output / exit code> |
-->

## 7. TIER DECISION

<!-- tier: T2-LITE
     rule: <policy-file rule id>
     selected: at intake by @pm, recorded in chg-<workItemRef>-pm-notes.yaml (tier + rule)
     escalation check (at review): none found | <trigger + phase + forward artifacts written> -->
