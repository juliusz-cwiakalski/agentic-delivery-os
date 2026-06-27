---
ados_distribution: project-generated
id: CHG-GH-72
links:
  decisions: ["PDR-0001"]
  spec: ["doc/spec/features/feature-bootstrapper.md"]
  changes: ["GH-71", "GH-69"]
change:
  ref: GH-72
  type: feat
  status: Proposed
  slug: tribal-knowledge-extraction
  title: "[inception:3] Tribal-knowledge extraction — bootstrapper Phase-0 PRODUCE path from repo docs + git history"
  owners: ["Juliusz Ćwiąkalski"]
  service: bootstrapper-agent
  labels: ["inception", "bootstrapper", "agent", "legacy"]
  version_impact: minor
  audience: internal
  security_impact: low
  risk_level: medium
  dependencies:
    internal: ["bootstrapper-agent", "project-inception-guide", "tribal-knowledge-template", "feature-bootstrapper-spec", "build-claude-plugin"]
    external: []
---

# CHANGE SPECIFICATION

> **PURPOSE**: Add the missing **PRODUCE** step to `@bootstrapper`'s legacy Phase 0 so a pre-ADOS project's undocumented decisions, conventions, rejected approaches, workarounds, and domain terms — scattered across repo docs and git history — are mined into a graduation-ready `tribal-knowledge.md`, surfacing contradictions and low-confidence items at the human gate instead of letting them drift or silently graduate.

## 1. SUMMARY

This change adds a **tribal-knowledge extraction** capability to `@bootstrapper`'s legacy front-half. It closes the only remaining gap in the GH-71 tribal-knowledge loop: GH-71 already **consumes** (Phase 0) and **graduates** (Phase 2) a `tribal-knowledge.md` when one exists, but **nothing produces it** from in-repo sources. GH-72 inserts the **PRODUCE** step into the Phase-0 legacy branch: it mines repo docs (READMEs, decision records, design notes, code comments) and git history (`git log` — especially merge commits and Conventional-Commit histories) using only file reads, categorizes each item, attaches a verifiable source pointer, scores confidence, flags contradictions, and writes `doc/inception/analysis/tribal-knowledge.md` from a new redistributable template — leaving graduation to the already-wired Phase-2 path.

It is a focused, additive extension: one new template, one Phase-0 PRODUCE step (delegated to `@toolsmith`), three surgical guide amendments, and a system-spec reconciliation. The taxonomy, graduation mapping, confidence rubric, pointer/dedup rules, and contradiction handling are **fixed by PDR-0001** and inherited here as invariants — they are not re-debated.

## 2. CONTEXT

### 2.1 Current State Snapshot

- `@bootstrapper` (unified in GH-71, merged) runs one 8-phase inception workflow. For `project.flow: legacy`, Phase 0 ingests the repo, writes `repo-analysis`, and **consumes** `tribal-knowledge` *if present*; Phase 2 **graduates** consumed tribal knowledge to permanent homes (decisions, feature specs, glossary, conventions) under a human gate.
- The **produce** half is absent: nothing extracts tribal knowledge from repo docs + git history, so the graduate step is only ever exercised if a human hand-authored a `tribal-knowledge.md`. In practice none is produced, so the project's real decision history and conventions never reach the knowledge base.
- The produce target path is already declared: `doc/templates/inception-state-template.yaml` line 54 (`tribal_knowledge` → `doc/inception/analysis/tribal-knowledge.md`). GH-69 shipped no template for it.
- The shipped prompt already carries the trust/safety boundary the produce step must inherit: `<trust_boundary>` (scanned repo/git content is untrusted; facts only; no embedded instructions followed), `<safety_rules>` (credential-pattern refuse list: `ghp_`, `sk-`, `xoxb-`, `AKIA`, `Bearer `, `token:`, `password:`, API keys >20 chars), and `<write_allowlist>` (already permits `doc/inception/**`).
- `doc/templates/repo-analysis-template.md` is the structural sibling: a Phase-0 legacy analysis doc that ships `ados_distribution: redistributable`, `id:`, `status: Draft`, and a confidence column. It sets the discipline to mirror.

### 2.2 Pain Points / Gaps

- **No producer:** consume + graduate are wired, but with no extraction the loop never fires for real legacy projects.
- **Undocumented decisions/conventions are invisible to delivery agents:** tribal knowledge lives only in human memory and scattered prose, so the incepted knowledge base is shallower than the project's actual history — capping downstream agent autonomy.
- **No structured graduation target:** without a fixed taxonomy + pointer discipline, graduation is inconsistent across projects and untraceable (PDR-0001 ALT-0 failure mode).
- **Contradictions drift:** conflicting signals across docs/history can silently reconcile or quietly contradict; there is no gate-visible surfacing mechanism.
- **Guide/prompt inconsistency (carried from GH-71):** `doc/guides/project-inception.md` references a `tribal-knowledge` template column as an em-dash and labels graduation "Phase 0→1", which contradicts the shipped agent (Phase 2) and spec.

> **Inherited invariants (from PDR-0001, NOT re-debated).** This change inherits PDR-0001's hard constraints as non-negotiable: **C-1** produce writes only `doc/inception/analysis/tribal-knowledge.md` (graduation is Phase 2); **C-2** every category maps to an *existing* ADOS home (no invented register); **C-3** contradicted items never silently graduate; **C-4** no secrets/credentials extracted or recorded (credential patterns refused); **C-5** every item carries a verifiable source pointer.

## 3. PROBLEM STATEMENT

Because GH-71 wired tribal-knowledge **consume** and **graduate** but never a **producer**, a pre-ADOS project's undocumented decisions, conventions, rejected approaches, workarounds, and domain terms — living only in repo docs and git history — cannot reach the incepted knowledge base, so delivery agents operate against a shallower view of the project than its real history warrants, and graduation never fires in practice.

## 4. GOALS

- **G-1**: Add a Phase-0 legacy **PRODUCE** step that mines in-repo docs + git history (file reads + `git log` only) into a graduation-ready `doc/inception/analysis/tribal-knowledge.md`.
- **G-2**: Encode PDR-0001's design in a new redistributable template — 5-category item record, source pointer, confidence rubric, contradiction flag, and an `Open Contradictions` roll-up.
- **G-3**: Make every extracted item traceable (category + source pointer) and gate-visible (contradictions + low-confidence surfaced at the Phase-0 human gate, never silently graduated).
- **G-4**: Keep the addition surgical and additive — inherit the existing trust/safety boundary, the existing graduate path, and the existing produce-target state entry; introduce no new register, CLI, or backward-compat surface.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Legacy Phase-0 produce path | 1 PRODUCE step in the Phase-0 legacy branch; 0 in the `new` branch |
| Items with category + source pointer | 100% of produced items (DM-2, DM-3) |
| Contradictions surfaced at the gate | 100% of flagged contradictions appear in the `## Open Contradictions` roll-up; 0 silently graduate |
| Extraction surfaces | repo docs + `git log` only; 0 new CLI tooling |
| Write footprint | exactly one new file written by produce (`doc/inception/analysis/tribal-knowledge.md`); 0 writes outside `doc/inception/**` |
| Redistributable template | `doc/templates/tribal-knowledge-template.md` passes the CI doc-distribution guard |

### 4.2 Non-Goals

- **NG-1**: Tribal-knowledge extraction from **PR/MR comments and review threads** → GH-33 (parked until CLI/MCP supports reliable PR-thread fetching at scale).
- **NG-2**: Re-deepening the GH-71 legacy front-half behaviors (repo ingestion, behavioral-spec extraction, architecture reconstruction, conventions audit, next-milestone framing) — delivered; deepening deferred to dogfooding (GH-70 capstone).
- **NG-3**: Re-specifying the **consume** (Phase 0) and **graduate** (Phase 2) wiring — already done by GH-71.
- **NG-4**: Running extraction on **greenfield/new** projects — no history to mine (NFR-4).
- **NG-5**: New CLI tooling — uses only file reads + `git log`.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Tribal-knowledge PRODUCE (legacy Phase 0) | Mine repo docs + git history into a graduation-ready `tribal-knowledge.md`; this is the missing half of the GH-71 loop (AC1, AC2). |
| F-2 | Structured item record (the template) | A fixed 5-category record with pointer + confidence + contradiction flag makes graduation mechanical and traceable (AC2, AC3, AC4). |
| F-3 | Contradiction surfacing | Conflicting items must be gate-visible and excluded from graduation until a human resolves them (AC4; PDR-0001 C-3). |
| F-4 | Graduation-readiness (Phase 2) | The produced doc must be consumable by the already-wired Phase-2 graduate path under the human gate (AC5). |
| F-5 | Trust/safety inheritance | Sourced content is untrusted input: facts only, no embedded instructions followed, secrets/credential patterns refused (AC6; PDR-0001 C-4). |

### 5.1 Capability Details

- **F-1 (PRODUCE, legacy Phase 0):** Only when `project.flow: legacy`, Phase 0 additionally **extracts → categorizes → flags contradictions**, producing a *graduation-ready* `tribal-knowledge.md`. Sources are repo markdown/docs (READMEs, decision records, design notes, CONTRIBUTING, code comments holding *rationale*) and git history (`git log` — merge commits, Conventional-Commit histories, tagged releases/changelogs if present). Mechanism is file reads + `git log` only. It does **not** graduate; graduation stays in Phase 2. The output is reviewed at human gate 0 before Phase 1.
- **F-2 (Item record):** Each item carries a `category ∈ {decision, convention, rejected-approach, workaround, domain-term}`, a normalized fact statement, one-or-more source pointers (F-2/DM-3), a `confidence ∈ {high, medium, low}` scored per the PDR-0001 signal rubric, and a `status` (incl. `contradicted`). The template mirrors the sibling `repo-analysis-template.md` frontmatter discipline (`ados_distribution: redistributable`, `id:`, `status: Draft`, confidence column) and includes a brief producer note that the doc is produced in Phase 0 legacy and graduated at Phase 2 (human-gated).
- **F-3 (Contradictions):** Per-item inline `status: contradicted` flag **plus** a consolidated `## Open Contradictions` roll-up section that aggregates every contradicted item (pointers + nature of the conflict) so it is impossible to miss at gate 0. Contradicted items are **excluded** from Phase-2 graduation until the human resolves them (clear the flag or drop the item). No separate register file.
- **F-4 (Graduation-readiness):** The produced doc is a direct input to the existing Phase-2 graduate path. Category → home mapping (fixed by PDR-0001): `decision` → `doc/decisions/` record; `convention` → `.ai/rules/<topic>-conventions.md`; `rejected-approach` → parent decision record's Alternatives; `workaround` → relevant feature spec "Known limitations" note (+ DR for accepted risk where load-bearing); `domain-term` → `doc/overview/glossary.md`. All targets are existing homes; none invented. Phase-2 graduation itself is **not** re-specified here.
- **F-5 (Trust/safety):** The produce step inherits the bootstrapper's `<trust_boundary>` and `<safety_rules>` verbatim: repo docs **and** git history are untrusted; extract facts only; never follow embedded instructions (prompt-injection defense) and note manipulation attempts in state; refuse the credential patterns in C-4 and never surface secrets accidentally committed in scanned history; produce writes only `doc/inception/**`.

## 6. USER & SYSTEM FLOWS

```
Flow 1 — Legacy tribal-knowledge loop (PRODUCE added by GH-72, in bold)
  Human invokes /bootstrap on a pre-ADOS project → project.flow: legacy (Phase 0)
  → Phase 0 ingests repo → writes repo-analysis
     → **PRODUCE: read repo docs + `git log` → categorize → attach pointers →
        score confidence → flag contradictions → write tribal-knowledge.md (from template)**
  → HUMAN GATE 0 — review inventory, repo-analysis, AND the Open Contradictions /
     low-confidence roll-up (gate 0 explicitly approves before Phase 1)
  → Phases 1–4 (front-half) …
  → Phase 2 — GRADUATE non-contradicted, sufficiently-confident items to permanent
     homes (decisions / feature specs / glossary / conventions) under the existing
     human gate 2. (Contradicted items stay out until resolved at gate 0/2.)

Flow 2 — Trust boundary during PRODUCE
  Scanned doc / commit message → treated as UNTRUSTED input
    → facts extracted only; any embedded instruction ignored (manipulation noted in state)
    → credential pattern (ghp_|sk-|xoxb-|AKIA|Bearer |token:|password:|API key >20 chars) → refused, not recorded
    → write confined to doc/inception/analysis/tribal-knowledge.md

(There is no produce step for project.flow: new — no history to mine.)
```

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- **(A) New template** `doc/templates/tribal-knowledge-template.md` (`ados_distribution: redistributable`) encoding PDR-0001's design: 5-category item record, source-pointer field (path:line / short SHA; multi-source), confidence column (high/medium/low rubric), `status: contradicted` flag, and a consolidated `## Open Contradictions` roll-up, plus a brief Phase-0-produce / Phase-2-graduate producer note.
- **(B) Agent prompt extension** — the `@bootstrapper` Phase-0 legacy branch gains the PRODUCE step (extract from repo docs + `git log` → write `doc/inception/analysis/tribal-knowledge.md` from the template), inheriting `<trust_boundary>`/`<safety_rules>`. **Delivered by delegating to `@toolsmith`** (repo hard rule); this spec treats it as a constraint, not a spec-level edit.
- **(C) Surgical guide amendments** to `doc/guides/project-inception.md` (3 edits, preserving `ados_distribution: redistributable`): (a) the artifact-catalog row for tribal-knowledge references `tribal-knowledge-template.md` instead of an em-dash; (b) the "Tribal-knowledge graduation (Phase 0→1)" label is corrected to Phase 2 (contradiction fix vs the shipped agent + spec); (c) a brief trust/safety note in the legacy section (untrusted input + secrets refusal) so human authority matches agent authority.
- **(D) System-spec reconciliation** of `doc/spec/features/feature-bootstrapper.md` to add the PRODUCE-path description alongside consume/graduate — delivered by `@doc-syncer` at phase 6, not authored at spec/plan time.
- Regeneration of the `.ados-claude` plugin counterpart (committed alongside the agent source).

### 7.2 Out of Scope

- [OUT] PR/MR comment + review-thread extraction → GH-33 (parked).
- [OUT] Legacy front-half behaviors shipped by GH-71 (repo ingestion, behavioral-spec extraction, architecture reconstruction, conventions audit, next-milestone framing, uncertainty flagging, state-flow).
- [OUT] Re-specifying the CONSUME (Phase 0) and GRADUATE (Phase 2) wiring — already done by GH-71.
- [OUT] Running extraction on greenfield/new projects (no history).
- [OUT] New CLI tooling (file reads + `git log` only).
- [OUT] Re-debating the taxonomy, graduation mapping, confidence rubric, pointer/dedup, or contradiction handling — fixed by PDR-0001.
- [OUT] A new tech-debt register or any invented graduation home.

### 7.3 Deferred / Maybe-Later

- Expanding the extraction surface to issue/PR threads (GH-33) — would enrich the same `tribal-knowledge.md`; revisit trigger in PDR-0001.
- Whether ADOS later adds a tech-debt register — would supersede the `workaround` home mapping (PDR-0001 revisit trigger).

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — this change extends an internal agent prompt and adds a template; it exposes no HTTP endpoints.

### 8.2 Events / Messages

N/A — no new events or messages.

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | `tribal-knowledge.md` item record | Each item: `category`, normalized fact statement, one-or-more `source-pointer(s)`, `confidence`, `status` (incl. `contradicted`). The shape is fixed by PDR-0001 and encoded in the template. |
| DM-2 | `category` enum | `decision \| convention \| rejected-approach \| workaround \| domain-term` (PDR-0001 §1). Exactly five values; closed set. |
| DM-3 | Source-pointer format & dedup | Docs → `path:line`; git history → commit short SHA (expand to full 40-char on ambiguity). A fact corroborated by multiple sources is **one item with multiple pointers** (dedup key = `(category, normalized fact statement)`); corroboration raises confidence (PDR-0001 §4). |
| DM-4 | Confidence rubric | `high` = explicit + corroborated (≥2 sources) OR explicit + recent; `medium` = explicit + single source OR inferred + corroborated; `low` = inferred + single source OR stale/orphaned. High graduates directly; low is re-flagged for human confirmation before graduation (PDR-0001 §3). |
| DM-5 | Contradiction handling | Inline per-item `status: contradicted` flag + consolidated `## Open Contradictions` roll-up. Contradicted items are excluded from Phase-2 graduation until the human clears the flag or drops the item (PDR-0001 §2). |
| DM-6 | State entry | `inception-state-template.yaml` `tribal_knowledge` artifact already declares path `doc/inception/analysis/tribal-knowledge.md` — **no schema change**; the produce step populates an already-declared slot. |

### 8.4 External Integrations

N/A — no new external APIs or services. The produce step reads local files and runs local `git log` only; no network calls, tracker, or PR-platform access is introduced.

### 8.5 Backward Compatibility

- **Fully backward compatible — additive.** The consume (Phase 0) and graduate (Phase 2) wiring shipped by GH-71 is unchanged and not duplicated. GH-72 inserts an additional PRODUCE step into the existing Phase-0 legacy branch; nothing existing is removed or renamed.
- A project with a pre-existing hand-authored `doc/inception/analysis/tribal-knowledge.md` is still **consumed** as before; the produce step overwrites/generates only on a fresh legacy run where none exists (standard bootstrapper no-overwrite-without-approval rule applies).
- The produce target path and state slot are already declared (DM-6); no migration.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Legacy-only execution | The PRODUCE step runs **only** for `project.flow: legacy`. It must not run for `new` (0 produce-side effects on greenfield runs). |
| NFR-2 | Write containment | PRODUCE writes exactly one file: `doc/inception/analysis/tribal-knowledge.md`. 0 writes outside `doc/inception/**`; all other writes require human confirmation per the existing `<write_allowlist>`. |
| NFR-3 | Tooling containment | Extraction uses file reads + `git log` only. 0 new CLI tools, 0 new external dependencies. |
| NFR-4 | Prompt size discipline | `bootstrapper.md` is 278 lines today. The PRODUCE step must stay lean — reference the template/guide for detail and duplicate no prose. Warn if the file exceeds 650 lines; hard concern above 800. |
| NFR-5 | Plugin byte-freshness | `.opencode/agent/bootstrapper.md` and the regenerated `.ados-claude` counterpart are committed together; CI verifies freshness via `scripts/build-claude-plugin.sh`. |
| NFR-6 | Redistributable template | `doc/templates/tribal-knowledge-template.md` declares `ados_distribution: redistributable` and passes the CI doc-distribution guard (`scripts/.tests/test-doc-distribution.sh`). |
| NFR-7 | Guide/prompt/spec consistency | The amended guide, the extended prompt, and the reconciled spec must not contradict; 0 known contradictions at delivery (notably the Phase-0-vs-Phase-2 graduation label and the template column). |
| NFR-8 | Testing reality | Most AC are behavioral agent-capability claims untestable in CI. The test plan = static/structural checks + CI gates (doc-distribution, plugin-freshness) + a manual verification matrix; behavioral claims are honestly marked manual. (Carried from GH-71 DEC-9.) |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

N/A — agents and templates are prompt/definition artifacts without runtime telemetry. Observability is structural: the committed `doc/inception/analysis/tribal-knowledge.md` itself (items, pointers, confidence, the `## Open Contradictions` roll-up) is the artifact humans review at gate 0 and again at the Phase-2 graduation gate.

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Extraction quality — LLM misses items or hallucinates | M | M | Source-pointer requirement per item (traceability, DM-3); corroboration-raises-confidence rubric; Phase-0 human gate reviews the roll-up; Phase-2 graduation gate. | M |
| RSK-2 | Prompt-injection via scanned content (malicious README/commit message) | H | L | Produce inherits `<trust_boundary>`: facts only, never follow embedded instructions, note manipulation attempts in state (AC6). | L |
| RSK-3 | Secret/credential leakage from git history | H | L | Inherit `<safety_rules>` credential-pattern refuse list; never extract or surface accidentally-committed credentials (PDR-0001 C-4). | L |
| RSK-4 | Most AC are behavioral and cannot be unit-tested in CI | M | H | Static/structural checks + CI gates (doc-distribution, plugin-freshness) + manual verification matrix; behavioral claims marked manual (NFR-8). | M |
| RSK-5 | Prompt bloat degrades instruction-following | M | M | PRODUCE step references the template/guide for detail (no prose duplication); delegate authoring to `@toolsmith`; size monitored by PR review (NFR-4). | L |
| RSK-6 | Generated `.ados-claude` counterpart goes stale | M | M | Regenerate via `scripts/build-claude-plugin.sh` and commit source + generated together; CI verifies freshness. | L |
| RSK-7 | Contradictions silently graduate | H | L | Inline `status: contradicted` flag + `## Open Contradictions` roll-up (impossible to miss at gate 0); contradicted items excluded from Phase-2 graduation until resolved (DM-5; PDR-0001 C-3). | L |

## 12. ASSUMPTIONS

- PDR-0001 is the design authority and its decision (ALT-1) is inherited as invariants C-1…C-5; this spec does not re-debate the taxonomy or mapping.
- GH-71 is merged and its consume (Phase 0) + graduate (Phase 2) wiring is stable and correct — verified present in `.opencode/agent/bootstrapper.md` at authoring time.
- The produce target state entry exists (`inception-state-template.yaml` line 54) — verified present; no schema change needed.
- `doc/templates/repo-analysis-template.md` is the correct structural sibling to mirror (frontmatter discipline, confidence column) — verified present.
- The `@toolsmith` agent is the required delegate for editing `.opencode/agent/bootstrapper.md` (repo hard rule in `AGENTS.md` "Extending the system").
- `@doc-syncer` reconciles `doc/spec/features/feature-bootstrapper.md` at phase 6; the spec is not authored at spec/plan time.
- A human attends gate 0 (and the Phase-2 graduation gate); the agent does not auto-advance.

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-71 (merged) | Unified bootstrapper with the tribal-knowledge consume/graduate path; the PRODUCE step inserts into its Phase-0 legacy branch. |
| Depends on | GH-69 (merged) | `doc/inception/` workspace; `inception-state-template.yaml` (tribal_knowledge produce target); `repo-analysis-template.md` (structural sibling). |
| Depends on | PDR-0001 | Design authority for taxonomy, mapping, pointer/dedup, confidence, contradiction handling — inherited as invariants. |
| Depends on | `@toolsmith` | Required delegate for editing the agent prompt (repo hard rule). |
| Depends on | `scripts/build-claude-plugin.sh` | Regenerates the `.ados-claude` counterpart; source + generated committed together. |
| Relates | GH-33 | PR/MR comment + review-thread extraction — additive, tooling-gated future enrichment of the same `tribal-knowledge.md`; out of scope here. |
| Delivered by | `@doc-syncer` (phase 6) | Reconciliation of `feature-bootstrapper.md` (scope item D). |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Graduation behavior for `medium`-confidence items — does `medium` graduate directly (like `high`) or is it re-flagged (like `low`)? | PDR-0001 §3 states `high` graduates directly and `low` is re-flagged, but leaves `medium` implicit. This affects Phase-2 graduation gating (AC5). | **RESOLVED (PM, 2026-06-27):** `medium` graduates directly. The Phase-2 human gate is the universal safety net for every item regardless of confidence; confidence levels differ only in extraction-trust signaling, not in whether they reach the gate. `low` is the sole level explicitly re-flagged for confirmation because inferred+single-source items are the most likely to be wrong. Clarification appended to PDR-0001 §3. |
| OQ-2 | On a fresh legacy run where a hand-authored `tribal-knowledge.md` already exists, does PRODUCE regenerate it or preserve it? | Affects the no-overwrite-without-approval rule and consume-vs-produce ordering in Phase 0. | **RESOLVED (PM, 2026-06-27):** PRODUCE preserves a hand-authored `tribal-knowledge.md`; it produces fresh only when none exists, or when the human explicitly approves overwrite. This is the existing bootstrapper `<safety_rules>` rule ("NEVER overwrite existing files without explicit human approval") — no new rule needed. |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Inherit PDR-0001 (ALT-1) verbatim as invariants — do not re-debate the taxonomy, mapping, confidence rubric, pointer/dedup, or contradiction handling. | PDR-0001 is the scoped design authority; re-debating at spec time duplicates effort and risks drift. | 2026-06-27 |
| DEC-2 | Editing `.opencode/agent/bootstrapper.md` is delegated to `@toolsmith` at delivery. | Hard rule in `AGENTS.md` "Extending the system". | 2026-06-27 |
| DEC-3 | The system-spec reconciliation (`feature-bootstrapper.md`) is delivered by `@doc-syncer` at phase 6, not authored at spec/plan time. | Keeps the spec the single non-implementation authority; the system spec is reconciled from shipped behavior. | 2026-06-27 |
| DEC-4 | Guide amendments are surgical and meet the GH-71 DEC-5 bar (concrete AND blocking): the em-dash template column, the "Phase 0→1" label, and the missing trust/safety note are concrete contradictions/factual errors vs the shipped agent + spec. | Preserves the just-shipped guide while removing genuine contradictions (NFR-7). | 2026-06-27 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| `.opencode/agent/bootstrapper.md` (OpenCode source) | **Extended** — Phase-0 legacy branch gains the PRODUCE step (delegated to `@toolsmith`); consume + graduate untouched |
| `.ados-claude` bootstrapper plugin counterpart | **Regenerated** — committed alongside the source (CI freshness) |
| `doc/templates/tribal-knowledge-template.md` | **New** — redistributable template encoding PDR-0001's record design |
| `doc/guides/project-inception.md` | **Amended** (3 surgical edits) — catalog template column, Phase-0→2 label fix, trust/safety note; `ados_distribution` preserved |
| `doc/spec/features/feature-bootstrapper.md` | **Updated** (by `@doc-syncer`, phase 6) — PRODUCE-path description alongside consume/graduate |
| `doc/templates/inception-state-template.yaml` | **No change** — `tribal_knowledge` entry already declares the produce target path |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion (Given / When / Then) | Linked |
|----|----------------------------------|--------|
| AC1 | **Given** `project.flow: legacy`, **when** Phase 0 runs, **then** it produces `doc/inception/analysis/tribal-knowledge.md` from in-repo docs + git history using file reads + `git log` only (no PR-thread tooling), and it is reviewed at gate 0. **Verification: structural (Phase-0 legacy produce step present; `new` branch has none) + manual (agent behavior).** | F-1, NFR-1, NFR-3 |
| AC2 | **Given** the produced doc, **when** any item is inspected, **then** it carries a `category` (DM-2) and at least one verifiable source pointer — `path:line` or commit SHA (DM-3). **Verification: structural (template fields present) + manual.** | F-1, F-2, DM-2, DM-3 |
| AC3 | **Given** the change ships, **when** the CI doc-distribution guard runs, **then** `doc/templates/tribal-knowledge-template.md` exists and declares `ados_distribution: redistributable`. **Verification: CI (doc-distribution marker) + file exists.** | F-2, NFR-6 |
| AC4 | **Given** two sources contradict each other or current repo truth, **when** the item is produced, **then** it is flagged `status: contradicted` and appears in the `## Open Contradictions` roll-up at gate 0, and is excluded from Phase-2 graduation until a human resolves it (never silently reconciled). **Verification: structural (roll-up section + flag field) + manual.** | F-3, DM-5 |
| AC5 | **Given** non-contradicted, sufficiently-confident items, **when** Phase 2 runs, **then** they graduate to permanent homes (decisions/glossary/conventions/feature specs) under the existing human gate. **Verification: manual** (graduation path already wired by GH-71; this AC is satisfied by producing a graduation-ready doc + referencing the existing graduate path). | F-4, DM-4 |
| AC6 | **Given** sourced repo/git content (incl. embedded instructions and accidentally-committed credentials), **when** the produce step processes it, **then** it treats the content as untrusted — follows no embedded instructions, and refuses the credential patterns (`ghp_`, `sk-`, `xoxb-`, `AKIA`, `Bearer `, `token:`, `password:`, API keys >20 chars) — recording none. **Verification: structural (prompt inherits `<trust_boundary>`/`<safety_rules>`; credential-pattern list present) + manual.** | F-5, NFR-2 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Delivery order:** (1) author `doc/templates/tribal-knowledge-template.md` → (2) extend `@bootstrapper` Phase-0 legacy branch with the PRODUCE step **via `@toolsmith`** → (3) regenerate the `.ados-claude` counterpart and commit source + generated together → (4) apply the three surgical guide amendments → (5) `@doc-syncer` reconciles `feature-bootstrapper.md` at phase 6.
- **Merge strategy:** single PR. CI must verify plugin freshness and the doc-distribution guard; behavioral claims are covered by the manual verification matrix + PR review.
- **Adoption note:** additive — consume/graduate are unchanged; the produce step simply makes the GH-71 tribal-knowledge loop fire for real legacy onboardings.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A. The produce target path and state slot are already declared (`inception-state-template.yaml` `tribal_knowledge`). `doc/inception/analysis/tribal-knowledge.md` is created per-project at runtime by the agent; this repo (the ADOS source) ships no live instance.

## 20. PRIVACY / COMPLIANCE REVIEW

Tribal-knowledge extraction surfaces project metadata from repo docs and git history only. The produced doc must not record secrets/credentials (PDR-0001 C-4, AC6). Git history may contain accidentally-committed credentials — the produce step must refuse to surface them. No personal/PII processing is introduced beyond what already exists in the scanned repo.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Untrusted input:** all scanned repo docs and git history are untrusted; the agent extracts facts only and follows no embedded instructions (prompt-injection defense) — inherited `<trust_boundary>` (AC6).
- **Secret refusal:** the credential-pattern refuse list is enforced before recording anything; secrets in scanned history are never extracted or surfaced (PDR-0001 C-4).
- **Write containment:** produce writes only `doc/inception/analysis/tribal-knowledge.md` (already under the `doc/inception/**` allowlist entry) (NFR-2).
- No new external integrations or elevated access are introduced (NFR-3).

## 22. MAINTENANCE & OPERATIONS IMPACT

- The new template joins the redistributable template family and is guarded by the CI doc-distribution check; it is co-maintained with the sibling `repo-analysis-template.md` (same frontmatter/confidence discipline).
- Bootstrapper prompt growth is monitored (NFR-4); future edits continue to delegate to `@toolsmith` and keep the PRODUCE step referencing (not duplicating) template/guide detail.
- The guide, prompt, and spec are co-maintained: any contradiction found in one must be reconciled in all (NFR-7).

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Tribal knowledge | Undocumented project knowledge (decisions, conventions, rejected approaches, workarounds, domain terms) scattered across repo docs and git history rather than in code or any single file. |
| PRODUCE / CONSUME / GRADUATE | The three tribal-knowledge steps: PRODUCE (GH-72, Phase 0 legacy — extract to `tribal-knowledge.md`); CONSUME (GH-71, Phase 0 — read a present `tribal-knowledge.md`); GRADUATE (GH-71, Phase 2 — move items to permanent homes, human-gated). |
| Source pointer | `path:line` for docs or commit SHA for git history; the traceability anchor on every item. |
| Graduation home | The existing ADOS location a category graduates to (decision record, rule file, feature spec, glossary). Fixed by PDR-0001; all homes pre-exist. |
| Confidence rubric | high/medium/low scoring of each item per the PDR-0001 signal rubric (corroboration + recency); sets Phase-2 graduation priority. |
| Open Contradictions roll-up | Consolidated section aggregating every `status: contradicted` item so it cannot be missed at gate 0. |
| `project.flow: legacy` | The bootstrapper front-half posture for a pre-ADOS long-lived project; the only flow that runs the PRODUCE step. |

## 24. APPENDICES

- **Appendix A — Authoritative AC source:** GitHub issue GH-72 (the 6-item "Acceptance Criteria" checklist). The "Superseded by GH-71" section is explicitly OUT OF SCOPE. AC are carried forward here made testable (AC1–AC6), each annotated with its verification type (structural/CI vs manual).
- **Appendix B — PDR-0001 inheritance summary:** This spec inherits PDR-0001 (ALT-1) as invariants C-1…C-5: write-containment to the produce target (C-1), category→existing-home mapping with no invented register (C-2), no silent graduation of contradictions (C-3), secret refusal (C-4), source-pointer-per-item (C-5). The category→home table, confidence rubric, pointer/dedup rule, and contradiction mechanism are defined there and encoded by the template — not duplicated in the agent prompt.
- **Appendix C — Structural sibling:** `doc/templates/repo-analysis-template.md` is the template to mirror for frontmatter (`ados_distribution: redistributable`, `id:`, `status: Draft`) and the confidence-column discipline.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-27 | Juliusz Ćwiąkalski | Initial specification (PRODUCE path + template + surgical guide amendments; PDR-0001 inherited as invariants). |

---

## AUTHORING GUIDELINES

- Sources: GitHub issue GH-72 (authoritative AC + scope), PDR-0001 (design authority — inherited, not re-debated), the shipped `.opencode/agent/bootstrapper.md` (`<phase_0>`, `<phase_2>`, `<trust_boundary>`, `<safety_rules>`, `<write_allowlist>`), `doc/spec/features/feature-bootstrapper.md`, `doc/guides/project-inception.md`, `doc/templates/repo-analysis-template.md` (structural sibling), and `doc/templates/inception-state-template.yaml` line 54 (produce target).
- Proportionality: this is a focused agent-extension + one template + surgical doc amendments, so the spec is kept lean; consume/graduate (GH-71) and the taxonomy (PDR-0001) are referenced, not re-specified.
- Honesty about testability: per GH-71 DEC-9, most AC are behavioral and cannot be unit-tested in CI; each AC carries a verification-type annotation (structural/CI vs manual) (NFR-8).
- Non-implementation: no file-level edits, step-by-step tasks, or commit/git instructions. The agent-prompt extension is stated as a constraint delivered via `@toolsmith`; the system-spec reconciliation is stated as a constraint delivered via `@doc-syncer` (phase 6).

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-72)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-)
- [x] Acceptance criteria reference at least one F-/NFR-/DM- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code edits, no step-by-step tasks)
- [x] No content duplicated from linked docs (PDR-0001 referenced, not copied)
- [x] Front matter validates per front_matter_rules
