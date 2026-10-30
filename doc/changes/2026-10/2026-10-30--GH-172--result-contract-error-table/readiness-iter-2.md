---
change:
  ref: GH-172
  gate: definition-of-ready
  iteration: 2
  verdict: READY
  reviewed_at: "2026-10-30T03:20:00Z"
  reviewer: readiness-reviewer
  artifacts:
    spec: chg-GH-172-spec.md (v1.1)
    test_plan: chg-GH-172-test-plan.md (v1.2)
    plan: chg-GH-172-plan.md (v1.1)
    pm_notes: chg-GH-172-pm-notes.yaml
---

# Definition of Ready — verdict record

## Iteration 2: READY (2026-10-30T03:20Z)

All ten facets PASS. Iteration-1 findings verified substantively resolved (not cosmetic):

1. **[major, resolved]** Sync-check recognizer semantics: §4.4 now defines Level A (scan-level namespace rule; foreign-namespace literals ignored AND uncounted), Level B (strict source-entry validation), Level C (corpus as named default input; `tests/fixtures/result/code-corpora/**` excluded from S3 — green path reachable). Exactly one semantics survives everywhere; plan tasks 5.2/5.4 mirror verbatim; false-positive corpus rows still assert recognizer verdicts (no weakening).
2. **[minor, resolved]** TC-REDACT-003 split case bound via fragment registration: contiguity clamp (§4.5 item 2), per-fragment zero-occurrence + byte-exact golden doubling as vacuity guard, A-T13, plan D1/tasks 3.2/4.1/4.2 mirrored.
3. **[minor, resolved]** TC-CLASSIFY-002 scoped to classify-level route distinctness; dispatch-level proof cross-referenced to TC-CONTAIN-001 (Phase 3).
4. **[nits, resolved]** Survey verdict-7 reference note; AC-F8-1 scope via §4.4 + A-T12.

## Non-blocking observations (for @reviewer/@coder)

- **[nit, persistent]** Plan D10 still says "twenty `scripts/checks/*.ts` invariants"; actual count 19 today (21 after this change). Decision content unaffected; may ride any future plan revision — not reopen-worthy.
- **Corpus exclusion is load-bearing**: confirm the shipped S3 exclusion glob matches `tests/fixtures/result/code-corpora/**` exactly (task 5.2: "nothing broader") — the green path depends on it.
- **Survey** retains pre-DEC-13 singular fallback phrasing by design ("referenced, not edited"); @doc-syncer (phase 7) must source fallback semantics from spec DEC-13, not the survey.
- pm-notes `test_planning` completed (03:12Z) after `delivery_planning` (02:52Z) — expected reopen-flow artifact, narrated in notes.

## History

- Iteration 1 (2026-10-30T03:05Z): NOT_READY — cross_artifact_consistency FAIL (findings above); test_planning reopened, remediated in commit 6ca5b52.
- Decision routing: none pending; no human input required; no system/precedent decisions surfaced.

**Gate result: READY — delivery (phase 6) unblocked.**
