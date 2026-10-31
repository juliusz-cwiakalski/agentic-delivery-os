# Readiness Review Iteration 1

Verdict: NOT_READY
Work Item: GH-188
Date: 2026-10-31
Pause Required: no

## Facet Summary
- spec_completeness: PASS
- ac_quality: PASS
- plan_coverage: PASS
- test_traceability: PASS
- cross_artifact_consistency: FAIL
- decision_capture: PASS
- system_spec_consistency: PASS
- plan_doc_update_coverage: PASS
- plan_code_area_coverage: PASS
- dod_defined: PASS

Blocking findings: 1 (major). All other findings are advisory. No human input required; the remediation is a mechanical artifact correction, not a decision.

## Verification Performed
- Read spec v1.2, test plan v1.1, plan v1.0, pm-notes; ADR-0004/0005/0006 (all Proposed); backlog M0-S19/M0-S6 (doc/planning/oss-tooling/backlog.md lines 363–384, 180–192); doc/spec/features/feature-adapter-ports.md.
- Verified plan code-reality claims against the tree on `feat/GH-188/client-seeds-trap-catalogs` (HEAD f35ec79): provider subpath placeholders exist (`packages/adapters/src/{github,gitlab,jira}/index.ts`); `WorkItem` currently has required `comments` and no `updatedAt` (ports.ts L103–109); `SECRET_READ_ALLOWLIST` = exactly 4 entries (1 credential-material + 3 configuration-environment-source); `runtime-apis-confinement` pathNot excludes provider subpaths (.dependency-cruiser.cjs L208–222); ambient-globals guard scopes the `fetch` ban to core neutral tiers (scripts/checks/ambient-globals.ts L13–27); ADAPTER_SUBPATHS already registers github/gitlab/jira (tests/boundaries/harness.ts L28); changeset fixed group = the five packages; all referenced existing test files/fixtures present (capabilities.ts, credential-port.test.ts, license-audit.*, port-contract-inventory.*, secret-boundary/cases.ts, boundaries fixtures/registry, v1-contract-inventory.json, tests/types/tsconfig.json).
- Ticket-context note: tracker MCP access was unavailable in this session; ticket ACs and the ticket-recorded implementation basis (decision comment 6536692124) were corroborated against the committed backlog M0-S19 entry (verbatim match) and pm-notes. Recorded as context, not as a gap.

## PM-Flagged Judgments
1. **OQ-C — GitLab trap-entry split: LEGITIMATE (confirmed).** `GL-MERGE-STATUS-ASYNC` and `GL-MERGE-STATUS-MULTIVALUED` are distinct observable provider behaviors (asynchronous resolution values vs `merge_status`/`detailed_merge_status` value disagreement), each with its own fixture and distinct assertions (TC-GITLAB-003 steps 2 and 3). The primary NFR-2 requirement — 100% of ticket-named quirk families covered — holds regardless of entry count; OQ-3 explicitly permits the test plan to refine granularity. Not minimum-gaming: promoting variants to entries is more granular than the OQ-3 default, not less truthful. Advisory: the spec's GitLab ≥3 numeric minimum exceeds the two ticket-named GitLab quirk clauses — family coverage, not entry count, should remain the judged criterion for future catalogs.
2. **ADR-0004/0005/0006 Proposed status: ACCEPTABLE for delivery.** Each record names the owner as decider with acceptance pending at the GH-188 PR review; plan P10-2 carries the acceptance handoff; governance lists @readiness-reviewer as a required reviewer (this gate). Non-blocking, provided the PR explicitly presents all three records (and the ADR-0003 editorial pointer) for owner acceptance — see finding 5.
3. **Hand-authored synthetic fixtures: fidelity-risk acceptance is coherent (RSK-2 + OQ-H provenance labels + M0-S20 revalidation), BUT the artifact set currently contradicts itself on provenance — see finding 1. Acceptable only after that correction.**
4. **AC-F8-1 as process evidence: ACCEPTABLE.** Ticket-mandated record-place; comment 6536692124 recorded in pm-notes and plan; TC-PLAN-001 verify-only with a basis-vs-delivered-code match step in P10-4. Correctly the only manual TC.

## Findings

1. [major] cross_artifact_consistency — chg-GH-188-spec.md F-6 / DM-3 / §6 flow 5 / §12 assumption 1 (vs chg-GH-188-plan.md Context "OQ-H", and chg-GH-188-test-plan.md §6)
   Gap: The spec defines fixtures as "provider responses captured at authoring time against controlled or scratch tenants" (F-6), DM-3 as "a committed provider response captured at authoring time", flow 5 as "a maintainer captures the provider response … against a controlled tenant", and §12 assumes recorded fixtures represent live responses; test plan §6 repeats "recorded at authoring time against controlled/scratch tenants". The plan (OQ-H) — reflecting reality — adopts **hand-authored synthetic captures** with provenance markers because no live tenant is accessible. A hand-authored synthetic fixture is not a "provider response captured against a tenant": the three artifacts disagree on the provenance of the change's central evidence asset. Consequences if delivered as-is: the coder follows the plan, the phase-8 reviewer audits against a spec whose fixture definition the delivery violates (fail-or-wave-through ambiguity), and the spec's "single source of truth" status (test plan §8.2) is broken on exactly the artifact the ticket AC-1 names.
   Blocking: YES.
   Suggested remediation target phase: specification
   Suggested fix: One correction pass aligning fixture provenance across all three artifacts: spec F-6/DM-3/flow-5/§12 define the authorized fallback — hand-authored synthetic captures shaped on current provider REST responses, provenance-labelled (e.g., `hand-authored-synthetic <date>`), sanitization and reference-stability rules applying identically, M0-S20 live runs as the fidelity gate (mirror of plan OQ-H / test-plan OQ-H). Test plan §6 gets the matching one-line correction (test_planning, may ride the same reopen).

2. [minor] system_spec_consistency — ADR-0005 (change-owned, Proposed), Evidence/Assumptions table, row "Network `fetch` counts as a runtime API under the confinement rule's dependency-types matching; the seeds cannot compile clean without the extension."
   Gap: Verified against the repo: `runtime-apis-confinement` matches `to: { dependencyTypes: ["core"] }` — imported core modules only — and the ambient-globals guard bans `fetch` only in core neutral tiers. A pure global-`fetch` client with no core imports cruises clean without the P2 admission, so the "cannot compile clean" FACT row is overstated. The decision itself is unaffected (structural representability of provider I/O in its declared home, reason-bearing reviewed growth, and future runtime imports justify ALT-1 independently), but a Proposed ADR presented for owner acceptance should not carry a mechanically inaccurate FACT row.
   Blocking: no.
   Suggested remediation target phase: specification
   Suggested fix: Correct the evidence row via @decision-advisor in the same correction pass (the record is change-owned); optionally add a revisit trigger noting the enforcement gap — global `fetch` outside admitted subpaths is currently unpoliced (ambient-globals scope stops at core neutral tiers) — as a future boundary-hardening candidate.

3. [minor] cross_artifact_consistency — chg-GH-188-test-plan.md §2 References
   Gap: Stale spec-section ranges from test-plan v1.0: "8.3 (DM-1 to DM-6)", "14 (OQ-1 to OQ-4)", "15 (DEC-1 to DEC-6)" vs spec v1.2's DM-1..8, OQ-1..6, DEC-1..8. Substantive coverage is current (§3.2 has DM-7/DM-8 rows; ADR-0006 references present); cosmetic staleness only, but it misdirects readers of the reference list.
   Blocking: no.
   Suggested remediation target phase: test_planning
   Suggested fix: Update the §2 parenthetical ranges to DM-1..8 / OQ-1..6 / DEC-1..8; may ride the finding-1 correction pass.

4. [nit] ac_quality — chg-GH-188-spec.md §9 NFR-2
   Gap: The GitLab ≥3 entry minimum exceeds the two ticket-named GitLab quirk clauses; the minimum is only reachable via variant-level granularity (OQ-C, confirmed legitimate above). A count-based threshold invites entry-count inflation as a passing strategy in future catalogs.
   Blocking: no.
   Suggested remediation target phase: specification
   Suggested fix: Optional: restate NFR-2 for GitLab as "every ticket-named quirk clause covered, ≥3 entries via declared variant granularity" so the count and the granularity allowance are visibly linked (removes the apparent tension without changing the requirement).

5. [advisory] decision_capture — chg-GH-188-plan.md P10-2 / PR handoff
   Gap: ADR acceptance rides the PR review; nothing currently obliges the PR description to surface ADR-0004/0005/0006 (and the ADR-0003 editorial pointer) for explicit owner acceptance, risking the records lingering in Proposed after merge.
   Blocking: no.
   Suggested remediation target phase: delivery_planning
   Suggested fix: Add to P10-2/P10-5 handoff text: the PR description must list the three ADRs with their acceptance-pending status so the owner accepts (or rejects) them at review; rejection reopens the change per lifecycle.

## Gate Result

NOT_READY. Reopen `specification` (primary: finding 1; optionally findings 2 and 4 in the same pass) and `test_planning` (findings 1-mirror and 3) for one correction pass, then re-run this gate. No facet other than cross_artifact_consistency fails; traceability, coverage, code-area mapping, DoD definition, and decision routing are all sound, so iteration 2 is expected to reach READY on correction of the fixture-provenance contradiction.
