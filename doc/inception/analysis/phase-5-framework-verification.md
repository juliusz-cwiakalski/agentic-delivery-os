---
id: TOOLING-INCEPTION-PHASE-5-FRAMEWORK
status: Draft
created: 2026-11-02
last_updated: 2026-11-02
owners: [bootstrapper]
document_classification: working-analysis
links:
  related_changes: [GH-200]
summary: "Verify-only framework audit: project configuration, tracker mapping, documentation navigation and bounded follow-up routes."
---

# Phase 5 framework verification

## Scope and evidence boundary

Gate 5 draft only, inspected at HEAD `59c9749`, with integrated `main-tools`
`3ebc61f`. The [state](../inception-state.yaml) records Gate 4 approval and
Phase 5 in progress. [Owner scope](../inputs/tooling/02-scope-direction.md)
overrides the generic [Phase 5 generation steps](../../guides/project-inception.md):
existing framework files are inputs, verified, never regenerated. Single branch,
single PR to `main-tools`; neither another branch nor a phase PR is created here.

Statuses below mean **existing** (inspected configuration), **gap** (specific
mismatch or missing artifact), **fallback** (documented safe default), or
**not-reverified** (execution/effectiveness outside this audit). Presence does not
mean operational PASS. No framework, source, template, registry, index, state or
generated plugin was changed. No installation, prompt regeneration, tracker
mutation, commit, push or merge was performed.

## Artifact-by-artifact verification

| Artifact | Evidence and configuration status | Scope / follow-up |
|---|---|---|
| [AGENTS.md](../../../AGENTS.md) | existing: lifecycle table, agent/command inventory, tracker/PR/decision/review configuration references, branch convention, memory kernel and generated-plugin ownership. | Complete entry-point coverage for this audit; actual agent behavior not-reverified. Tooling branches originate from `main-tools`; `main` stays frozen. |
| [PM instructions](../../../.ai/agent/pm-instructions.md) | existing: GitHub Issues repository, `GH-` identity, seven state/label mappings, human authorization for ticket creation, artifact paths and decision references. All mapped labels exist remotely. | gap: backlog-only-tracker wording conflicts with accepted roadmap/backlog/registry planning homes; distribution wording is broader than root rules. Route clarification, not tracker edits. |
| [PR instructions](../../../.ai/agent/pr-instructions.md) | existing: GitHub host/repository match origin; MCP preference and CLI fallback, auth verification, explicit `main-tools` base and frozen `main` explanation. | CLI read access verified; MCP availability not-reverified. Never infer permission to merge from configured operations or authentication. |
| [Decision instructions](../../../.ai/agent/decision-instructions.md) | existing: per-type IDs, flat canonical homes, five types, status lifecycle, human R2/R3 acceptance, process/template/index references. | No new record or acceptance needed for this verification. Proposed records remain Proposed; technical direction is not a new vote. |
| [Code-review instructions](../../../.ai/agent/code-review-instructions.md) | existing: both prompt and typed stacks, branch naming, security, TS boundaries and test-evidence priorities. | gap: blanket header requirements conflict with scoped root policy; see configuration findings. Review independence comes from the memory kernel, not reviewer episodic notes. |
| Documentation profile | gap: `doc/documentation-profile.md` is absent, not malformed or conflicting. [Handbook fallback](../../documentation-handbook.md#missing-profile-fallback-required) and AGENTS apply. | fallback: engineering-repo, business docs disabled. No profile created; explicit-profile adoption belongs to authorized framework work. |
| [Handbook](../../documentation-handbook.md) | existing: Accepted shared standard, documentation profiles, metadata, lifecycle, inception catalog and template navigation. | No reinstall/sync needed for presence verification. This audit does not certify every handbook example as an installed artifact. |
| [Templates inventory](../../templates/README.md) | existing: all 46 distinct template filenames listed in backticks resolve; 53 files including blueprints and README are present. | Critical inception, decision and change templates inspected below. No template copied or optional business capability activated. |
| [Decision README](../../decisions/README.md), [index](../../decisions/00-index.md), [binding register](../../decisions/00-register.md) | existing: all explicit local Markdown links resolve, including register-to-record paths. | carried gap: ODR-0002/0003 files exist and register links resolve, but index rows are missing. Binding completeness remains the earlier reconciliation finding, not repaired here. |
| [Documentation index](../../00-index.md) | existing: all 36 explicit local Markdown targets resolve, including lifecycle, inception, handbook, templates and decisions. | No index rewrite. Absence of new audit navigation rows is expected under this write scope, not evidence of a broken existing link. |
| Memory integration | existing: AGENTS kernel and [shared memory index](../../../.ai/memory/README.md) agree on advisory trust, ownership, caps, evidence, curation and reviewer independence. | GH-204 integration inspected as framework input only. No other agent's episodic memory loaded; no memory writes or curation. No seeded bootstrapper README exists; that is permitted, not a missing required seed. |
| Canonical/generated tooling | existing: AGENTS and decision configuration identify `.opencode/` as canonical and the plugin mirror as generated. | No hand edits or generation; generated parity execution not-reverified. |

## Tracker, branch and merge checks

Read-only CLI checks on 2026-11-02 established:

- Parsed `git remote get-url origin` identifies GitHub and the repository named
  in PM/PR configuration. No credential material is reproduced.
- Both `gh` and `glab` are installed; both `auth status` commands returned zero.
  Only GitHub was queried. This is access verification, not a request to log in
  again, paste credentials, install tools or configure another platform.
- `gh repo view` reports default branch `main`, matching the frozen public
  baseline. The configured tooling base `main-tools` must override that default.
- `gh label list --limit 200` returned 33 labels, including every configured
  workflow label: `change`, `planning`, `spec-ready`, `readiness-passed`,
  `in-progress`, `review`, `delivered`, `blocked`. Extra labels such as
  `ready-for-review` do not make the configured `review` label invalid.
- `gh issue view 200` reports OPEN with `inception`, not the normal change-label
  set. This is an inception anchor on a human-gated run, not proof of workflow
  drift or authorization to relabel it. No Project-board status mapping is
  configured by the PM document; no board semantics are invented.
- Current branch `docs/GH-200/tooling-inception` matches
  `<type>/<workItemRef>/<slug>` and the recorded single-branch mode.
- Repository settings permit merge, rebase and squash methods. Those settings
  establish available mechanics, not delegated merge ownership or protection
  compliance; branch protections were not queried.

[Change lifecycle](../../guides/change-lifecycle.md#11-pr_creation) assigns
human handoff and STOP to PM; [PR manager](../../../.opencode/agent/pr-manager.md)
never merges. The lifecycle's explicit autonomous CEO exception is a separate
delegation mode, not authority for this inception run. Owner gates and manual
merge remain binding here. No product delivery or finalization verdict follows.

## Configuration findings and routing

New observations in this audit, not new product-direction decisions:

1. **Header scope conflict.** Code-review instructions lines 19-20 and 50 require
   headers on every Markdown/Bash file. AGENTS limits script-managed headers to
   installed paths and forbids AI-added headers. Inception analysis is outside
   those header paths. Apply the root rule now; route configuration alignment
   through normal authorized framework delivery, without adding headers here.
2. **Planning ownership conflict.** PM instructions line 114 says tracker-only
   backlog and prohibits local backlog reliance. The accepted run direction and
   [question reconciliation](open-question-reconciliation.md) retain committed
   roadmap/backlog/registry as planning homes alongside tracker execution.
   Route an explicit project-configuration clarification; do not delete planning
   files or reopen the owner's settled planning-home choice.
3. **Distribution scope ambiguity.** PM instructions line 102 says any new or
   changed doc under `doc/` needs a distribution marker, while AGENTS enumerates
   guides/templates and standalone distribution surfaces. New inception audit
   drafts are outside that enumerated set. Follow the scoped root contract and
   route wording alignment with the header clarification, not a registry bypass.

These routes fit residual human-review group 3 (bounded documentation
authorization); they require no new OPEN-Q ID or autonomous ticket creation.
The missing explicit profile is a known safe-fallback condition, not an invalid
configuration incident. It remains an explicit catalog deviation to disposition
at a later authorized gate, not a reason to silently generate a profile.

## Focused reference verification

- Checked 111 explicit local Markdown links/anchors across AGENTS, all four
  project instruction files, handbook, templates README, documentation index,
  and decisions README/index/register: no missing target or heading anchor.
- All 46 template filenames enumerated by the templates README exist. Sampled
  [state template](../../templates/inception-state-template.yaml),
  [decision template](../../templates/decision-record-template.md) and
  [change template](../../templates/change-spec-template.md) expose their expected
  schema/version, acceptance and change-identity structures. Availability is
  verified, not template rendering or behavior of consuming agents.
- Bare examples, glob patterns and template placeholders are not actual links.
  Unproduced summary (Phase 7), inactive UI/discovery docs and profile fallback
  are pending/conditional catalog states, not ghost references. No placeholders
  were created to make those states appear complete.
- Missing ODR index rows and register-topic omissions remain carried Q11/Q12
  findings from [Phase 3](phase-3-decision-reconciliation.md), not missing files
  or acceptance evidence. No broad Phase 6 catalog verdict is attempted here.

## Carried decisions and gate boundary

OPEN-Q7..19 remain **DEFERRED** at their original homes, not answered by this
audit. The [reconciliation](open-question-reconciliation.md#four-residual-human-review-groups)
retains four groups: pilot/outcome protocol; acceptance/privacy/license approvals;
bounded documentation authorization; privacy coverage/support commitments.
Confirmed engineering facts above are not human votes. Existing CI propagation,
runtime composition, UTF-8 limits, pilot and privacy-coverage gaps remain open
verification/repair work; none is remedied by framework-file presence.

## Draft checks and exclusions

Strict recursive duplicate-key frontmatter parsing, local links/anchors and
whitespace/dash checks passed for all three new drafts (28 local links/anchors).
Duplicate-key negative controls rejected root, nested and sequence-contained
mapping duplicates. Read-only privacy scan: 1494 files, seven generic rules,
zero violations; both project-specific hashed classes have zero entries and
remain explicitly vacuous, not configured private-term coverage. Branding
returned exit 1 with **34 document-membership failures: 31 existing plus these
three new drafts**; no literal violations were reported. The prior Phase 4 count
of 30 predates the committed reconciliation document; 31 was measured before
these drafts. This is not a green branding gate. Shared registries remain
untouched. No full `pnpm check`, product tests, shell suites, live
conformance, installation, generated-plugin/distribution regeneration or CI
execution was run. No runtime correctness, product outcome, clean pilot or
Phase 6 readiness is claimed. Gate 5 awaits human review; STOP before Phase 6.
