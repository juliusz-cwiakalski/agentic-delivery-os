# GH-374 — legacy provider-policy migration output (evidence)

Captured on 2026-11-20 with the installed binary `jaiship 0.0.0 (build e1ebc76)`.
Every command is read-only: `--write` was never passed, and nothing under `$HOME`
or the repository was moved, copied, or deleted.

## What was attempted

The ticket asks for the legacy inputs to be converted once as compatibility
input: `~/.ados/config/profiles/deepseek.sh` and
`~/.ados/hooks/pre-opencode-iteration`.

### Attempt 1 — both sources

```
$ jaiship provider migrate legacy \
    --profiles-dir "$HOME/.ados/config/profiles" \
    --hook "$HOME/.ados/hooks/pre-opencode-iteration" --json
```

Exit `1`:

```json
{
  "schemaVersion": "delivery.result.v1",
  "exitCode": 1,
  "error": {
    "code": "provider.migrate.refused",
    "category": "user",
    "retryable": false,
    "consequence": "not_landed",
    "remediationHint": "Read the named reason, file, and line; hand-author the policy, or correct the source and re-run.",
    "summary": "provider migrate legacy refused (oversized-source) at /home/juliusz/.ados/hooks/pre-opencode-iteration: is 75215 bytes; PROVIDER_MIGRATE_SOURCE_MAX_BYTES = 65536"
  }
}
```

### Attempt 2 — profiles only

```
$ jaiship provider migrate legacy --profiles-dir "$HOME/.ados/config/profiles" --json
```

Exit `1`:

```json
{
  "schemaVersion": "delivery.result.v1",
  "exitCode": 1,
  "error": {
    "code": "provider.migrate.refused",
    "category": "user",
    "retryable": false,
    "consequence": "not_landed",
    "remediationHint": "Read the named reason, file, and line; hand-author the policy, or correct the source and re-run.",
    "summary": "provider migrate legacy refused (dynamic-value) at /home/juliusz/.ados/config/profiles/ados-agent-tiers.sh:11: is outside the assignment-only subset; only blank lines, # comments, and NAME=value or export NAME=value are accepted"
  }
}
```

The two refusals are independent: clearing one does not clear the other, and
`--profiles-dir` is all-or-nothing (there is no per-file selection).

## Source inventory (read-only)

```
$ wc -c -l "$HOME/.ados/hooks/pre-opencode-iteration"
 1672 75215 /home/juliusz/.ados/hooks/pre-opencode-iteration

$ wc -c -l "$HOME/.ados/config/profiles/"*.sh
   54  3233 ados-agent-tiers.sh
   60  3824 critique-grid-agent-tiers.sh
   50  2353 deepseek.sh
  112  6573 mixed.sh
   50  2391 openai.sh
   70  3720 zai-only.sh
   24   961 zai.sh
   80  4105 zai-top.sh
  500 27160 total
```

- The hook is a symlink to `~/.ados/config/hooks/pre-opencode-iteration`; a
  25 KB `.bak` sibling exists. 75,215 bytes is 14.6 % above the 65,536-byte
  source cap.
- `ados-agent-tiers.sh` line 11 is the first non-comment construct and is a
  parameter-expansion guard (`: "${OC_ADOS_AGENT_TIERN_MODEL:?}"`), not an
  assignment. The file contains six such guard lines before its first
  assignment.
- 7 of 8 profile files source the two shared tier files with
  `. "$_oc_ados_profile_dir/..."`, so the sourcing pattern collides with the
  assignment-only grammar independently of line 11.

## Disposition (owner decision, 2026-11-20)

The migrator is not extended to parse shell in this story. The contract is
"policy expressed only in Jaiship configuration" and "delivery runs with the
shell profiles and the hook disabled" — not "the migrator must parse every
shell construct". The policy is authored declaratively from the legacy files'
intent (see `chg-GH-374-spec.md`), and the hook is retired rather than migrated.
The migrator gaps are tracked separately as M4-S17.

Nothing in the legacy tree was written, renamed, or deleted by these commands.
