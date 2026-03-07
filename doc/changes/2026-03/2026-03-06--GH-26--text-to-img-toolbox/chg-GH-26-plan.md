---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/changes/2026-03/2026-03-06--GH-26--text-to-img-toolbox/chg-GH-26-plan.md

id: chg-GH-26-text-to-img-toolbox
status: Complete
created: "2026-03-07T00:00:00Z"
last_updated: "2026-03-07T00:00:00Z"
owners: [Juliusz Ćwiąkalski]
service: tools
labels: [cli, image-generation, agent-tuning, convention]
links:
  change_spec: ./chg-GH-26-spec.md
summary: >
  Port the battle-tested ~2100-line text-to-image bash CLI from a private project,
  publish it as tools/text-to-image with ADOS conventions (--help, --version, version check,
  doc-linked errors), create comprehensive per-provider documentation, tune the
  @image-generator agent for model discovery, enhance add-header-location.sh for bash files,
  and update AGENTS.md with new references.
version_impact: minor
---

# IMPLEMENTATION PLAN — GH-26: Publish text-to-image CLI tool, agent tuning, and tools convention

## Context and Goals

This change delivers six interrelated deliverables that together establish the first CLI tool in `tools/` and make the `@image-generator` agent functional:

1. **`tools/text-to-image`** — Port and adapt a ~2100-line bash script from a private project, renaming `text-to-img` to `text-to-image`, updating config directory to `~/.ai/text-to-image/`, removing all private project references, and adding new features (automatic version check, doc-linked error messages, tools-convention-compliant `--help` and `--version`).
2. **Test suite** — Port and adapt 3 test files (unit: ~760 lines / 42 tests, integration: ~590 lines / 21 tests, performance: ~410 lines / 8 tests) with all references updated to new naming.
3. **User documentation** (`doc/tools/text-to-image.md`) — Comprehensive guide with per-provider setup (7 providers), stable heading anchors for doc-linked errors, versioned changelog.
4. **Agent tuning** (`.opencode/agent/image-generator.md`) — Add model discovery workflow (`--list-models --output-format json`), task-based routing table, and updated CLI reference.
5. **`scripts/add-header-location.sh` enhancement** — Detect and process bash scripts (`.sh` extension or shebang line), adding MIT license headers as bash comments after shebang.
6. **`AGENTS.md` updates** — Add `doc/tools/text-to-image.md` and `doc/guides/tools-convention.md` to Key References.

### Key porting decisions (from PM notes)

- Script location: `tools/text-to-image` (no `.sh` extension, executable)
- `APP_NAME` changes from `text-to-img` to `text-to-image`
- Config directory: `~/.ai/text-to-image/` (was `~/.ai/text-to-img/`)
- `LOG_TAG` changes from `(text-to-img)` to `(text-to-image)`
- Env var prefix: `TEXT_TO_IMAGE_` (was `TEXT_TO_IMG_`)
- All private project references (menuvivo, PDEV-29, private URLs) must be removed
- Tests: `tools/.tests/test-text-to-image-{unit,integration,performance}.sh`

### Open questions

- OQ-2 (from spec): Version check fetches the full raw script (~2100 lines) to grep `APP_VERSION`. Consider a dedicated version file in a future release. For v1.0.0, use the proven approach from the source.

### Blueprint sources

| Source file | Target |
|-------------|--------|
| `<private>/scripts/text-to-img.sh` (~2151 lines) | `tools/text-to-image` |
| `<private>/scripts/.tests/test-text-to-img-unit.sh` (~759 lines) | `tools/.tests/test-text-to-image-unit.sh` |
| `<private>/scripts/.tests/test-text-to-img-integration.sh` (~591 lines) | `tools/.tests/test-text-to-image-integration.sh` |
| `<private>/scripts/.tests/test-text-to-img-performance.sh` (~408 lines) | `tools/.tests/test-text-to-image-performance.sh` |
| `<private>/doc/tools/text-to-img.md` (~320 lines) | `doc/tools/text-to-image.md` (rewritten, expanded) |

## Scope

### In Scope

- Port and adapt `tools/text-to-image` from private project source
- Rename APP_NAME, config dir, env var prefix, LOG_TAG throughout
- Remove all private project references (menuvivo, internal URLs, PDEV-*)
- Implement `--help` and `--version` per `doc/guides/tools-convention.md`
- Implement automatic version check (24h cache, silent failure, opt-out)
- Implement doc-linked error messages for unconfigured providers
- Create `doc/tools/text-to-image.md` with per-provider setup guides and stable anchors
- Port and adapt all 3 test suites to new naming and paths
- Tune `@image-generator` agent for model discovery and task-based routing
- Enhance `scripts/add-header-location.sh` for bash script support
- Add tests for bash script support to `scripts/.tests/test-add-header-location.sh`
- Update `AGENTS.md` Key References
- Apply MIT license headers to all new files

### Out of Scope

- Adding new providers beyond the 7 already implemented
- Image editing, inpainting, outpainting
- Package manager distribution (homebrew, npm)
- Changes to agents other than `@image-generator`
- Changes to `doc/guides/tools-convention.md` (already written by PM)

### Constraints

- Must follow `.ai/rules/bash.md` for all bash scripts
- Must follow `doc/guides/tools-convention.md` for the tool
- Must not introduce any private project references
- All tests must pass before moving to next phase

### Risks

| Risk | Mitigation |
|------|-----------|
| Private project references leak (RSK-1) | Systematic search-replace during porting; grep for known identifiers before commit |
| Large script (~2100 lines) makes review difficult (RSK-4) | Structured sections per bash rules; phase-by-phase commits |
| Test adaptation from private project fails (RSK-5) | Tests rewritten with ADOS paths; fixtures use temp directories |

### Success Metrics

- `tools/text-to-image --help`, `--version`, `--dry-run`, `--list-models` all exit 0
- All unit tests pass (42+ tests)
- Documentation covers all 7 providers with stable anchor URLs
- Agent can invoke `--list-models --output-format json` and parse result
- `scripts/add-header-location.sh` processes `.sh` files and shebang-detected bash files
- Zero matches for private project identifiers in committed files

## Phases

### Phase 1: Core tool — port and adapt `tools/text-to-image`

**Goal**: Create the first CLI tool in `tools/` by porting the ~2100-line bash script with all ADOS adaptations and new features.

**Tasks**:

- [x] Create `tools/` and `tools/.tests/` directories (AC-F1-1, AC-F1-2) — created
- [x] Copy source script to `tools/text-to-image` and make executable (`chmod +x`) (AC-F1-1) — ported ~2100 lines
- [x] Rename all occurrences: `text-to-img` to `text-to-image`, `TEXT_TO_IMG` to `TEXT_TO_IMAGE` throughout the script (AC-F1-1, AC-CLEAN-1) — sed bulk rename
- [x] Update `APP_NAME` to `text-to-image`, `LOG_TAG` to `(text-to-image)` (AC-F1-1) — verified
- [x] Update config directory default from `~/.ai/text-to-img` to `~/.ai/text-to-image` (AC-DM1-1) — verified
- [x] Remove all private project references (menuvivo, PDEV-*, internal URLs, private doc paths) (AC-CLEAN-1) — grep confirms 0 matches
- [x] Rewrite `show_help()` per tools convention: include tool name+version, usage syntax, basic examples (3-5), options reference, doc link to `doc/tools/text-to-image.md` on GitHub, license info (AC-F1-1) — convention-compliant
- [x] Rewrite `show_version()` per tools convention: multi-line with name+version, copyright, MIT, latest-version URL (AC-F1-2) — convention-compliant
- [x] Implement `_check_version()` function: fetch raw script from GitHub, extract `APP_VERSION`, compare, 24h cache in `~/.ai/text-to-image/version-check`, silent failure, opt-out via `TEXT_TO_IMAGE_NO_VERSION_CHECK=true` (AC-F9-1, AC-F9-2, AC-F9-3) — implemented
- [x] Implement doc-linked error messages: define `DOC_BASE_URL` constant, `PROVIDER_DOC_ANCHORS` associative array mapping provider names to doc heading anchors, update `provider_not_configured_error()` to include GitHub URL to provider-specific doc section (AC-F10-1) — implemented with 7 provider anchors
- [x] Add ADOS MIT license header (3-line bash comment after shebang) (G-6) — added
- [x] Verify `--dry-run` works end-to-end with new naming (AC-F1-3) — exits 0
- [x] Verify `--list-models` and `--all-models` work with `--output-format json` (AC-F4-1, AC-F4-2) — valid JSON output
- [x] Run `grep -r` for private project identifiers to confirm zero matches (AC-CLEAN-1) — confirmed 0 matches

**Acceptance Criteria**:

- Must: `tools/text-to-image --help` exits 0 with convention-compliant output (AC-F1-1)
- Must: `tools/text-to-image --version` exits 0 with multi-line convention-compliant output (AC-F1-2)
- Must: `tools/text-to-image --dry-run --prompt "test" --output /tmp/test.png` exits 0 (AC-F1-3)
- Must: `tools/text-to-image --list-models --output-format json` outputs valid JSON array (AC-F4-2)
- Must: Zero occurrences of private project identifiers in the file (AC-CLEAN-1)
- Must: Config directory created with permissions `700` on first run (AC-DM1-1)
- Should: Version check runs silently and does not block execution (AC-F9-1, AC-F9-3)

**Files and modules**:

- `tools/text-to-image` (new, ~2200 lines)
- `tools/.tests/` (new directory)

**Tests**:

- Manual: `tools/text-to-image --help`, `--version`, `--dry-run --prompt "test" --output /tmp/test.png`
- Manual: `tools/text-to-image --list-models --output-format json | jq .`
- Manual: `grep -rn "menuvivo\|text-to-img\|PDEV-" tools/text-to-image` (expect 0 matches)

**Completion signal**: `feat(tools): add text-to-image CLI tool — port from private project with ADOS conventions`

---

### Phase 2: Tests — port and adapt all 3 test suites

**Goal**: Port the 3 test suites (unit, integration, performance) from the private project with all naming and path adaptations.

**Tasks**:

- [x] Copy unit test source to `tools/.tests/test-text-to-image-unit.sh` and make executable (AC-TEST-1) — done
- [x] Rename all occurrences in unit tests: `text-to-img` to `text-to-image`, `TEXT_TO_IMG` to `TEXT_TO_IMAGE`, update `source` path to `${SCRIPT_DIR}/text-to-image`, update `TEST_TAG` to `(test-text-to-image-unit)` (AC-TEST-1) — bulk sed + source path fix
- [x] Remove private project references from unit tests (AC-CLEAN-1) — grep confirms 0 matches
- [x] Copy integration test source to `tools/.tests/test-text-to-image-integration.sh` and make executable (AC-TEST-2) — done
- [x] Rename all occurrences in integration tests: same renames as unit, update `TEST_TAG` to `(test-text-to-image-integration)` (AC-TEST-2) — done
- [x] Remove private project references from integration tests (AC-CLEAN-1) — grep confirms 0 matches
- [x] Copy performance test source to `tools/.tests/test-text-to-image-performance.sh` and make executable (AC-TEST-3) — done
- [x] Rename all occurrences in performance tests: same renames as unit, update `TEST_TAG` to `(test-text-to-image-performance)` (AC-TEST-3) — done
- [x] Remove private project references from performance tests (AC-CLEAN-1) — grep confirms 0 matches
- [x] Add unit tests for new features: `_check_version()` opt-out, `_check_version()` silent failure, doc-linked error messages, updated `show_help()` content, updated `show_version()` content (AC-F9-2, AC-F9-3, AC-F10-1, AC-F1-1, AC-F1-2) — 7 new tests added
- [x] Add ADOS MIT license header to all 3 test files (G-6) — added
- [x] Run all 3 test suites and verify they pass (AC-TEST-1, AC-TEST-2, AC-TEST-3) — unit: 52/52, integration: 21/21, performance: 8/8

**Acceptance Criteria**:

- Must: `bash tools/.tests/test-text-to-image-unit.sh` — all tests pass (AC-TEST-1)
- Must: `bash tools/.tests/test-text-to-image-integration.sh` — all tests pass (AC-TEST-2)
- Must: `bash tools/.tests/test-text-to-image-performance.sh` — all tests pass (AC-TEST-3)
- Must: Zero occurrences of private project identifiers in test files (AC-CLEAN-1)
- Should: New tests cover version check opt-out and doc-linked errors

**Files and modules**:

- `tools/.tests/test-text-to-image-unit.sh` (new, ~800 lines)
- `tools/.tests/test-text-to-image-integration.sh` (new, ~620 lines)
- `tools/.tests/test-text-to-image-performance.sh` (new, ~430 lines)

**Tests**:

- `bash tools/.tests/test-text-to-image-unit.sh`
- `bash tools/.tests/test-text-to-image-integration.sh`
- `bash tools/.tests/test-text-to-image-performance.sh`

**Completion signal**: `test(tools): add text-to-image test suites — unit, integration, and performance`

---

### Phase 3: User documentation — `doc/tools/text-to-image.md`

**Goal**: Create comprehensive user documentation with per-provider setup guides, stable heading anchors for doc-linked errors, and versioned changelog.

**Tasks**:

- [x] Create `doc/tools/` directory (AC-DOC-1) — created
- [x] Write `doc/tools/text-to-image.md` with all required sections per `doc/guides/tools-convention.md` (AC-DOC-1, AC-DOC-2) — 644 lines, all sections present:
  - Title + version near top linking to changelog: `> Version 1.0.0 | [Changelog](#100-2026-03-07)` (AC-DOC-2)
  - Overview: what the tool does, 7 supported providers, agent-agnostic design
  - Requirements: bash 4+, curl (required); jq, yq, exiftool (optional with fallbacks)
  - Installation: make executable, add to PATH, first-run config directory creation
  - Provider Setup section with one subsection per provider (stable headings for anchors):
    - `### OpenAI` — sign-up URL (platform.openai.com), API key console URL, `OPENAI_API_KEY` env var, models (dall-e-3, dall-e-2), pricing (~$0.040/img), gotchas (content policy, size limits)
    - `### Stability AI` — sign-up URL (platform.stability.ai), API key console URL, `STABILITY_API_KEY` env var, models (stable-diffusion-v1-6, sd3-medium, SDXL), pricing, gotchas
    - `### Google Imagen` — 3 auth methods (service account JSON, gcloud CLI, API key), auto-detection priority, `GOOGLE_CREDENTIALS`/`GOOGLE_API_KEY` env vars, 5 models (imagen-4.0-generate-001 through imagegeneration), pricing, `GOOGLE_PROJECT_ID`, `GOOGLE_LOCATION`, gotchas (Vertex AI enablement, billing)
    - `### Hugging Face` — sign-up URL (huggingface.co), token page URL, `HF_API_KEY` env var, default model, custom models via `HF_MODEL`, pricing (free tier), gotchas (rate limits)
    - `### Black Forest Labs` — sign-up URL, API key console URL, `BFL_API_KEY` env var, models (flux-1.1-pro, flux-1.0-pro), pricing, gotchas
    - `### Replicate` — sign-up URL (replicate.com), token page URL, `REPLICATE_API_TOKEN` env var, default model, custom models via `REPLICATE_MODEL`, pricing, gotchas
    - `### SiliconFlow` — sign-up URL, API key console URL, `SILICONFLOW_API_KEY` env var, models, pricing, gotchas
  - Usage examples: single generation, quality profiles, multi-model comparison, batch processing (YAML), dry-run, metadata embedding, JSON output
  - Configuration: config directory structure, `.env` file, env var overrides
  - Troubleshooting: common errors (missing API key, invalid dimensions, network, rate limit, permissions), debugging with `--verbose`
  - CLI Reference: full options table
  - Changelog section with `### 1.0.0 (2026-03-07)` initial release entry (AC-DOC-2)
- [x] Verify all 7 provider headings produce correct GitHub anchor URLs matching `PROVIDER_DOC_ANCHORS` in the script (AC-F10-1, AC-DOC-1) — verified: openai, stability-ai, google-imagen, hugging-face, black-forest-labs, replicate, siliconflow
- [x] Add ADOS MIT license header (YAML frontmatter for markdown) (G-6) — 3-line YAML frontmatter added

**Acceptance Criteria**:

- Must: All 7 providers have dedicated sections with sign-up URL, API key console URL, env var, gotchas, and approximate pricing (AC-DOC-1)
- Must: Version displayed near top linking to changelog subsection (AC-DOC-2)
- Must: Changelog contains `### 1.0.0` subsection (AC-DOC-2)
- Must: Provider heading anchors match `PROVIDER_DOC_ANCHORS` map in tool script (AC-F10-1)
- Should: Examples are copy-pasteable with ADOS paths (`tools/text-to-image`)

**Files and modules**:

- `doc/tools/text-to-image.md` (new, ~500-600 lines)

**Tests**:

- Manual: Verify each provider heading produces expected GitHub anchor URL
- Manual: Verify doc link in `--help` output matches actual doc path

**Completion signal**: `docs(tools): add text-to-image user guide with per-provider setup`

---

### Phase 4: Agent tuning — `.opencode/agent/image-generator.md`

**Goal**: Tune the `@image-generator` agent prompt for model discovery, task-based routing, and updated CLI reference.

**Tasks**:

- [x] Add model discovery step to `<process>`: before generating, run `tools/text-to-image --list-models --output-format json` to discover available providers and models (AC-AGENT-1) — added as step 1, includes JSON parsing and error handling
- [x] Add task-based model routing guidance to a new `<routing>` section (AC-AGENT-1) — 6-row routing table:
  - Photorealistic/photography: prefer DALL-E 3 or Imagen 4 Ultra
  - Illustration/art: prefer Stable Diffusion or FLUX
  - Quick drafts/mockups: prefer Imagen 4 Fast or Hugging Face (low quality profile)
  - Icons/UI elements: prefer Stable Diffusion with negative prompts
  - Product photography: prefer DALL-E 3 or Imagen 4 Standard
  - Budget/high-volume: prefer SiliconFlow or Hugging Face free tier
- [x] Update `<tool_reference>` section with `--list-models`, `--all-models`, `--google-credentials`, `--google-auth-method` flags, and JSON model listing example (AC-AGENT-1) — done, includes example JSON response format
- [x] Add instruction to parse JSON model listing response and select appropriate model based on task type and available providers (AC-AGENT-1) — in process step 1 and step 2
- [x] Update examples to show model discovery workflow (AC-AGENT-1) — 4 examples: discovery-and-generate, with-constraints, comparison, fallback-on-missing-provider
- [x] Add reference to user documentation: `doc/tools/text-to-image.md` for provider setup troubleshooting — in tool_reference header and process steps 1, 5

**Acceptance Criteria**:

- Must: Agent prompt includes model discovery step using `--list-models --output-format json` (AC-AGENT-1)
- Must: Agent prompt includes task-based routing guidance
- Should: Agent prompt references user documentation for provider troubleshooting

**Files and modules**:

- `.opencode/agent/image-generator.md` (modified)

**Tests**:

- Manual: Read through updated prompt to verify model discovery workflow is clear

**Completion signal**: `feat(agent): tune image-generator for model discovery and task-based routing`

---

### Phase 5: `add-header-location.sh` enhancement and tests

**Goal**: Enhance the license-header script to detect and process bash scripts, and add corresponding tests.

**Tasks**:

- [x] Update `process_path()` in `scripts/add-header-location.sh` to accept bash scripts: detect files with `.sh` extension or files whose first line matches `#!/usr/bin/env bash` or `#!/bin/bash` (AC-HEADER-1, AC-HEADER-2) — added `is_bash_file()` and updated `process_path()`
- [x] Create `process_bash_file()` function that adds the 3-line MIT license header as bash comments (`# Copyright...`, `# MIT License...`, `# Latest version:...`) after the shebang line (AC-HEADER-1, AC-HEADER-2) — inserts after shebang or at top if no shebang
- [x] Handle bash files without extension (like `tools/text-to-image`): detect by shebang line (AC-HEADER-2) — `is_bash_file()` checks first line for `#!/usr/bin/env bash` or `#!/bin/bash`
- [x] Ensure idempotency: skip if header already present — `bash_has_header()` checks all 3 lines
- [x] Update `find_markdown_files()` or add `find_bash_files()` to also discover bash scripts when processing directories — added `find_bash_files()` finding .sh and shebang-detected files
- [x] Update `usage()` help text to mention bash script support — added file types section, bash examples
- [x] Add tests to `scripts/.tests/test-add-header-location.sh` — 6 new tests, all 18/18 pass:
  - [x] Test `.sh` extension file gets bash-style header (AC-HEADER-1) — `test_bash_sh_extension_gets_header`
  - [x] Test shebang-detected file (no `.sh` extension) gets bash-style header after shebang (AC-HEADER-2) — `test_bash_shebang_no_extension_gets_header`
  - [x] Test `#!/bin/bash` shebang detected — `test_bash_bin_bash_shebang_detected`
  - [x] Test bash file with existing header is idempotent — `test_bash_existing_header_idempotent`
  - [x] Test directory processing finds both `.md` and bash files — `test_bash_directory_finds_both_md_and_sh`
  - [x] Test dry-run mode with bash files — `test_bash_dry_run_mode`

**Acceptance Criteria**:

- Must: `.sh` extension files receive MIT license header as bash comments (AC-HEADER-1)
- Must: Shebang-detected files receive header after shebang line (AC-HEADER-2)
- Must: Idempotent — running twice produces same result
- Must: All existing tests still pass
- Should: Directory processing discovers both markdown and bash files

**Files and modules**:

- `scripts/add-header-location.sh` (modified)
- `scripts/.tests/test-add-header-location.sh` (modified)

**Tests**:

- `bash scripts/.tests/test-add-header-location.sh`

**Completion signal**: `feat(scripts): enhance add-header-location.sh for bash script license headers`

---

### Phase 6: AGENTS.md update, license headers, and finalization

**Goal**: Update AGENTS.md references, apply license headers to all new files, perform final cleanup, and verify all acceptance criteria.

**Tasks**:

- [x] Update `AGENTS.md` Key References table: add rows for `doc/tools/text-to-image.md` and `doc/guides/tools-convention.md` (AC-AGENTS-1) — added
- [x] Remove `[planned]` tag from `tools/` entries in AGENTS.md repo structure and conventions table (AC-AGENTS-1) — removed from both locations
- [x] Update License headers section in AGENTS.md to mention bash script support — updated
- [x] Run `scripts/add-header-location.sh` on all new files to ensure MIT license headers — all files already have headers, 0 updates needed
- [x] Run full grep for private project identifiers across repository (AC-CLEAN-1) — only `PDEV-123` in AGENTS.md (example text), zero real matches in tools/doc
- [x] Run all test suites one final time:
  - `bash tools/.tests/test-text-to-image-unit.sh` (AC-TEST-1) — 52/52 PASS
  - `bash tools/.tests/test-text-to-image-integration.sh` (AC-TEST-2) — 21/21 PASS
  - `bash tools/.tests/test-text-to-image-performance.sh` (AC-TEST-3) — 8/8 PASS
  - `bash scripts/.tests/test-add-header-location.sh` (AC-HEADER-1, AC-HEADER-2) — 18/18 PASS
- [x] Verify `tools/text-to-image --help` shows correct doc URL (AC-F1-1) — `Full guide: .../doc/tools/text-to-image.md` ✓
- [x] Verify `tools/text-to-image --version` shows correct latest-version URL (AC-F1-2) — `Latest version: .../tools/text-to-image` ✓
- [x] Reconcile spec: all 17 acceptance criteria verified (see below)

**Acceptance Criteria**:

- Must: `AGENTS.md` Key References includes `doc/tools/text-to-image.md` and `doc/guides/tools-convention.md` (AC-AGENTS-1)
- Must: All new files have MIT license headers
- Must: Zero private project identifier matches in repository (AC-CLEAN-1)
- Must: All test suites pass (AC-TEST-1, AC-TEST-2, AC-TEST-3, AC-HEADER-1, AC-HEADER-2)
- Must: All 17 spec acceptance criteria verified

**Files and modules**:

- `AGENTS.md` (modified)
- All new files (license header verification)

**Tests**:

- `bash tools/.tests/test-text-to-image-unit.sh`
- `bash tools/.tests/test-text-to-image-integration.sh`
- `bash tools/.tests/test-text-to-image-performance.sh`
- `bash scripts/.tests/test-add-header-location.sh`
- `grep -rn "menuvivo\|text-to-img\|PDEV-" tools/ doc/tools/ .opencode/agent/image-generator.md`

**Completion signal**: `docs(agents): update AGENTS.md references and finalize GH-26 deliverables`

## Test Scenarios

| ID | Scenario | Type | Phase | Spec AC |
|----|----------|------|-------|---------|
| TS-1 | `tools/text-to-image --help` exits 0 with convention-compliant output | Manual + Unit | 1, 2 | AC-F1-1 |
| TS-2 | `tools/text-to-image --version` exits 0 with multi-line output | Manual + Unit | 1, 2 | AC-F1-2 |
| TS-3 | `--dry-run --prompt "test" --output test.png` shows API call without executing | Manual + Unit | 1, 2 | AC-F1-3 |
| TS-4 | `--list-models` displays available models for configured providers | Unit + Integration | 1, 2 | AC-F4-1 |
| TS-5 | `--list-models --output-format json` outputs valid JSON array | Unit | 1, 2 | AC-F4-2 |
| TS-6 | Version check runs after 24h cache expiry, warns if outdated | Unit | 2 | AC-F9-1 |
| TS-7 | `TEXT_TO_IMAGE_NO_VERSION_CHECK=true` skips version check | Unit | 2 | AC-F9-2 |
| TS-8 | Version check failure is silently discarded | Unit | 2 | AC-F9-3 |
| TS-9 | Unconfigured provider error includes doc URL with correct anchor | Unit | 2 | AC-F10-1 |
| TS-10 | Google service account auth generates image | Integration | 2 | AC-F11-1 |
| TS-11 | First-run creates `~/.ai/text-to-image/` with 700 permissions | Unit | 2 | AC-DM1-1 |
| TS-12 | API keys sanitized to first 8 chars + `…****` in verbose logs | Unit | 2 | AC-NFR6-1 |
| TS-13 | All unit tests pass | Automated | 2 | AC-TEST-1 |
| TS-14 | All integration tests pass | Automated | 2 | AC-TEST-2 |
| TS-15 | Performance tests pass (startup <200ms, cache <100ms) | Automated | 2 | AC-TEST-3 |
| TS-16 | All 7 provider docs have stable anchors, sign-up URL, env var, pricing | Manual | 3 | AC-DOC-1 |
| TS-17 | Doc has version near top linking to changelog subsection | Manual | 3 | AC-DOC-2 |
| TS-18 | Agent prompt includes `--list-models --output-format json` discovery | Manual | 4 | AC-AGENT-1 |
| TS-19 | `.sh` files get bash-comment license header | Automated | 5 | AC-HEADER-1 |
| TS-20 | Shebang-detected files get header after shebang | Automated | 5 | AC-HEADER-2 |
| TS-21 | AGENTS.md includes new doc references | Manual | 6 | AC-AGENTS-1 |
| TS-22 | Zero private project identifier matches in repo | Automated | 6 | AC-CLEAN-1 |

## Artifacts and Links

| Artifact | Path | Type |
|----------|------|------|
| Change spec | `doc/changes/2026-03/2026-03-06--GH-26--text-to-img-toolbox/chg-GH-26-spec.md` | Spec |
| Implementation plan | `doc/changes/2026-03/2026-03-06--GH-26--text-to-img-toolbox/chg-GH-26-plan.md` | Plan |
| PM notes | `doc/changes/2026-03/2026-03-06--GH-26--text-to-img-toolbox/chg-GH-26-pm-notes.yaml` | Notes |
| Tools convention | `doc/guides/tools-convention.md` | Guide (existing) |
| Bash rules | `.ai/rules/bash.md` | Rules (existing) |
| Blueprint script | `<private>/scripts/text-to-img.sh` | Source (external) |
| Blueprint doc | `<private>/doc/tools/text-to-img.md` | Source (external) |
| Blueprint unit tests | `<private>/scripts/.tests/test-text-to-img-unit.sh` | Source (external) |
| Blueprint integration tests | `<private>/scripts/.tests/test-text-to-img-integration.sh` | Source (external) |
| Blueprint performance tests | `<private>/scripts/.tests/test-text-to-img-performance.sh` | Source (external) |

## Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-07 | @plan-writer | Initial plan |

## Execution Log

| Phase | Date | Status | Summary |
|-------|------|--------|---------|
| 1 | 2026-03-07 | DONE | Core tool ported as `tools/text-to-image` (~2075 lines). Commit: `a9331db` |
| 2 | 2026-03-07 | DONE | 3 test suites ported (52+21+8=81 tests, all pass). Commit: `702ccda` |
| 3 | 2026-03-07 | DONE | User doc `doc/tools/text-to-image.md` (644 lines), 7 provider sections with stable anchors. Commit: `d1bd5b8` |
| 4 | 2026-03-07 | DONE | Agent tuned: model discovery step, routing table, updated tool_reference, 4 examples. Commit: `44589f3` |
| 5 | 2026-03-07 | DONE | Header script enhanced: `is_bash_file()`, `process_bash_file()`, `find_bash_files()`, 6 new tests, 18/18 pass. Commit: `af9caeb` |
| 6 | 2026-03-07 | DONE | AGENTS.md updated, [planned] removed, all tests pass (99/99), zero private refs, all 17 AC verified. Commit: pending |
