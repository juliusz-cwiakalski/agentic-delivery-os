---
ados_distribution: project-generated
id: chg-GH-144
created: 2026-07-09
links:
  supersedes: ["GH-109"]
  related: ["GH-115", "GH-43"]
change:
  ref: GH-144
  type: feat
  status: Proposed
  slug: sequential-authoring-yaml-review
  title: "Sequential artifact authoring (spec→test-plan→plan) + consolidated review output (single YAML)"
  owners: ["engineering"]
  service: agentic-delivery-os
  labels: ["process", "agents"]
  version_impact: patch
  audience: internal
  security_impact: none
  risk_level: medium
  dependencies:
    internal: ["pm-agent", "spec-writer", "test-plan-writer", "plan-writer", "reviewer-agent", "review-remote-command", "change-lifecycle-guide", "build-claude-plugin", "test-doc-distribution"]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Make artifact authoring strictly sequential (spec→test-plan→plan, each consuming the previous, with a reopen-on-gap loop) and collapse the reviewer's redundant dual JSON+MD review files into a single machine- and human-readable YAML — eliminating the cross-artifact drift that the Definition of Ready gate currently catches only at high cost, and the duplication the reviewer currently persists.

## 1. SUMMARY

This change hardens ADOS's artifact-creation chain and consolidates review output. Today `@pm` lists the specification, test-planning, and delivery-planning delegations as independent bullets, so a capable agent can fire them in parallel — each authoring its artifact without consuming the others, producing cross-artifact drift (test-case IDs, file names, AC coverage, canonical values) that the DoR gate later catches at higher cost than preventing it. This change makes the three phases **strictly sequential** (each building on the completed previous artifact(s), with a documented reopen-on-gap loop), teaches `@test-plan-writer` and `@plan-writer` to explicitly consume the preceding artifact(s), and adds a lightweight **pre-DoR cross-check** plus the **"canonical DoR trap"** anti-pattern to `change-lifecycle.md` as a residual-drift safety net.

In parallel, the `@reviewer` agent persists every review iteration as two redundant files (`findings-iter-<N>.json` + `review-iter-<N>.md` locally; `review-draft.md` + `findings.json` remotely). No agent or script parses the JSON programmatically — only the reviewer re-reads it for dedup on re-review. This change replaces both pairs with a **single YAML** per iteration (same schema for local and remote modes), which is both human-readable and machine-parseable.

It **supersedes #109** (cross-artifact consistency pre-DoR): #109 proposed pinning canonical values *before parallel authoring*; sequential authoring removes the parallel authoring that pinning mitigated, and #109's pre-DoR cross-check is folded in here as the residual-drift safety net.

## 2. CONTEXT

### 2.1 Current State Snapshot

- `@pm` (`doc/guides/change-lifecycle.md`, 11-phase flow) orchestrates artifact creation across phases 2–4: `specification` (`@spec-writer`) → `test_planning` (`@test-plan-writer`) → `delivery_planning` (`@plan-writer`). Phase 5 is the Definition of Ready gate (`dor_check`, `@readiness-reviewer`); phase 8 is Definition of Done (`review_fix`, `@reviewer`).
- `.opencode/agent/pm.md` **step 4** lists three bullet-point delegations (Delegate Spec → `@spec-writer`; Delegate Test Plan → `@test-plan-writer`; Delegate Plan → `@plan-writer`) with **no explicit "wait for completion" or "strictly sequential" language**. Because they read as independent bullets, a capable agent can delegate them in parallel.
- `@test-plan-writer` discovery rules already require the spec to exist ("Locate `chg-<workItemRef>-spec.md`"; "If spec not found → FAIL"), but do not state "READ the completed spec and derive all values from it" as a first action.
- `@plan-writer` discovery rules locate the spec ("If spec not found → FAIL") but **do not mention the test plan as input**; its field-extraction rule says "All context derived from spec file" with no reference to consuming the completed test plan.
- `@reviewer` persists review iterations as two files in each mode:
  - **Local** (step 9): `findings-iter-<N>.json` (structured findings) + `review-iter-<N>.md` (summary/audit/status) under `<change_folder>/code-review/`.
  - **Remote** (step 10): `review-draft.md` + `findings.json` under `tmp/code-review/<branch>/`.
  - Its `state_files` table lists both files for each mode. Re-review dedup (local) reads existing findings from `<change_folder>/code-review/`.
- `change-lifecycle.md`'s mermaid diagram already depicts an A→B→C→D→E sequential flow (phases 1→5), and its principles state "phases can be reopened," but it does **not** describe the reopen-on-gap loop *between artifact-creation phases*, names **no** "canonical DoR trap" anti-pattern, and documents **no** pre-DoR cross-check procedure. Its feedback-loops section shows DoR→reopen but not test-planning→reopen-spec or planning→reopen-test-plan.
- `.ados-claude/` is a generated Claude Code plugin co-maintained with the canonical `.opencode/` source; CI enforces freshness via `scripts/build-claude-plugin.sh` and the doc-distribution guard via `scripts/.tests/test-doc-distribution.sh`. Per `AGENTS.md` "Extending the system," editing `.opencode/agent/**` and `.opencode/command/**` is **delegated to `@toolsmith`**.

### 2.2 Pain Points / Gaps

- **Parallelizable authoring invites cross-artifact drift.** With three independent delegations, each artifact is authored in isolation → TC IDs, file names, AC coverage, and canonical values diverge. The DoR gate (`dor_check`) catches this later, at higher cost than preventing it.
- **Each phase must build on the previous, but nothing enforces it.** The dependency is implicit (and partially encoded as "spec must exist" FAIL guards); it is not stated as a consumption/derivation requirement, and the chain has no documented reopen-on-gap loop.
- **Reviewer persists redundant files.** JSON + MD are two representations of one review; nothing consumes the JSON programmatically (only the reviewer re-reads it for dedup). Two files double the drift risk and the maintenance surface.
- **No lightweight pre-DoR cross-check.** All drift detection is pushed onto the formal gate; there is no cheap, pre-gate safety net, and the anti-pattern where each author invents canonical values independently (then they collide at the gate) is unnamed.

## 3. PROBLEM STATEMENT

Because `@pm` lists the three artifact-creation delegations as independent bullets with no "wait for completion" or "each builds on the previous" language, a capable agent can fire specification, test-planning, and delivery-planning in parallel — so each artifact is authored without consuming the others, producing cross-artifact drift that the DoR gate catches only at high cost — and the `@reviewer` persists each review iteration as two redundant files (structured JSON plus a markdown summary) when no consumer reads the JSON programmatically, so a single YAML would be both human-readable and machine-parseable at half the drift surface.

## 4. GOALS

- **G-1**: Artifact-creation phases (`specification` → `test_planning` → `delivery_planning`) are **strictly sequential** — never parallelizable — each consuming the completed previous artifact(s), with a **reopen-previous-phase loop** when a gap is discovered mid-chain.
- **G-2**: `@reviewer` writes a **single YAML file per iteration** (findings + summary + audit + status) in **both local and remote modes** — same schema, different locations — replacing the dual JSON+MD pair.
- **G-3**: A lightweight **pre-DoR cross-check** catches residual drift before the formal gate, and the **"canonical DoR trap"** anti-pattern is named so authors avoid independently inventing canonical values.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Sequential authoring | `@pm` step 4 states the three phases are strictly sequential with explicit "wait for completion before delegating next" + "each builds on previous output" language; 0 parallel-delegation phrasing |
| Reopen-on-gap loop | `change-lifecycle.md` documents test-planning→reopen-specification and planning→reopen-spec/test-plan; mermaid feedback loops reflect it |
| Artifact consumption | `@test-plan-writer` consumes the completed spec; `@plan-writer` consumes the completed spec **and** test plan (both as first actions) |
| Review file count | 1 YAML per iteration in local mode (`review-iter-<N>.yaml`); 1 YAML in remote mode (`review-draft.yaml`); 0 separate JSON/MD review files |
| Schema parity | Local and remote YAML share one schema; re-review self-load reads the YAML |
| Pre-DoR cross-check | `change-lifecycle.md` documents the cross-check (AC↔TC coverage, file inventory, shared values) + names the canonical DoR trap anti-pattern |
| Plugin freshness | `.ados-claude/` regenerated; plugin-freshness + doc-distribution guards green |

### 4.2 Non-Goals

- **NG-1**: Migrating **historical** review artifacts (existing `findings-iter-<N>.json` / `review-iter-<N>.md` / `review-draft.md` / `findings.json`) — left as-is.
- **NG-2**: Changing the `@readiness-reviewer`'s `readiness-iter-<N>.md` format — separate concern (DoR vs DoD output).
- **NG-3**: Changing **which model** authors artifacts — #115 owns the large-artifact authoring policy. This change is orthogonal (sequencing, not model assignment).
- **NG-4**: Adding a deterministic mechanical `ados check-readiness` command (#49) — the pre-DoR cross-check here is an AI-driven procedure, not a new CLI tool.
- **NG-5**: Re-debating whether to consolidate the YAML — fixed by the ticket (single YAML, same schema both modes).
- **NG-6**: Re-debating the #109 supersession — sequential authoring removes the parallel authoring #109's pinning mitigated; #109's pre-DoR cross-check is folded in here.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Strictly sequential artifact authoring with a reopen-on-gap loop | Each phase must build on the completed previous artifact(s); making it explicit (and re-openable on gap) prevents the drift the parallel pattern creates (AC-01, AC-02, AC-03). |
| F-2 | Consolidated single-YAML review output (local + remote, same schema) | One file is both human-readable and machine-parseable; halves the drift surface and removes a file nothing reads (AC-04, AC-05, AC-06). |
| F-3 | Pre-DoR cross-check safety net + "canonical DoR trap" anti-pattern | A cheap pre-gate check catches residual drift; naming the anti-pattern stops authors independently inventing canonical values that collide at the gate (AC-07). |

### 5.1 Capability Details

- **F-1 (Strictly sequential authoring + reopen-on-gap):** `@pm` step 4 changes from three independent delegation bullets to an explicit, ordered chain: delegate specification and **wait for completion**; only then delegate test-planning (which consumes the completed spec); only then delegate planning (which consumes the completed spec + test plan). The chain is **strictly sequential — never parallelizable**. When a downstream author discovers a gap in an upstream artifact mid-chain (e.g., `@test-plan-writer` finds an untestable AC; `@plan-writer` finds a spec/test-plan inconsistency), the workflow **reopens the relevant previous phase**, re-delegates to its author to correct the artifact, then resumes the chain. `@test-plan-writer` and `@plan-writer` explicitly **consume the preceding completed artifact(s) as a first action** and derive all values (TC IDs, file names, AC coverage, canonical values) from them. This is prevention (cheap) rather than detection-at-the-gate (expensive).
- **F-2 (Single-YAML review output):** `@reviewer` writes **one YAML per iteration** capturing findings + summary + severity breakdown + spec/plan compliance + status + next-step (DM-1 schema). Locations: local → `<change_folder>/code-review/review-iter-<N>.yaml`; remote → `tmp/code-review/<branch>/review-draft.yaml`. The **schema is identical** for both modes; only the path/filename differ. The existing separate JSON and MD review files are no longer produced. Re-review dedup **self-loads the YAML** (the YAML's `findings[]` replaces the old JSON's structured findings as the dedup source). Other remote artifacts (`context.json`, `diff.patch`, `comments-snapshot.json`, `ticket-context.json`, `publish-report.json`) are **unchanged** — only the review-output pair collapses to one YAML.
- **F-3 (Pre-DoR cross-check + canonical DoR trap):** `change-lifecycle.md` documents a lightweight pre-DoR cross-check performed after the three artifacts exist and before `dor_check`: verify **AC↔TC coverage** (every AC traced by ≥1 TC; every TC maps to an AC), **file inventory** consistency across spec/plan, and **shared/canonical values** (TC ID format, file names, field names) agree across artifacts. This is a complementary safety net — it does not replace the adversarial `dor_check` gate. The guide also names the **"canonical DoR trap"** anti-pattern: each author independently invents canonical values during parallel authoring, so they diverge and collide expensively at the gate; sequential authoring + the pre-DoR cross-check is the structural fix.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Strictly sequential artifact authoring (replaces parallel delegation)
  clarify_scope (1) → specification (2, @spec-writer)
    → [spec COMPLETE] → test_planning (3, @test-plan-writer) — READS completed spec
    → [test-plan COMPLETE] → delivery_planning (4, @plan-writer) — READS spec + test plan
    → [plan COMPLETE] → pre-DoR cross-check (F-3) → dor_check (5) → …
  INVARIANT: no phase begins until its predecessor completes; no parallel delegation.

Flow 2 — Reopen-on-gap loop (discovered mid-chain, never jumps to delivery)
  @test-plan-writer finds a spec gap (e.g., untestable AC) → REOPEN specification (2)
    → @spec-writer corrects spec → resume test_planning (3).
  @plan-writer finds a spec/test-plan gap → REOPEN the relevant phase (2 or 3)
    → author corrects → resume delivery_planning (4).
  Target of a reopen is ALWAYS specification | test_planning | delivery_planning,
  never delivery (5+) and never dor_check.

Flow 3 — Consolidated review output (single YAML, both modes)
  @reviewer reviews (local) → write <change_folder>/code-review/review-iter-<N>.yaml
    (findings[] + summary + severity_breakdown + spec/plan compliance + status + next_step).
  @reviewer reviews (remote) → write tmp/code-review/<branch>/review-draft.yaml — SAME schema.
  On re-review → self-load existing review-iter-<N>.yaml for dedup (no JSON read).

Flow 4 — Pre-DoR cross-check (residual-drift safety net, before dor_check)
  spec + test-plan + plan all exist → run lightweight cross-check:
    (a) AC↔TC coverage bijective; (b) file inventory consistent across spec/plan;
    (c) shared/canonical values agree → if drift found → Flow 2 (reopen the source phase).
  PASS → proceed to dor_check (5). This is a safety net, not a replacement for the gate.
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- **(A) PM workflow** `.opencode/agent/pm.md` — step 4 rewritten with explicit "STRICTLY SEQUENTIAL" language, wait-for-completion per phase, each-builds-on-previous, and reopen-on-gap rules. **Authored via `@toolsmith`** (repo hard rule).
- **(B) Test-plan writer** `.opencode/agent/test-plan-writer.md` — explicit "READ the completed spec and derive all values from it" as a first action. **Authored via `@toolsmith`.**
- **(C) Plan writer** `.opencode/agent/plan-writer.md` — explicit "READ the completed spec **and** test plan and derive all values from them" as a first action (adds the test plan as a required input). **Authored via `@toolsmith`.**
- **(D) Reviewer output consolidation** `.opencode/agent/reviewer.md` — replace the dual JSON+MD pair with a single YAML per iteration in **both** modes (local `review-iter-<N>.yaml`; remote `review-draft.yaml`), same schema (DM-1); update the `state_files` table; make re-review self-load the YAML. Other remote artifacts unchanged. **Authored via `@toolsmith`.**
- **(E) Lifecycle guide** `doc/guides/change-lifecycle.md` — document the sequential dependency, the reopen-on-gap loop (incl. feedback-loop edges in the diagram), the **"canonical DoR trap"** anti-pattern, and the **pre-DoR cross-check** procedure. `ados_distribution: redistributable` preserved.
- **(F) Remote-review command** `.opencode/command/review-remote.md` — update artifact-path references to the single `review-draft.yaml` if/where the now-removed files were named. **Authored via `@toolsmith`.**
- **(G) Regeneration** of `.ados-claude/` via `scripts/build-claude-plugin.sh` after the `.opencode/` changes; source + generated committed together.

### 7.2 Out of Scope

- [OUT] Migrating historical review artifacts (existing JSON/MD review files) — left as-is (NG-1).
- [OUT] `@readiness-reviewer`'s `readiness-iter-<N>.md` format — separate DoR concern (NG-2).
- [OUT] Which model authors artifacts — #115 (NG-3).
- [OUT] A deterministic `ados check-readiness` CLI (#49) — the pre-DoR cross-check is an AI-driven procedure, not a new tool (NG-4).
- [OUT] Renumbering the 11-phase flow (GH-57 settled the numbering; this change keeps phases 2–5 as-is).

### 7.3 Deferred / Maybe-Later

- Migrating historical review artifacts to YAML in bulk (only if retrospectives/`@doc-syncer` need a uniform format).
- A scripted (deterministic) version of the pre-DoR cross-check (#49 territory) once the AI-driven procedure proves stable.
- Tightening the review-YAML schema into a formally versioned contract with a linter.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — this change modifies internal agent/guide artifacts; it exposes no HTTP endpoints.

### 8.2 Events / Messages

N/A — no new events. The integration contract is the PM→author delegation chain (now strictly ordered) and the reviewer's persisted review-YAML (read by the reviewer's own re-review dedup and, going forward, by the retrospective agent GH-43).

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Consolidated review YAML schema | One YAML per review iteration (local `review-iter-<N>.yaml`; remote `review-draft.yaml`). **Identical schema both modes.** Top-level keys: `version: 1`; `iteration: <N>`; `mode: local \| remote`; `work_item_ref: <ref>`; `branch: <branch>`; `status: PASS \| FAIL`; `summary: <string>` (human-readable paragraph); `severity_breakdown: { critical, high, medium, low, info: <int> }`; `spec_compliance: PASS \| FAIL \| NA`; `plan_compliance: PASS \| FAIL \| NA`; `findings: [ { id: <F-n>, severity, category, location, message, suggestion } ]`; `reviewed_at: <ISO8601>`; `next_step: <string>`. This single file supersedes the prior `findings-iter-<N>.json` (the structured `findings[]`) **and** `review-iter-<N>.md` (summary/audit/status). The `findings[]` array is the dedup source for re-review. |
| DM-2 | Local review file location | `<change_folder>/code-review/review-iter-<N>.yaml` (replaces `findings-iter-<N>.json` + `review-iter-<N>.md`). |
| DM-3 | Remote review file location | `tmp/code-review/<branch>/review-draft.yaml` (replaces `review-draft.md` + `findings.json`). Other remote artifacts (`context.json`, `diff.patch`, `comments-snapshot.json`, `ticket-context.json`, `publish-report.json`) **unchanged**. |
| DM-4 | Reopen-on-gap routing | A mid-chain gap reopens `specification` / `test_planning` / `delivery_planning` (the phase that owns the flawed artifact), never `delivery` or later. Same fencing discipline as the DoR reopen rule (GH-57 F-4), applied earlier in the chain. |

### 8.4 External Integrations

N/A — no new external APIs/services. The change reads/writes local change artifacts and (remote mode) existing PR/MR data via the paths the reviewer already uses.

### 8.5 Backward Compatibility

- **Historical artifacts untouched.** Existing review files (`findings-iter-<N>.json`, `review-iter-<N>.md`, `review-draft.md`, `findings.json`) are not migrated; they remain as historical records. New iterations produce the YAML only (NG-1).
- **Workflow additive in effect.** Phases 2–5 keep their numbers; only the *ordering/sequencing semantics* within step 4 of `@pm` and the documented loop change. No phase is removed/renamed.
- **No runtime/state migration.** PM-notes files gain no new phase key. The review YAML is a new file shape for *new* iterations; older iterations simply lack it.
- **DoR/DoD roles unchanged.** `dor_check` (phase 5) and `review_fix`/`@reviewer` (phase 8) keep their roles; only `@reviewer`'s *output format* changes (one file instead of two).
- **Cross-tool consistency.** `.ados-claude/` is regenerated so OpenCode and Claude Code see the same behavior (NFR-3).

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Sequencing explicitness | `@pm` step 4 contains explicit "strictly sequential", "wait for completion before delegating next", and "each builds on the previous output" phrasing; 0 parallel-delegation bullets. |
| NFR-2 | Artifact consumption explicit | `@test-plan-writer` states it reads the completed spec; `@plan-writer` states it reads the completed spec **and** test plan; both as first actions. |
| NFR-3 | Plugin byte-freshness | Modified `.opencode/agent/{pm,test-plan-writer,plan-writer,reviewer}.md` and `.opencode/command/review-remote.md` are committed together with regenerated `.ados-claude/` counterparts; CI verifies freshness via `scripts/build-claude-plugin.sh`. |
| NFR-4 | Schema parity | Local and remote review YAML share one schema (DM-1); 0 schema divergence between the two modes. |
| NFR-5 | No orphan review files | After delivery, `@reviewer` produces exactly one review-output YAML per iteration (local) and one `review-draft.yaml` (remote); 0 separate `findings-*.json` or review-summary `.md` produced for new iterations. |
| NFR-6 | Backward compatibility | Historical review artifacts untouched (verified: no migration logic added; no deletion of existing files); 0 behavioral change to `@readiness-reviewer`'s `readiness-iter-<N>.md`. |
| NFR-7 | Doc-distribution guard | `change-lifecycle.md` retains `ados_distribution: redistributable` and passes `scripts/.tests/test-doc-distribution.sh`. |
| NFR-8 | Prompt-size discipline | Modified agent prompts stay lean — sequencing/consolidation language adds minimal tokens; no prose duplication; delegate authoring to `@toolsmith`. |
| NFR-9 | Safety net, not gate replacement | The pre-DoR cross-check is documented as a complementary safety net; `dor_check` remains the authoritative adversarial gate. |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — agents/guides are prompt/definition artifacts without runtime telemetry. Observability is structural and durable: the persisted review YAML (DM-1) is the artifact humans and the retrospective agent (GH-43) inspect; `@pm`'s phase map and the lifecycle feedback-loop edges are the durable record of the sequential + reopen-on-gap chain.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | `@reviewer` is in production use (#36 merge, GH-142 Mode A/B depend on review output); changing its output format could break a downstream consumer that reads the old JSON/MD | M | L | Confirm no script/agent parses the review JSON programmatically (PM analysis: only `@reviewer` re-reads it for dedup); update the re-review self-load to read YAML; leave historical files untouched (NFR-6). | L |
| RSK-2 | Sequencing language in `@pm` still reads as parallelizable if phrased weakly | M | M | Use explicit "STRICTLY SEQUENTIAL" + "wait for completion before delegating next" + "never parallel" phrasing; verify via `@toolsmith` + review (NFR-1). | L |
| RSK-3 | Reopen-on-gap loop could ping-pong or wrongly jump to `delivery`/`dor_check` | M | M | Fence the reopen target to artifact-creation phases only (DM-4); mirror the DoR reopen discipline (GH-57 F-4) earlier in the chain; document in lifecycle. | L |
| RSK-4 | `@plan-writer` adding the test plan as a required input changes its failure mode (now FAILs if test plan absent) | L | M | The chain guarantees the test plan exists before planning (sequential); document the dependency; the FAIL guard is the intended behavior. | L |
| RSK-5 | Most AC are behavioral agent-capability claims untestable in CI | M | H | Static/structural checks (presence of sequencing/consolidation language, schema parity, single-file output) + CI gates (plugin freshness, doc-distribution) + manual verification; behavioral claims honestly marked manual. | M |
| RSK-6 | Generated `.ados-claude` counterparts go stale | M | M | Regenerate via `scripts/build-claude-plugin.sh`; commit source + generated together; CI verifies freshness (NFR-3). | L |
| RSK-7 | Review-YAML schema drifts between local and remote modes over time | M | M | One documented schema (DM-1) shared by both modes; re-review self-load exercises it; a future linter is deferred (NG/deferred). | L |

## 12. ASSUMPTIONS

- The PM analysis is correct: no agent or script parses the review JSON programmatically; only `@reviewer` re-reads it for dedup. (Confirmed in `chg-GH-144-pm-notes.yaml`.)
- The three artifact-creation phases are the only ones whose parallelization causes drift; later phases (delivery onward) are already strictly ordered.
- The "canonical DoR trap" anti-pattern is the right name for the independently-invented-canonical-values failure mode (matches the ticket's framing).
- Editing `.opencode/agent/**` and `.opencode/command/**` is delegated to `@toolsmith` (repo hard rule in `AGENTS.md` "Extending the system").
- `change-lifecycle.md`'s existing A→B→C→D→E mermaid is sequentially correct in shape and only needs the explicit wording + reopen-on-gap edges, not a redraw.
- Supersession of #109 is final (sequential authoring removes the parallel authoring #109's pinning mitigated; its pre-DoR cross-check is folded in here).

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | `@toolsmith` | Required delegate for editing `.opencode/agent/{pm,test-plan-writer,plan-writer,reviewer}.md` and `.opencode/command/review-remote.md` (repo hard rule). |
| Depends on | `scripts/build-claude-plugin.sh` | Regenerates the `.ados-claude` counterparts; source + generated committed together (NFR-3). |
| Depends on | `scripts/.tests/test-doc-distribution.sh` | CI guard for the redistributable `change-lifecycle.md` (NFR-7). |
| Supersedes | GH-109 | Fully superseded — sequential authoring removes the parallel authoring #109's pinning mitigated; #109's pre-DoR cross-check folded in as F-3. |
| Relates (orthogonal) | GH-115 | #115 owns which model authors artifacts; this change owns sequencing. Orthogonal — sequencing vs model authoring policy. |
| Relates (downstream) | GH-43 | Retrospective agent reads review artifacts — will read the YAML going forward (no JSON to parse). |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Should the review-YAML schema declare an explicit `version` from day one to ease future evolution? | Affects DM-1 (currently `version: 1`). | **RESOLVED** — include `version: 1` in the schema so a future linter/migration can key off it. |
| OQ-2 | Does `@reviewer`'s re-review need to also surface the prior YAML's `next_step`, or only dedup `findings[]`? | Affects how much of the YAML the self-load reads. | **RESOLVED** — self-load reads `findings[]` for dedup (parity with today's JSON use); `next_step` is informational, not a dedup key. |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Ship both issues in **one ticket / one PR** (sequential authoring + YAML review). | Shared files (`change-lifecycle.md`, `pm.md`) and a coupled delivery narrative; one PR is cheaper than two coordinated ones (matches `chg-GH-144-pm-notes.yaml`). | 2026-07-09 |
| DEC-2 | Make authoring **strictly sequential** (not "parallel + pin canonical values" per #109). | Sequential authoring removes the parallel authoring that creates drift; cheaper to prevent than to pin-then-detect. Supersedes #109. | 2026-07-09 |
| DEC-3 | Consolidate review output to **one YAML** (same schema local + remote), not a new JSON + MD pair. | No consumer reads the JSON programmatically; one YAML is human- and machine-readable at half the drift surface. | 2026-07-09 |
| DEC-4 | Fold #109's pre-DoR cross-check into this change as a **safety net** (F-3), not a gate replacement. | `dor_check` stays the authoritative adversarial gate; the cross-check catches residual drift cheaply before it. | 2026-07-09 |
| DEC-5 | **Leave historical review artifacts untouched.** | Migration is out of scope (NG-1); historical files remain valid records; new iterations produce YAML only. | 2026-07-09 |
| DEC-6 | Reopen-on-gap targets **only** artifact-creation phases (`specification`/`test_planning`/`delivery_planning`). | Mirrors the DoR reopen discipline (GH-57 F-4) applied earlier; never jump to `delivery` or `dor_check`. | 2026-07-09 |
| DEC-7 | Agent/command edits are delegated to **`@toolsmith`**. | Hard rule in `AGENTS.md` "Extending the system". | 2026-07-09 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `.opencode/agent/pm.md` | **Modified** — step 4: strictly sequential, wait-for-completion, each-builds-on-previous, reopen-on-gap (via `@toolsmith`) |
| `.opencode/agent/test-plan-writer.md` | **Modified** — explicit "read completed spec, derive all values from it" first action (via `@toolsmith`) |
| `.opencode/agent/plan-writer.md` | **Modified** — explicit "read completed spec + test plan, derive all values" first action (via `@toolsmith`) |
| `.opencode/agent/reviewer.md` | **Modified** — single YAML per iteration (local + remote, same schema DM-1); `state_files` table; re-review self-load reads YAML (via `@toolsmith`) |
| `.opencode/command/review-remote.md` | **Modified** — update artifact-path references to `review-draft.yaml` where needed (via `@toolsmith`) |
| `doc/guides/change-lifecycle.md` | **Modified** — sequential dependency, reopen-on-gap loop (+ mermaid feedback edges), "canonical DoR trap" anti-pattern, pre-DoR cross-check |
| `.ados-claude/` counterparts | **Regenerated** — for all modified `.opencode/` sources; committed alongside (CI freshness) |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion (Given / When / Then) | Linked |
|----|----------------------------------|--------|
| AC-01 | **Given** `@pm` orchestrates a change, **when** phase 4 (artifact creation) is reached, **then** `@pm` step 4 states the three phases (specification → test_planning → delivery_planning) are **strictly sequential** with explicit "wait for completion before delegating the next" and "each builds on the previous output" language, and contains **no parallel-delegation** phrasing. **Verification: structural (grep for the sequential/wait-for-completion language in `pm.md`; confirm no parallel bullets) + manual.** | F-1, NFR-1 |
| AC-02 | **Given** a downstream author discovers a gap in an upstream artifact mid-chain, **when** the gap is found, **then** `change-lifecycle.md` documents the reopen-on-gap loop: test-planning finding a spec gap → **reopens specification**; planning finding a spec/test-plan gap → **reopens that phase**; the reopen target is always an artifact-creation phase, never `delivery` or `dor_check`. **Verification: structural (lifecycle documents both reopen edges + the mermaid feedback-loops reflect them) + manual.** | F-1, DM-4 |
| AC-03 | **Given** the chain is sequential, **when** `@test-plan-writer` and `@plan-writer` run, **then** each prompt explicitly **consumes the preceding completed artifact(s)** as a first action (test-plan-writer reads the completed spec; plan-writer reads the completed spec **and** test plan) and derives all values from them. **Verification: structural (grep for the explicit consume/derive language in both agent prompts) + manual.** | F-1, NFR-2 |
| AC-04 | **Given** `@reviewer` runs in **local** mode, **when** it writes a review iteration, **then** it writes a **single** `review-iter-<N>.yaml` per iteration (no separate `findings-iter-<N>.json` or `review-iter-<N>.md`) that captures the findings array + summary + severity breakdown + spec/plan compliance + status + next-step (DM-1). **Verification: structural (prompt writes one YAML; `state_files` table lists only the YAML; schema matches DM-1) + manual.** | F-2, DM-1, DM-2, NFR-5 |
| AC-05 | **Given** `@reviewer` runs in **remote** mode, **when** it writes the review, **then** it writes a **single** `review-draft.yaml` (same schema as local, DM-1) under `tmp/code-review/<branch>/`, and the **other** remote artifacts (`context.json`, `diff.patch`, `comments-snapshot.json`, `ticket-context.json`, `publish-report.json`) are **unchanged**. **Verification: structural (prompt writes `review-draft.yaml`; other artifacts enumerated unchanged) + manual.** | F-2, DM-1, DM-3 |
| AC-06 | **Given** `@reviewer` re-reviews a change, **when** it self-loads the prior iteration for dedup, **then** it reads the **YAML** (`review-iter-<N>.yaml` local; `review-draft.yaml` remote), not a separate JSON. **Verification: structural (re-review step loads the YAML) + manual.** | F-2, NFR-4 |
| AC-07 | **Given** the three artifacts (spec, test-plan, plan) exist, **when** `change-lifecycle.md` is inspected, **then** it (a) names the **"canonical DoR trap"** anti-pattern and (b) documents a lightweight **pre-DoR cross-check** (AC↔TC coverage, file inventory, shared/canonical values) as a residual-drift safety net before `dor_check` — not a replacement for the gate. **Verification: structural (grep for the anti-pattern name + the cross-check procedure in `change-lifecycle.md`) + manual.** | F-3, NFR-9 |
| AC-08 | **Given** the `.opencode/` sources are changed, **when** the change is delivered, **then** `.ados-claude/` is **regenerated** from `.opencode/` via `scripts/build-claude-plugin.sh` and the **plugin-freshness** and **doc-distribution** (`scripts/.tests/test-doc-distribution.sh`) CI guards are **green**. **Verification: CI (plugin freshness + doc-distribution guard pass).** | cross-cutting, NFR-3, NFR-7 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery order (high-level):** (1) `@toolsmith` authors the `@pm` step-4 rewrite (strictly sequential + reopen-on-gap) → (2) `@toolsmith` adds the consume-preceding-artifact language to `@test-plan-writer` and `@plan-writer` → (3) `@toolsmith` consolidates `@reviewer` to single-YAML (local + remote, DM-1) + updates `state_files` + re-review self-load → (4) `@toolsmith` updates `.opencode/command/review-remote.md` paths → (5) update `doc/guides/change-lifecycle.md` (sequential dependency, reopen-on-gap loop + mermaid edges, canonical DoR trap, pre-DoR cross-check) → (6) regenerate `.ados-claude/` and commit source + generated together → (7) `@doc-syncer` reconciles any system docs at phase 7.
- **Merge strategy:** single PR. CI verifies plugin freshness + the doc-distribution guard; behavioral claims (sequencing actually enforced, reopen routing, YAML schema) are covered by the manual verification matrix + PR review + the requested red-team review (`chg-GH-144-pm-notes.yaml`).
- **Adoption note:** backward compatible — historical review artifacts stay as-is; new iterations produce the YAML; phases keep their numbers; only step-4 ordering semantics and review output format change.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. No persisted-data migration. Historical review files are intentionally left untouched (NG-1); new iterations produce the consolidated YAML only. No live runtime state is seeded — this repo ships agent/command/guide definitions; projects instantiate review artifacts at runtime.

## 20. PRIVACY / COMPLIANCE REVIEW

N/A. The change touches internal agent/guide artifacts and review-output file shape. It introduces no new personal/PII processing, no new external data flows, and no new tracker/PR-platform access beyond what `@reviewer` already uses.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Read-only sequencing/consolidation:** the change alters delegation order and review *output shape*; it does not grant new write/network authority.
- **No new access:** no new external APIs, trackers, or platform access (§8.4). Local file reads/writes and the remote paths the reviewer already uses.
- **Reopen-target safety:** reopen-on-gap is fenced to artifact-creation phases (DM-4), mirroring the DoR reopen discipline — it cannot silently jump to `delivery` or `dor_check`.

## 22. MAINTENANCE & OPERATIONS IMPACT

- The modified agents/guide join the redistributable delivery-system family and are co-maintained via `@toolsmith` (hard rule).
- The review-YAML schema (DM-1) is the new single contract for review output; a future linter/migration is deferred. Re-review self-load exercises it on every re-review, keeping it honest.
- `change-lifecycle.md` gains the canonical DoR trap + pre-DoR cross-check; these are durable process knowledge the retrospective agent (GH-43) may refine over time.
- `.ados-claude/` counterparts are kept byte-fresh (NFR-3); the doc-distribution guard covers the lifecycle guide (NFR-7).

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Strictly sequential authoring | The artifact-creation chain (specification → test_planning → delivery_planning) runs one phase at a time, each waiting for the predecessor to complete and consuming its output; never parallel. |
| Reopen-on-gap loop | When a downstream author finds a gap in an upstream artifact, the workflow reopens the owning artifact-creation phase (never `delivery`/`dor_check`), corrects it, then resumes the chain. |
| Canonical DoR trap | Anti-pattern where each author independently invents canonical values (TC IDs, file names, field names) during parallel authoring, so they diverge and collide expensively at the DoR gate. Fixed by sequential authoring + the pre-DoR cross-check. |
| Pre-DoR cross-check | A lightweight AI-driven check (AC↔TC coverage, file inventory, shared/canonical values) run after artifacts exist and before `dor_check`; a safety net, not a gate replacement. |
| Consolidated review YAML | One YAML per review iteration (findings + summary + severity breakdown + spec/plan compliance + status + next-step); same schema for local and remote modes. Replaces the prior JSON+MD pair. |

## 24. APPENDICES

- **Appendix A — Authoritative AC source:** GitHub issue GH-144 (the 8-item "Acceptance Criteria" + the Problem/Goals/Scope sections). Carried forward here as AC-01…AC-08, each annotated with its verification type (structural/CI vs manual) and linked F-/DM-/NFR- IDs.
- **Appendix B — Supersession of #109:** #109 proposed pinning canonical values *before parallel authoring*. Sequential authoring (F-1) removes the parallel authoring that pinning mitigated, so #109's core mechanism is obsolete; #109's pre-DoR cross-check is folded into F-3. #109 is fully superseded (§13, DEC-2).
- **Appendix C — Structural siblings:** `@readiness-reviewer`/GH-57 (DoR reopen discipline mirrored earlier in the chain by DM-4); `@reviewer`/GH-36 (house-style precedent for the review-YAML finding format).

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-09 | @spec-writer | Initial specification for GH-144 |

---

## AUTHORING GUIDELINES

Authored by `@spec-writer` from the GH-144 ticket, `chg-GH-144-pm-notes.yaml` (PM analysis with root-cause confirmation and per-file current-state notes), and the `change-spec-template.md`. Followed the GH-57 (readiness-gate) spec as the structural/house-style reference for a delivery-process/agent change. Agent/command edits are constrained to `@toolsmith` at delivery (repo hard rule); this spec treats that as a constraint, not a spec-level edit. Historical review artifacts are intentionally not migrated (NG-1). The two open questions (OQ-1, OQ-2) are resolved in §15/§14.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-144)
- [x] `owners` has at least one entry (`engineering`)
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no step-by-step file-level edits; only scope/components + behavioral ACs)
- [x] No content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
