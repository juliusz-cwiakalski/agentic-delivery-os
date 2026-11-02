---
id: TOOLING-INCEPTION-RETRO-PHASE-4-FAILURE-PROPAGATION
status: Draft
created: 2026-11-02T16:10:26+01:00
phase_scope: 4
topic: "Verify failure propagation rather than infer it from CI comments"
outcome: improve
owners: [bootstrapper]
document_classification: working-analysis
summary: "A read-only negative control exposed a gap between shell-test CI intent and command semantics."
---

# Check the checker boundary

## What happened

Reopening addendum, 2026-11-02: under OPEN-Q20 the 37 exact memberships were
registered and the guard rerun. Membership failures cleared, exposing 11 literal
violations in six existing files. What went well: no cap, rule, seed or exclusion
was weakened; the exact glossary additions and explicit setup/catalog dispositions
were delivered. Pattern to repeat: registering previously unscanned documents
is not equivalent to a clean content scan. Stop and route newly exposed content
outside authorization rather than silently expanding repairs into historical inputs.

The [Phase 4 audit](../analysis/phase-4-quality-baseline.md#ci-baseline-and-concrete-failure-propagation-finding)
found shell-suite execution through `find -exec` described as fail-fast under
`set -e`. A read-only control with an always-failing child returned zero from
find. No product suite, workflow repair or installation was run.

## What went well

Checking actual failure propagation, rather than trusting configured test
presence or explanatory comments, produced a concrete bounded finding without
mutating shared framework files. Existing evidence labels prevented a false
green-suite claim.

## Improvement

When auditing a test aggregator, inspect how every child failure reaches its
caller. Propose a synthetic deliberately failing child as a regression control
when routing a repair. Keep that repair separate from docs-only inception and
retain the human gate. [OPEN-Q19](../open-questions/phase-4-open-questions.md#open-q19-shell-suite-ci-failure-propagation)
records the routing choice; this note does not approve it.
