---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/.ai/rules/bulk-edit-verify.md
ados_distribution: redistributable
---
# Post-bulk-edit Verify Rule

Bulk and tree-wide edits can silently corrupt identifiers when a substitution pattern overlaps a longer identifier's substring (e.g. substituting `foo` also rewrites `foobar`, `myfoo`, `foo_helper`). This rule makes verification a **mandatory** step so collateral damage is caught **before** it reaches version control.

## 1. Trigger (when this rule activates)

This rule activates when **any** of the following is true:

- The edit touches **more than one file** in a single operation.
- A `sed`, `replaceAll`, or regex **substitution** is performed (even on a single file).
- A **find-and-replace over a path glob** is performed.

Single-file, single-occurrence edits are out of scope.

> **Related (#115):** large-artifact authoring increases bulk-edit exposure; see the large-artifact authoring policy. One-way cross-link — no delivery dependency.

## 2. Three-part verify-before-commit gate

Before committing a bulk edit, you **MUST**, in order:

1. **`git diff --stat`** — confirm the edited file set matches intent (no stray files, no missed files).
2. **Targeted grep for the substituted token** — confirm it landed where intended **and** did not land inside longer identifiers (the §3 substring-overlap check).
3. **Typecheck / compile gate** — for code, run the project's typecheck or build gate before committing.

The verify is a **MUST executed *before* commit** — not SHOULD, not MAY, not "after the commit lands."

## 3. Substring-overlap check

When substituting token A → B, an unanchored match silently rewrites every identifier that **contains** A. To prevent this, you **MUST** perform the substring-overlap check **both** before and after substituting:

- **Pre-substitution (planning):** grep for identifiers **containing** A — not just exact matches of A. For every longer-identifier hit, confirm it is an intended target.
- **Post-substitution (verify):** grep for B to confirm it landed where intended and did not corrupt any longer identifier.

On **any** unintended longer-identifier hit, you **MUST** use word-boundary (`\b`), anchored (`^A$`), or scoped (narrow file/path) patterns rather than an unanchored global substitution.

## 4. Clean-revert recovery contract

If verification reveals collateral damage, you **MUST**:

1. **Revert** the uncommitted edit: `git checkout -- <affected paths>`.
2. **Re-apply** with safe substitutions (word-boundary, anchored, or scoped patterns).

You **MUST NOT** attempt an in-place counter-edit to undo the damage on an already-corrupted tree. A counter-edit compounds the error, can miss damage, and obscures the true intended change. Revert + re-apply keeps the working tree honest.
