---
change:
  ref: GH-322
  type: fix
  status: Proposed
  slug: sanitize-gh310-pm-notes
  title: "Sanitize absolute user path in GH-310 pm-notes to restore the privacy-literals gate"
  owners: [Juliusz Ćwiąkalski]
  service: delivery-os
  milestone: "M2: Ceremonies, measurement, and memory"
  labels: [bug, change]
  version_impact: none
  audience: internal
  security_impact: low
  risk_level: low
  dependencies:
    internal: ["GH-310 artifact (PR #321 at c1f0d6fa) — owns the affected file", "privacy-literals invariant and registry — used unmodified"]
    external: []
---

# CHANGE SPECIFICATION
> **PURPOSE**: Un-red `main-tools` by removing the single absolute operator path recorded in the GH-310 change artifact, so the privacy-literals invariant passes again without altering any recorded outcome.

## 1. SUMMARY
`main-tools` is red at merge commit `c1f0d6fa` (PR #321, GH-310): CI job `TS repository invariants` fails on exactly one privacy-literals violation — an operator-local absolute temp root recorded inside a quality-gate command line. The fix substitutes that one literal with the repository-relative gate convention and changes nothing else.

## 2. CONTEXT
### 2.1 Current State Snapshot
- Reproduced: `bun run scripts/checks/privacy-literals.ts` exits 1 with exactly one violation, rule `private.absolute-user-path` at `doc/changes/2026-11/2026-11-14--GH-310--cross-repository-changes/chg-GH-310-pm-notes.yaml:279` (fingerprint `c796b58bf3a81320`); 4070 files scanned, no other violation.
- Line 279 holds an absolute temp root rooted at the operator's home directory as the `TMPDIR` value of a recorded phase-9 gate command. That file's other gate temp-root mentions (lines 77, 409, 514, 531) already use the `$GATE_TMPDIR` placeholder and do not trip the rule.
- Accepted local-gate convention is the repository-relative temp root `TMPDIR=$PWD/tmp/tmpdir` (`AGENTS.md`; `.ai/memory/lessons/lesson-2026-001-ci-baseline-parity-tmpdir.md`).

### 2.2 Pain Points / Gaps
- A red `main-tools` blocks the invariant job for every unrelated change.
- The offending value is incidental evidence formatting, not a verdict, count, or hash.

## 3. PROBLEM STATEMENT
Because one committed change artifact embeds an operator-local absolute path, `main-tools` cannot pass the repository invariant job, resulting in a red integration branch that blocks unrelated delivery over a cosmetic evidence literal.

## 4. GOALS
- **G-1**: Eliminate the single `private.absolute-user-path` violation so the invariant job is green on `main-tools`.
- **G-2**: Preserve every recorded outcome in the affected artifact byte-for-byte.
- **G-3**: Keep the change docs-only and scoped to this one literal.

### 4.1 Success Metrics / KPIs
| Metric | Target |
|--------|--------|
| `bun run scripts/checks/privacy-literals.ts` | exit 0, 0 violations |
| Absolute user paths left in the GH-310 change folder | 0 |
| Non-literal content change in the affected artifact | 0 bytes |
| Source / prompt / workflow / spec files changed | 0 |

### 4.2 Non-Goals
- **NG-1**: Rewriting or re-litigating GH-310 history, verdicts, or evidence.
- **NG-2**: Editing any other change artifact, phase state, or pm-notes record.
- **NG-3**: Changing the privacy-literals rule, its registry, or adding allowlist entries.
- **NG-4**: Changing the gate command convention itself.

## 5. FUNCTIONAL CAPABILITIES
| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | The committed GH-310 gate evidence line carries the repository-relative temp root instead of the absolute operator path, and the invariant passes | Restores the failing CI job with the smallest possible edit |

### 5.1 Capability Details
**F-1** — The temp-root prefix in the recorded phase-9 gate evidence line becomes the repository-relative convention. Surrounding command text, verdicts, pass/skip/fail counts, file counts, commit hashes, and phase timestamps stay identical.

## 6. USER & SYSTEM FLOWS
Verification-only: maintainer or CI runs the invariant → checker scans committed files → 0 violations → exit 0. Reviewer diffs the artifact → one value changed on one line → all recorded outcomes identical.

## 7. SCOPE & BOUNDARIES
### 7.1 In Scope
- One literal substitution on one line of the GH-310 pm-notes evidence entry, plus this change's own artifacts.

### 7.2 Out of Scope
- [OUT] Any change to GH-310 implementation, plan, test plan, or spec content.
- [OUT] Any other repository file, including other change artifacts and memory records.
- [OUT] Any change to the invariant script, rules, registry, or allowlist.
- [OUT] Any change to the documented gate convention.
- [OUT] Any unrelated defect found while verifying.

### 7.3 Deferred / Maybe-Later
- A preventive gate rejecting absolute operator paths at authoring time (not requested by this ticket).

## 8. INTERFACES & INTEGRATION CONTRACTS
### 8.1 REST / HTTP Endpoints
N/A.

### 8.2 Events / Messages
N/A.

### 8.3 Data Model Impact
| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Gate-evidence note text in the GH-310 pm-notes | Free-text field; one embedded temp-root value replaced. Structure, ordering, and other entries unchanged. |

### 8.4 External Integrations
N/A.

### 8.5 Backward Compatibility
Fully compatible; the artifact's meaning and evidentiary value are preserved.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)
| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Invariant passes (binding) | `bun run scripts/checks/privacy-literals.ts` exits 0 with 0 violations |
| NFR-2 | Diff containment | Exactly 1 modified line in 1 pre-existing file; 0 bytes changed in verdicts, counts, hashes, or timestamps |
| NFR-3 | Aggregate battery unaffected (best-effort) | `TMPDIR=$PWD/tmp/tmpdir ... pnpm check` exits 0 with no new failures, when feasible |
| NFR-4 | Scope containment | 0 source, prompt, workflow, or system-spec files changed |
| NFR-5 | Security posture | 0 absolute user paths remain in the affected artifact |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS
N/A — evidence is the CI job verdict and the local check exit code.

## 11. RISKS & MITIGATIONS
| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | The repository-relative temp root `tmp/tmpdir` may sit inside a working tree, unlike a host temp root | L | M | Convention already accepted by the ticket and `AGENTS.md`; the check under test is static and inspects content, not the gate runner's actual temp location | L |
| RSK-2 | Editing committed evidence may read as rewriting history | M | L | Literal-only substitution; every verdict, count, hash, and timestamp stays byte-identical and is visible in the diff | L |
| RSK-3 | Sanitizing one literal could conceal other absolute paths | M | L | Baseline scan covered 4070 files with no other violation; the check stays unmodified and authoritative | L |

## 12. ASSUMPTIONS
- The single reported violation is the only blocker in the failing CI job.
- The repository-relative temp root is the accepted convention for recorded gate commands.
- `main-tools` remains the integration branch and the PR target.

## 13. DEPENDENCIES
| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | GH-310 artifact merged at `c1f0d6fa` | Affected file already on `main-tools` |
| Blocks | Every change targeting `main-tools` | Un-reds the aggregate invariant job |

## 14. OPEN QUESTIONS
None.

## 15. DECISION LOG
| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Replace only the absolute temp root with the repository-relative convention; leave all other content untouched | The invariant is the binding authority; the value is a command line, not a measurement, so a literal-only substitution changes no outcome | 2026-11-15 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)
| Component | Impact |
|-----------|--------|
| GH-310 change artifact (pm-notes evidence entry) | Updated — one literal |
| Privacy-literals invariant and registry | Unchanged — verification only |
| Tooling, prompts, workflows, system spec | Unchanged |

## 17. ACCEPTANCE CRITERIA
| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** the sanitized branch, **when** the privacy-literals check runs, **then** it exits 0 and reports 0 violations | F-1, NFR-1 |
| AC-F1-2 | **Given** the sanitized branch, **when** the GH-310 change folder is searched for the operator home-directory prefix, **then** no match is returned | F-1, NFR-5 |
| AC-F1-3 | **Given** the diff of the affected artifact, **when** it is reviewed, **then** it contains only the substitution of that one value on one line, and every recorded verdict string, count, commit hash, and phase timestamp is byte-identical | F-1, NFR-2 |
| AC-F1-4 | **Given** a feasible gate run, **when** the aggregate battery runs with the repository-relative temp root, **then** it exits 0 with no new failures (best-effort; AC-F1-1 stays binding) | NFR-3 |
| AC-F1-5 | **Given** the delivered pull request, **when** it is opened, **then** it targets `main-tools`, stays open for merge authority, and touches no other ticket's artifacts | NFR-4 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)
One commit through the commit primitive with a conventional `fix` subject; PR to `main-tools`, left open. No rollout, migration, or communication step.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)
N/A.

## 20. PRIVACY / COMPLIANCE REVIEW
Improves privacy hygiene by removing an operator-specific absolute path from committed content; no personal-data processing introduced.

## 21. SECURITY REVIEW HIGHLIGHTS
Reduces accidental disclosure of an operator's local filesystem layout; no new attack surface.

## 22. MAINTENANCE & OPERATIONS IMPACT
None beyond the red-to-green CI state.

## 23. GLOSSARY
| Term | Definition |
|------|------------|
| privacy-literals invariant | Repository check rejecting configured privacy-sensitive literal classes in committed files |
| absolute user path | A path rooted at an operator's home directory rather than a repository root |
| repository-relative temp root | The gate convention `TMPDIR=$PWD/tmp/tmpdir`, relative to the repository root |

## 24. APPENDICES
N/A.

## 25. DOCUMENT HISTORY
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-15 | @spec-writer (delegated by @pm) | Initial specification |

---

## AUTHORING GUIDELINES
Sources: GitHub issue 322 (authoritative), GH-322 pm-notes intake/reproduction notes, `AGENTS.md` gate convention, and the recorded repository-relative temp-root lesson. Violation facts were established in `clarify_scope` and are cited, not re-derived. Sections without substance are marked N/A rather than expanded — this is a docs-only, one-literal fix-forward with no product-facing capability.

## VALIDATION CHECKLIST
- [x] `change.ref` matches `workItemRef` (GH-322); `status` is "Proposed"; `owners` populated
- [x] Sections 1-25 present in order, plus authoring guidelines and checklist
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-); no OQ- (none open)
- [x] Acceptance criteria use Given/When/Then and each links a F-/NFR- ID
- [x] NFRs measurable; risks carry Impact & Probability and residual risk
- [x] No implementation steps or code-level instructions; no content duplicated from linked docs
- [x] Front matter validates per front_matter_rules
