---
id: TOOLING-INCEPTION-PHASE-2-QUESTIONS
status: Draft
created: 2026-10-31
last_updated: 2026-10-31
owners: [bootstrapper]
document_classification: working-analysis
links:
  related_changes: [GH-200]
summary: "Gate 2 decisions on M0 evidence, proposed coverage refinements, and deferred permanent graduation."
---

# Phase 2 open questions

IDs continue OPEN-Q1 through OPEN-Q6. Human answers are pending; proposals
below are not decisions. Phase 3 waits for explicit gate 2 approval.

## OPEN-Q7: M0 remainder and outcome-validation protocol

**Status:** OPEN

Approve the [M0 remainder view](../analysis/phase-2-scope-and-coverage.md),
[assumptions](../analysis/assumptions.md), and [risks](../analysis/risks.md),
including proposed role ownership and review triggers? M0 is 11/20 merged
implementations, but only 10/20 issues CLOSED in the live query: GH-177's
PR201 merged while the issue remains OPEN. GH-184/PR203 is still open, with
eight other implementation stories pending. Proposed follow-up: PM/coordinator
reconciles GH-177 closeout evidence through the normal delivery path.

For XC-010, who owns the M0 pilot protocol and its explicit AC: an existing
story amendment or a dedicated follow-up? Proposed minimum: per-engine
eligible paths and exposure counts, token/artifact comparison, two-week
window, divergence/incident log and shell fallback. Owner decides how failures
affect the observation window; no clean period is claimed here.

### Answer

Pending owner review.

## OPEN-Q8: direct owner-attention measurement

**Status:** OPEN

The approved NSM remains owner attention per accepted delivery. GH-186's
existing AC establishes source-traced baseline numbers, but not direct
attention collection or an accepted-delivery denominator (XC-009). Approve
a proposed GH-186 refinement defining human interventions or attention-time
capture, acceptance boundary, missing-data handling, sampling window and
quality/rework guardrails? Owner/PM would choose a lightweight manual baseline
first; automated measurement is a later refinement, not added scope here.
No thresholds, sample sizes or measurements have been fabricated.

### Answer

Pending owner review.

## OPEN-Q9: route the concrete coverage gaps

**Status:** OPEN

Choose existing-story AC refinements, dedicated follow-ups, or explicit
deferral with rationale for:

- XC-005: name the closeout write-capability implementation and owner;
  GH-183/GH-189 currently depend on read-only seeds. Clarify capability-aware
  conformance flows without claiming unsupported mutations succeed.
- XC-007: status output budget, visible truncation/omissions and caller
  actionability evidence, proposed at GH-175.
- XC-003: interrupted closeout step replay and artifact verification,
  proposed as refinement of existing GH-183 restart-convergence AC.
- XC-013: whether an explicit early local-completeness check is required
  in M0 or remains at its existing M4-S6 acceptance home.
- XC-008: reconcile GH-187 against the already passing license audit/CI
  job, including policy scope, denied-license cases and owner determination
  evidence. Enforcement is present; issue closure is not inferred.

These are proposals only. No issue, status, dependency or canonical AC was edited.

### Answer

Pending owner review.

## OPEN-Q10: approve deferred tribal-knowledge graduation

**Status:** OPEN

Approve the [13-item audit and proposed destinations](../analysis/tribal-knowledge-graduation.md)?
Proposed route: phase 4 glossary navigation plus thin UL pointing to concept
and spec owners, keeping primitive definitions in the catalogue. TK-09 is
corrected to distinguish profile from profile class. Already housed facts
need no duplicated rules or decisions. TK-05's shared-hotspot union convention
does not graduate without separate explicit owner approval and supporting
evidence. For TK-03, should punctuation remain run-specific or become a narrow
project writing-preference proposal in phase 4?

This approves a later writing plan, not a claim permanent homes were updated.

### Answer

Pending owner review.

## OPEN-Q11: route observed integration-document defects

**Status:** OPEN

XC-011 identifies duplicate metadata keys in the current glossary and state
spec, plus conflicting duplicate glossary term rows after the integrated
deliveries. Approve a targeted correction through an owner-selected delivery
route, or explicitly authorize the bootstrapper's later bounded reconciliation
of these existing homes? Proposed scope: strict metadata parse and a combined
provider/verify content review, without inventing a global merge-union rule.

The original mined record and repo-analysis statements about graduation and
missing license enforcement also need later reconciliation if those analysis
records are maintained; their corrections are documented in these new drafts.
No existing file was overwritten for this task.

The forbidden-literal check also fails on 18 unregistered-document membership
findings across inception and the north star, including all six new drafts.
Approve an owner-selected registry/classification update route before claiming
the branch's gates green? The registry is outside this drafting allowlist and
was not edited. This is a membership failure, not a detected private literal.

### Answer

Pending owner review.
