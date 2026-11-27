---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://www.x.com/juliusz)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/structured-change-artifacts/04-cli.md
---
# 04. The command surface

## Families

| Family | Reads | Writes | Notes |
|---|---|---|---|
| `jaiship change` | `get`, `lint`, `audit`, `history` | `init`, `re-tier`, `migrate`, `import` | the change is the unit |
| `jaiship spec` | `get`, `get --section` | `set`, `ac add`, `decision add`, `interface add`, `path add`, `risk add`, `oq add`, `gap add` | the contract |
| `jaiship test` | `get`, `get --case` | `case add`, `precondition add`, `coverage rebuild` | cases as data |
| `jaiship plan` | `get`, `phase get`, `conflicts` | `phase add`, `phase complete`, `step add`, `path add`, `verify add`, `conflict add` | the scheduler's input |
| `jaiship pm` | `brief` | `loop add`, `loop close`, `next add`, `next done`, `blocker add`, `blocker clear` | working memory only |
| `jaiship handover` | `get` | `record` | one bounded entry per phase |
| `jaiship context` | `bundle`, `get` | none | the only read path for agents |
| `jaiship readiness` | `assess` | none | the DoR and DoD gate |
| `jaiship review` | `bundle`, `finding list` | `finding add`, `finding resolve`, `verdict` | structured findings |
| `jaiship milestone` | `get`, `verify` | `init`, `goal add` | the milestone contract |
| `jaiship phase` | `list` | `complete`, `reopen` | existing; now fail-closed on a malformed facet |
| `jaiship blockers` | `list` | `publish`, `answer` | existing; mirrored into the PM context |

## Reads are bundles, writes are typed

An agent never reads an artifact file directly. It calls:

```bash
jaiship context bundle --for coder --change GH-416 --phase P3
jaiship context bundle --for reviewer --change GH-416 --phase P3
jaiship context bundle --for pm --change GH-416
jaiship context bundle --for spec-writer --change GH-416 --gaps AC-3,AC-1
jaiship context bundle --for coder --change GH-416 --phase P3 --findings RF-1,RF-2
jaiship context get --change GH-416 --section spec.acceptanceCriteria.AC-1
```

`--gaps` narrows a bundle to the named gaps and their related criteria and decisions.
`--findings` narrows a fix bundle to the named review findings and the paths they cite.

A write is one intent, one command, one commit:

```bash
jaiship spec ac add GH-416 \
  --id AC-3 \
  --statement "The dispatch status answer carries the additive lanePush fact." \
  --evidence test \
  --tests TC-LCMD-003
```

```bash
jaiship test case add GH-416 \
  --id TC-LCMD-003 \
  --title "The dispatch status answer carries the additive lanePush fact" \
  --acceptance AC-3 \
  --phase P3 \
  --layer behaviour \
  --path tests/behaviour/dispatch-status-lane-push.test.ts \
  --step "Run dispatch status after one recorded push." \
  --expected "Every pre-existing field is unchanged and lanePush is present."
```

```bash
jaiship plan phase add GH-416 \
  --id P3 \
  --title "The command, the renderer, and the edge wiring" \
  --acceptance AC-1,AC-2,AC-3 \
  --tests TC-LCMD-001,TC-LCMD-003 \
  --path packages/cli/src/commands/push.ts:add:producer \
  --path packages/cli/src/production.ts:modify:consumer \
  --verify "pnpm typecheck:.:0"
```

```bash
jaiship pm loop add GH-416 --text "Confirm the changeset before the full gate." --owner pm --due P4
jaiship handover record GH-416 --phase P2 --from-file /tmp/handover-P2.yaml
```

## The write pipeline

Every write command does the same six steps, in order:

1. **Parse and validate.** The arguments or the input file are validated against the facet
   schema and the cross-facet references. A refusal writes nothing.
2. **Compute generated fields.** Coverage, the affected-path union, the revision, the status,
   and `generatedBy` are computed, never taken from the author.
3. **Write atomically.** The new content goes to a temporary file in the same directory, is
   flushed, and is renamed over the target. A crash leaves the old file intact.
4. **Commit only that file.** `git add -- <path>` and `git commit -m ... -- <path>`. Unrelated
   changes in the working tree are not staged.
5. **Stamp provenance.** The commit carries the tool trailer and the change reference:

   ```text
   chore(change): add acceptance criterion AC-3 to GH-416

   Jaiship-Tool: spec ac add@0.1.0
   Change-Ref: GH-416
   Facet-Revision: 3
   ```

6. **Report.** The command prints the commit SHA, the facet revision, and the lint result. On
   any failure it restores the original file and exits non-zero.

`--dry-run` prints the diff and the commit message without writing. There is no `--no-commit`
for an agent; batching is done with one command that carries several fields, not with a
sequence of uncommitted edits.

## Auto-commit policy

- **Always commit.** The provenance is the point. A write that does not commit is a draft,
  and a draft is not readable by downstream roles.
- **Never mix code and artifacts.** The pathspec is the artifact file only. Code changes keep
  the commit primitive and the one-conventional-commit-per-change rule.
- **Squash at merge.** Tool commits are history, not review material. The pull request shows
  the final facet, and the squash merge collapses the tool commits into the change's commit.
- **No rebase inside a write.** If the branch is behind, the command fails with
  `change.branch.behind`; the PM syncs first. A write never rewrites history.
- **Batch when possible.** `spec set --from-file`, `plan phase add --from-file`, and
  `handover record --from-file` commit once for a whole facet revision. Field-level commands
  are for small, auditable edits.

## Provenance and hand-edit detection

Three layers, in order of strength:

1. **Path permission (prevention).** If the harness supports path-scoped permissions, deny
   `edit` and `write` on `doc/changes/**` for every agent. The CLI runs outside the agent's
   permission scope. This is the only layer that prevents a hand edit rather than detecting
   it.
2. **CI lint (detection).** Any commit that touches `doc/changes/**` must carry the
   `Jaiship-Tool` trailer. A commit without it fails with `change.provenance.missing`. The
   file also carries `generatedBy`; lint checks that the trailer and the field agree.
3. **Human import (controlled escape).** A human who edits a file by hand runs
   `jaiship change import <ref> --facet <facet> --file <path>`; the tool validates, commits
   with a `Human-Edit` trailer, and records the waiver in the PM context. The edit is not
   silent, and it is not an accusation.

Signing is optional and is not a substitute for the path permission. A signature proves who
committed, not that the content is valid. If the owner wants tamper evidence, sign the merge
commit; do not make a signing key a prerequisite for every artifact write.

## Error model

- Exit 0: the command completed and returned its declared verdict.
- Exit 1: refused, invalid, or a negative verdict. Nothing was written.
- Exit 2: a platform, state, or provider failure prevented the operation. The file is
  unchanged.

The JSON envelope carries `code`, `detail`, `path`, `field`, and `limit`:

```json
{
  "code": "change.budget.exceeded",
  "detail": "prose.rationale is 1480 words; the L budget is 1200",
  "path": "doc/changes/2026-11/2026-11-27--GH-416--lane-pushes-own-evidence-commit/chg-GH-416-spec.yaml",
  "field": "prose.rationale",
  "limit": 1200
}
```

## What agents may and may not do

May:

- Read through `context bundle` and `context get`.
- Write through the typed commands for their role.
- Run `jaiship lint change`, `jaiship readiness assess`, and the gates.
- Record a handover and complete a phase.

May not:

- Call `edit` or `write` on any file under `doc/changes/**`.
- Run `git add` or `git commit` for an artifact.
- Read a whole artifact with `read`, `cat`, or `grep` when a bundle exists.
- Edit a tool-generated field (`coverage`, `affectedPaths`, `status`, `revision`,
  `generatedBy`).

## What humans may do

- Use the same typed commands.
- Edit a file locally and import it with a recorded waiver.
- Review the facet diff on the pull request; the tool commits are squashed, so the diff is the
  final shape, not the noise.

## Migration and compatibility

- The CLI reads both the old `.md` artifacts and the new `.yaml` facets during migration; it
  writes only the new shape.
- `jaiship change migrate <ref>` converts an in-flight change in one commit, after a backup
  commit, and records the migration in the PM context.
- The compatibility reader is removed after two milestones.
- A write to an old file is refused with `change.facet.legacy`.

## Open implementation questions

- Does the harness support a path-scoped deny for `edit`, `write`, and `read`? If not, which
  of the three can be denied, and what is the fallback for the others?
- Is one commit per field-level command too noisy for a large change, even with squash at
  merge? The alternative is one commit per facet revision, with field commands staging to a
  pending file and `facet commit` writing once. The pack recommends always-commit and
  measures the noise.
- Should the tool trailer be a Git trailer or a note? A trailer is machine-readable and
  survives a squash; a note does not. Recommend a trailer.
