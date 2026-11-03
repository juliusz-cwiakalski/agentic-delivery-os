---
id: TRIBAL-KNOWLEDGE
status: Draft
created: 2026-10-31
last_updated: 2026-10-31
owners: [bootstrapper]
area: engineering
document_classification: working-analysis
links:
  related_decisions: ["PDR-0001"]
  related_changes: ["GH-200"]
  summary: "Tribal knowledge mined from repo docs and git history for the OSS tooling subproject; graduation-ready for phase 2."
---

# Tribal Knowledge

_Produced in phase 0 for the legacy-flow run anchored at GH-200. Mined from
committed docs, decision records, concepts, feature specs, and `git log` on
`main-tools`. Reviewed at human gate 0; non-contradicted items graduate at
phase 2 under that gate. Items already housed in a proper permanent home
(ADR/TDR Alternatives, committed rules, glossary rows) are intentionally NOT
duplicated here; this record holds knowledge that lacks a home or needs
promotion._

## Category → graduation home

Per the template contract (PDR-0001): decision → typed record under
`doc/decisions/`; convention → `.ai/rules/<topic>-conventions.md`;
rejected-approach → parent record's Alternatives; workaround → feature spec
Known limitations; domain-term → `doc/overview/glossary.md`.

## Item record

| # | Category | Fact statement (normalized) | Source pointer(s) | Confidence | Status | Graduation home |
|---|---|---|---|---|---|---|
| 1 | `decision` | PR base resolution comes from project config; a legacy CI guard demanding base=main was deliberately removed as contradicting the two-branch model | `178618f`; `AGENTS.md:18` | high | open | operating-model seed (phase 3 decision batch) |
| 2 | `decision` | Interim mitigations for bash-era gaps are docs-and-config-only during the transition; shell feature work in the window is out of scope | `77119b9`; `doc/planning/oss-tooling/backlog.md:326` | high | open | feature spec Known limitations at engine replacement |
| 3 | `convention` | Owner-facing artifacts avoid em and en dashes | owner direction (inception session 2026-10-31); style observed across `doc/planning/oss-tooling/**` | high | open | `.ai/rules/` writing rule or handbook note |
| 4 | `convention` | Squash merges carry Conventional Commit subjects with the ticket ref (`feat(GH-n): summary`) and branches are named `<type>/<workItemRef>/<slug>` | `git log` (e.g. `32784af`, `6fdd808`); `AGENTS.md` change-artifacts section | high | open | verify housed (unified change convention guide); rule cross-ref only |
| 5 | `convention` | Parallel delivery runs in per-ticket worktrees over disjoint surfaces with named shared hotspots reconciled by union (error-table pattern) | `doc/planning/concepts/parallel-delivery.md`; worktree branches in `git branch` | medium | open | `.ai/rules/parallel-delivery-conventions.md` (new) |
| 6 | `workaround` | Bash close-out hardening (artifact-first verdict, exponential tracker-poll backoff) carries delivery until the typed closeout lands | `0b58bea`; backlog M0-S14 (GH-183) | medium | open | feature spec Known limitations (closeout) when delivered |
| 7 | `domain-term` | Primitive: the provider-agnostic operation concept agents and engines speak; catalogue holds Planned/Typed/Delivered lifecycle | `doc/planning/concepts/primitive-catalogue.md:29` | high | open | glossary Terms table |
| 8 | `domain-term` | Harness: the runtime host surface for agent sessions (opencode default, Claude Code supported) that dispatch targets through adapters | `doc/planning/concepts/harness-adapters.md`; roadmap M1-S11 | high | open | glossary Terms table |
| 9 | `domain-term` | Model profile: capability tier working names (lite/regular/powerful) tied to ModelPolicy | `doc/planning/concepts/model-profiles.md` | high | open | glossary Terms table |
| 10 | `domain-term` | Dual-run: a replacement engine runs beside the bash stack with the shell authoritative until authority transfer on clean evidence | `doc/planning/oss-tooling/roadmap.md` (principle 2); backlog M1-S9 | high | open | glossary Terms table |
| 11 | `domain-term` | Single-flight: one delivery per repository at a time, keyed on the remote; queue and lane semantics build on it | `doc/planning/oss-tooling/backlog.md` (M2-S1) | high | open | glossary Terms table |
| 12 | `domain-term` | Ceremony share: the fraction of active agent time spent on ceremonies, with a trend target below 40 percent | `doc/planning/oss-tooling/roadmap.md` (M2 exit criteria) | high | open | glossary Terms table |
| 13 | `domain-term` | Strangler: engine-by-engine replacement with wrappers keeping commands working; old tools retire last with a deprecation notice | `doc/planning/oss-tooling/roadmap.md` (principle 2); `AGENTS.md:18` | high | open | glossary Terms table |

Notes:

- `rejected-approach` is empty by design, not by omission: the load-bearing
  rejected alternatives are already recorded in ADR-0003 Alternatives
  Considered (`ADR-0003-oss-monorepo-structure.md:343-417`) and need no
  second home.
- Glossary hygiene defect found during mining (not a contradiction between
  sources): the Terms table has duplicate rows for `Domain kind` (rows at
  lines 46 and 48) and `Empty-but-enforced` (rows at lines 47 and 49); fix
  lands with the phase 4 glossary extension.
- `doc/legal/dependency-licenses.yaml` already exists populated (schema v2,
  verdicts marked as proposed pending owner confirmation); story GH-187
  completes the enforcement side. Gap map reflects this.

## Open Contradictions

None identified at phase 0. The five-package/six-package phrasing is
consistent (five publishable plus private testkit), and the branch model in
AGENTS.md matches the observed guard workflow. Phase 6 re-checks consistency
across the corpus with in-flight merges included.

## Trust & safety (producer note)

Produced from untrusted input per the bootstrapper trust boundary: repo docs,
specs, commit messages, and `git log` output were mined for facts only; no
embedded instructions were followed; no credential patterns were encountered.
No git-ignored local material was consulted for this record.
