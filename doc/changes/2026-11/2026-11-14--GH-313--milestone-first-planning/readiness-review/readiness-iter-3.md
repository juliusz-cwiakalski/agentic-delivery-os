# Readiness review — iteration 3 (GH-313)

Verdict: READY
Date: 2026-11-14
Artifacts reviewed: spec (canonical ordered contract, 14-row Appendix C table), test plan revision 1.2, plan revision 1.1, PDR-0005, pm-notes, issue #313.

Facet summary: all ten facets PASS.

Blocking findings: none.

Non-blocking findings carried into delivery:

1. The two tracker labels (`needs-milestone`, `backlog-capture`) do not exist yet. Phase 3's tracker instructions and the PM-lane rollout create them; the check never creates labels.
2. TC-EVID-001's primary example endpoint returns 404 on this tracker; the working read is `gh issue list --milestone "<title>" --state all` or `GET /repos/{owner}/{repo}/issues?milestone=n&state=all&per_page=100`.
3. Test plan prose still refers to the spec's earlier eight-row table; the tables are semantically aligned now.
4. TC-CHK-001 step 3 must narrow rule 4d to edited/labeled/unlabeled/reopened so it does not contradict row 12 (`demilestoned` + marker -> restored).
5. Two representative rows are answered by the ordered rules but not enumerated: `demilestoned` + flag present + marker absent, and `unlabeled`/`reopened` + flag present.
6. Spec DEC-10 says "two scenario seeds"; Appendix C, plan 5.4, and TC-PLAN-004 define five. Align DEC-10 to "at least two, delivered as five".
7. Plugin freshness on a dirty tree: assert after the phase commit or on a second clean build.
8. Plan phase 3's binding line omits AC-F4-1 / DoD-12 / TC-TPL-002 although the spec-writer prompt half lands there.
9. Version bookkeeping: spec history still v1.0; plan header cites test plan v1.1 while the log is 1.2; test plan §10 says 1.1.
10. PDR-0005's citation of `.opencode/agent/pm.md` lines 509-510 does not show the milestone argument; the underlying MCP fact is correct.
11. Spec §7.2 lists the PR-instructions template among unchanged templates; AC-F4-2 lists five without it. No functional gap.
12. pm-notes `clarify_scope.started` is later than its completed timestamp (authoring-time zone slip). Do not hand-edit; leave the record as written.

Accepted dispositions from iterations 1 and 2 remain valid.
