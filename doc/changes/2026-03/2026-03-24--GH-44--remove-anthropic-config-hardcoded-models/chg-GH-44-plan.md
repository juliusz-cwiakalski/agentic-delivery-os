---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski.com/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/changes/2026-03/2026-03-24--GH-44--remove-anthropic-config-hardcoded-models/chg-GH-44-plan.md
---
# Implementation Plan: GH-44

## Scope

Delete Anthropic config file and remove model frontmatter from all agent definitions.

---

## Phase 1: Delete Anthropic Config

### Task 1.1: Remove ToS-violating config file

**File**: `.opencode/opencode-anthropic.jsonc`

**Action**: Delete file

**Command**:
```bash
rm .opencode/opencode-anthropic.jsonc
```

**Verification**: `ls .opencode/opencode-anthropic.jsonc` should fail

---

## Phase 2: Remove Model Lines from Agents

### Task 2.1: Architect

**File**: `.opencode/agent/architect.md`

**Action**: Remove line 11 (`model: anthropic/claude-opus-4-6`) from frontmatter

### Task 2.2: Bootstrapper

**File**: `.opencode/agent/bootstrapper.md`

**Action**: Remove line 7 (`model: anthropic/claude-opus-4-6`) from frontmatter

### Task 2.3: Coder

**File**: `.opencode/agent/coder.md`

**Action**: Remove lines 8-9 from frontmatter:
```
model: anthropic/claude-opus-4-6
#model: github-copilot/gpt-4.1
```

### Task 2.4: Committer

**File**: `.opencode/agent/committer.md`

**Action**: Remove lines 8-9 from frontmatter:
```
model: anthropic/claude-sonnet-4-6
#model: github-copilot/gpt-5-mini
```

### Task 2.5: Designer

**File**: `.opencode/agent/designer.md`

**Action**: Remove line 12 (`model: anthropic/claude-opus-4-6`) from frontmatter

### Task 2.6: Doc-syncer

**File**: `.opencode/agent/doc-syncer.md`

**Action**: Remove line 8 (`model: anthropic/claude-opus-4-6`) from frontmatter

### Task 2.7: Editor

**File**: `.opencode/agent/editor.md`

**Action**: Remove lines 10-12 from frontmatter:
```
#model: google/gemini-3-pro-preview
model: anthropic/claude-opus-4-6
#model: github-copilot/gemini-3-pro-preview
```

### Task 2.8: External-researcher

**File**: `.opencode/agent/external-researcher.md`

**Action**: Remove lines 7-8 from frontmatter:
```
#model: anthropic/claude-sonnet-4-6
model: github-copilot/gpt-5-mini
```

### Task 2.9: Fixer

**File**: `.opencode/agent/fixer.md`

**Action**: Remove line 10 (`model: anthropic/claude-opus-4-6`) from frontmatter

### Task 2.10: Image-generator

**File**: `.opencode/agent/image-generator.md`

**Action**: Remove line 8 (`model: anthropic/claude-opus-4-6`) from frontmatter

### Task 2.11: Image-reviewer

**File**: `.opencode/agent/image-reviewer.md`

**Action**: Remove line 8 (`model: anthropic/claude-opus-4-6`) from frontmatter

### Task 2.12: Plan-writer

**File**: `.opencode/agent/plan-writer.md`

**Action**: Remove line 8 (`model: anthropic/claude-opus-4-6`) from frontmatter

### Task 2.13: PM

**File**: `.opencode/agent/pm.md`

**Action**: Remove line 8 (`model: anthropic/claude-opus-4-6`) from frontmatter

### Task 2.14: PR-manager

**File**: `.opencode/agent/pr-manager.md`

**Action**: Remove line 8 (`model: anthropic/claude-sonnet-4-6`) from frontmatter

### Task 2.15: Review-feedback-applier

**File**: `.opencode/agent/review-feedback-applier.md`

**Action**: Remove line 7 (`model: anthropic/claude-opus-4-6`) from frontmatter

### Task 2.16: Reviewer

**File**: `.opencode/agent/reviewer.md`

**Action**: Remove line 8 (`model: anthropic/claude-opus-4-6`) from frontmatter

### Task 2.17: Runner

**File**: `.opencode/agent/runner.md`

**Action**: Remove lines 8-10 from frontmatter:
```
#model: anthropic/claude-sonnet-4-6
model: github-copilot/gpt-5-mini
```

### Task 2.18: Spec-writer

**File**: `.opencode/agent/spec-writer.md`

**Action**: Remove line 8 (`model: anthropic/claude-opus-4-6`) from frontmatter

### Task 2.19: Test-plan-writer

**File**: `.opencode/agent/test-plan-writer.md`

**Action**: Remove line 8 (`model: anthropic/claude-opus-4-6`) from frontmatter

### Task 2.20: Toolsmith

**File**: `.opencode/agent/toolsmith.md`

**Action**: Remove lines 8-10 from frontmatter:
```
#model: openai/gpt-5.2
model: anthropic/claude-opus-4-6
#model: anthropic/claude-opus-4-5
```

**IMPORTANT**: Do NOT modify lines 586-669 (model_profiles section inside prompt body) — that is educational content about model capabilities.

---

## Phase 3: Update Documentation

### Task 3.1: Update AGENTS.md

**File**: `AGENTS.md`

**Action**: Add note about model configuration in the "Extending the system" section.

**Change**: After line 125 (before "- Keep prompts tight"), add:
```markdown
- **Model configuration is separate** — models are assigned in `opencode*.jsonc` config files, not in agent definitions. Agent files describe behavior; config files define which model runs them.
```

---

## Summary

| Phase | Tasks | Files |
|-------|-------|-------|
| Phase 1 | 1 | 1 file deleted |
| Phase 2 | 20 | 20 files modified (frontmatter only) |
| Phase 3 | 1 | 1 file modified |
| **Total** | **22** | **22 files** |