# Test Plan: GH-44

## Scope

Verification that Anthropic config is removed and no model frontmatter remains in agent files.

## Traceability Matrix

| AC | Test | Method |
|----|------|--------|
| AC1: Anthropic config deleted | File does not exist | `ls .opencode/opencode-anthropic.jsonc` returns error |
| AC2: No model: in frontmatter | Grep finds no matches | `grep -c "^model:" .opencode/agent/*.md` returns 0 for all |
| AC3: No #model: remnants | Grep finds no matches | `grep -c "#model:" .opencode/agent/*.md` returns 0 for all |
| AC4: Config files have all agents | Verify agent list | Compare config agent keys against agent files |
| AC5: AGENTS.md documented | Grep finds explanation | `grep "model.*config" AGENTS.md` returns match |

## Verification Tests

### VT1: Anthropic Config Deleted

```bash
# Should fail (file should not exist)
ls .opencode/opencode-anthropic.jsonc && exit 1 || echo "PASS: File deleted"
```

**Expected**: File does not exist

### VT2: No Model Frontmatter in Agent Files

```bash
# Should return 0 matches
grep -l "^model:" .opencode/agent/*.md
```

**Expected**: No output (no matches)

### VT3: No Commented Model Lines in Frontmatter

```bash
# Should return 0 matches
grep -n "#model:" .opencode/agent/*.md | head -20
```

**Expected**: No output (no matches)

### VT4: Toolsmith Model Profiles Preserved

```bash
# Should find model_profiles section (this is content, not frontmatter)
grep -n "model_profiles" .opencode/agent/toolsmith.md
```

**Expected**: Lines 586+ (inside prompt body, not frontmatter)

### VT5: Config Files Have All Agents

```bash
# Check opencode.jsonc has agent config
grep -o '"[a-z-]*":' .opencode/opencode.jsonc | sort
# Check opencode-github-copilot.jsonc has agent config
grep -o '"[a-z-]*":' .opencode/opencode-github-copilot.jsonc | sort
```

**Expected**: All 22 agent names present in both configs

### VT6: AGENTS.md Updated

```bash
# Should mention model configuration approach
grep -i "model.*config" AGENTS.md
```

**Expected**: Documentation explaining model configuration is config-driven

## Execution Order

1. VT1 → verify file deleted
2. VT2 → verify frontmatter clean
3. VT3 → verify no remnants
4. VT4 → verify toolsmith content preserved
5. VT5 → verify config completeness
6. VT6 → verify documentation