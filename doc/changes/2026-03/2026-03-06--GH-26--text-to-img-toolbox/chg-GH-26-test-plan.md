---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/changes/2026-03/2026-03-06--GH-26--text-to-img-toolbox/chg-GH-26-test-plan.md

id: chg-GH-26-test-plan
status: Proposed
created: "2026-03-07T00:00:00Z"
last_updated: "2026-03-07T00:00:00Z"
owners: [Juliusz Ćwiąkalski]
service: tools
labels: [cli, image-generation, agent-tuning, convention, testing]
links:
  change_spec: ./chg-GH-26-spec.md
  implementation_plan: ./chg-GH-26-plan.md
  testing_strategy: .ai/rules/bash.md (sections 10-12)
version_impact: minor
summary: >
  Test plan for the text-to-image CLI tool, covering unit tests (mocked externals),
  integration tests (mocked API flows), performance tests (caching, startup), header script
  bash support, CLI convention compliance, version check, doc-linked errors, documentation
  verification, and agent prompt verification. 71 test scenarios across 9 categories
  traced to 17 acceptance criteria.
---

# Test Plan - Publish text-to-image CLI tool, agent tuning, and tools convention

## 1. Scope and Objectives

This test plan defines the verification strategy for GH-26, which delivers:

1. **`tools/text-to-image`** — A ~2100-line bash CLI tool ported from a private project, adapted for ADOS conventions
2. **Three test suites** — Unit (~42 tests), integration (~21 tests), and performance (~8 tests)
3. **User documentation** (`doc/tools/text-to-image.md`) — Per-provider setup guides with stable anchors
4. **Agent tuning** (`.opencode/agent/image-generator.md`) — Model discovery and task-based routing
5. **`scripts/add-header-location.sh` enhancement** — Bash script license header support
6. **`AGENTS.md` updates** — New documentation references

### Objectives

- Verify all 12 functional capabilities (F-1 through F-12) work as specified
- Verify all 10 non-functional requirements (NFR-1 through NFR-10) meet thresholds
- Ensure zero private project references exist in committed files
- Validate tools convention compliance (`--help`, `--version`, version check, doc-linked errors)
- Confirm documentation completeness for all 7 providers
- Verify agent prompt enables model discovery workflow

### Testing approach

All bash testing follows `.ai/rules/bash.md` sections 10-12:
- Embedded test framework (no external dependencies)
- Mockable wrappers for external commands (`_curl()`, `_jq()`, `_exiftool()`)
- Testable main guard for sourcing scripts under test
- Dependency injection via environment variables
- Temp directories for isolation; cleanup in EXIT trap

## 2. References

| Document | Path |
|----------|------|
| Change Specification | `doc/changes/2026-03/2026-03-06--GH-26--text-to-img-toolbox/chg-GH-26-spec.md` |
| Implementation Plan | `doc/changes/2026-03/2026-03-06--GH-26--text-to-img-toolbox/chg-GH-26-plan.md` |
| Bash Coding Rules | `.ai/rules/bash.md` |
| Tools Convention | `doc/guides/tools-convention.md` |
| Blueprint Unit Tests | `<private>/scripts/.tests/test-text-to-img-unit.sh` (~759 lines, 42 tests) |
| Blueprint Integration Tests | `<private>/scripts/.tests/test-text-to-img-integration.sh` (~591 lines, 21 tests) |
| Blueprint Performance Tests | `<private>/scripts/.tests/test-text-to-img-performance.sh` (~408 lines, 8 tests) |
| Blueprint Test Spec | `<private>/doc/quality/test-specs/test-spec-text-to-img-utility.md` |

## 3. Coverage Overview

### 3.1 Functional Coverage (F-#, AC-#)

| Spec ID | Description | Covered By | Status |
|---------|-------------|------------|--------|
| F-1 | Single image generation | TC-TTI-001, TC-TTI-002, TC-TTI-003 | Covered |
| F-2 | Multi-model comparison | TC-TTI-040, TC-TTI-041 | Covered |
| F-3 | Quality-based provider selection | TC-TTI-010, TC-TTI-011, TC-TTI-012 | Covered |
| F-4 | Model discovery | TC-TTI-020, TC-TTI-021, TC-TTI-022, TC-TTI-023 | Covered |
| F-5 | Response caching | TC-TTI-030, TC-TTI-031, TC-TTI-032, TC-TTI-033 | Covered |
| F-6 | Batch processing | TC-TTI-050, TC-TTI-051, TC-TTI-052 | Covered |
| F-7 | Metadata embedding | TC-TTI-055, TC-TTI-056 | Covered |
| F-8 | Dry-run simulation | TC-TTI-004, TC-TTI-005, TC-TTI-006 | Covered |
| F-9 | Automatic version check | TC-TTI-060, TC-TTI-061, TC-TTI-062 | Covered |
| F-10 | Documentation-linked error messages | TC-TTI-063, TC-TTI-064 | Covered |
| F-11 | Google Imagen multi-auth | TC-TTI-070, TC-TTI-071, TC-TTI-072, TC-TTI-073, TC-TTI-074, TC-TTI-075 | Covered |
| F-12 | Machine-readable output | TC-TTI-022, TC-TTI-080 | Covered |
| AC-F1-1 | `--help` output per convention | TC-TTI-001 | Covered |
| AC-F1-2 | `--version` output per convention | TC-TTI-002 | Covered |
| AC-F1-3 | `--dry-run` simulation | TC-TTI-004 | Covered |
| AC-F4-1 | `--list-models` for configured providers | TC-TTI-020 | Covered |
| AC-F4-2 | `--list-models --output-format json` valid JSON | TC-TTI-022 | Covered |
| AC-F9-1 | Version check after 24h cache expiry | TC-TTI-060 | Covered |
| AC-F9-2 | Version check opt-out via env var | TC-TTI-061 | Covered |
| AC-F9-3 | Version check silent failure | TC-TTI-062 | Covered |
| AC-F10-1 | Doc URL in unconfigured provider error | TC-TTI-063 | Covered |
| AC-F11-1 | Google service account auth | TC-TTI-072 | Covered |
| AC-DM1-1 | Config dir created with 700 permissions | TC-TTI-007 | Covered |
| AC-NFR6-1 | API key sanitization in logs | TC-TTI-008 | Covered |
| AC-TEST-1 | All unit tests pass | TC-TTI-090 | Covered |
| AC-TEST-2 | All integration tests pass | TC-TTI-091 | Covered |
| AC-TEST-3 | All performance tests pass | TC-TTI-092 | Covered |
| AC-DOC-1 | 7 provider docs with stable anchors | TC-TTI-100, TC-TTI-101 | Covered |
| AC-DOC-2 | Version + changelog in documentation | TC-TTI-102 | Covered |
| AC-AGENT-1 | Agent model discovery workflow | TC-TTI-110 | Covered |
| AC-HEADER-1 | `.sh` files get bash-comment header | TC-HDR-001 | Covered |
| AC-HEADER-2 | Shebang-detected files get header after shebang | TC-HDR-002 | Covered |
| AC-AGENTS-1 | AGENTS.md includes new doc references | TC-TTI-120 | Covered |
| AC-CLEAN-1 | Zero private project references | TC-TTI-130 | Covered |

### 3.2 Interface Coverage (API-#, EVT-#, DM-#)

| Spec ID | Description | Covered By | Status |
|---------|-------------|------------|--------|
| DM-1 | Config directory structure | TC-TTI-007 | Covered |
| DM-2 | Cache metadata format | TC-TTI-031 | Covered |
| DM-3 | JSON output format (single image) | TC-TTI-080 | Covered |
| DM-4 | JSON output format (model listing) | TC-TTI-022 | Covered |
| EXT-1 | OpenAI DALL-E integration | TC-TTI-003, TC-TTI-045 | Covered |
| EXT-2 | Stability AI integration | TC-TTI-046 | Covered |
| EXT-3 | Google Imagen integration | TC-TTI-070 through TC-TTI-075 | Covered |
| EXT-4 | Hugging Face integration | TC-TTI-047 | Covered |
| EXT-5 | Black Forest Labs integration | TC-TTI-048 | Covered |
| EXT-6 | Replicate integration | TC-TTI-049 | Covered |
| EXT-7 | SiliconFlow integration | TC-TTI-044 | Covered |

### 3.3 Non-Functional Coverage (NFR-#)

| Spec ID | Description | Threshold | Covered By | Status |
|---------|-------------|-----------|------------|--------|
| NFR-1 | Startup / `--help` time | p99 < 200ms | TC-TTI-092, TC-PERF-001 | Covered |
| NFR-2 | Cache hit retrieval | p99 < 100ms | TC-PERF-002 | Covered |
| NFR-3 | API timeout | 60s (Google: 120s) | TC-PERF-005 | Covered |
| NFR-4 | Retry with exponential backoff | 3 retries max | TC-TTI-035, TC-PERF-004 | Covered |
| NFR-5 | Config dir permissions 700 | Enforced | TC-TTI-007 | Covered |
| NFR-6 | API key sanitization | First 8 chars + mask | TC-TTI-008 | Covered |
| NFR-7 | Bash 4.0+ portability | Linux and macOS | TC-TTI-009 | Covered |
| NFR-8 | Minimal dependencies | bash+curl required | TC-TTI-036 | Covered |
| NFR-9 | Version check non-blocking | Silent discard | TC-TTI-062 | Covered |
| NFR-10 | Cache size cleanup | >100MB trigger | TC-PERF-006 | Covered |

## 4. Test Types and Layers

| Test Type | Location | Run Command | Scope | Dependencies |
|-----------|----------|-------------|-------|-------------|
| Unit | `tools/.tests/test-text-to-image-unit.sh` | `bash tools/.tests/test-text-to-image-unit.sh` | Pure functions, mocked externals, validation, config parsing | bash 4+, sourced tool script |
| Integration | `tools/.tests/test-text-to-image-integration.sh` | `bash tools/.tests/test-text-to-image-integration.sh` | End-to-end flows with mocked curl, provider interactions, batch processing | bash 4+, sourced tool script |
| Performance | `tools/.tests/test-text-to-image-performance.sh` | `bash tools/.tests/test-text-to-image-performance.sh` | Timing measurements, cache performance, parallel batch, rate limiting | bash 4+, sourced tool script, `bc` |
| Header Unit | `scripts/.tests/test-add-header-location.sh` | `bash scripts/.tests/test-add-header-location.sh` | Bash file detection, header insertion, idempotency | bash 4+, sourced header script |
| Manual - Doc | N/A | Manual inspection | Documentation anchors, content completeness, version display | Browser / GitHub |
| Manual - Agent | N/A | Manual inspection | Agent prompt correctness, model discovery workflow | Agent invocation |
| Manual - Clean | N/A | `grep -rn` | Zero private project references in repo | grep |

## 5. Test Scenarios

### 5.1 Scenario Index

| TC-ID | Title | Type | Impact | Priority | AC Reference |
|-------|-------|------|--------|----------|-------------|
| TC-TTI-001 | --help output convention compliance | Happy Path | Critical | High | AC-F1-1 |
| TC-TTI-002 | --version output convention compliance | Happy Path | Critical | High | AC-F1-2 |
| TC-TTI-003 | Single image generation with mocked provider | Happy Path | Critical | High | AC-F1-1, F-1 |
| TC-TTI-004 | Dry-run simulation shows API call without executing | Happy Path | Critical | High | AC-F1-3 |
| TC-TTI-005 | Dry-run with OpenAI shows sanitized key | Happy Path | Important | Medium | AC-F1-3, AC-NFR6-1 |
| TC-TTI-006 | Dry-run batch processing | Happy Path | Important | Medium | AC-F1-3, F-6 |
| TC-TTI-007 | Config directory created with 700 permissions | Happy Path | Critical | High | AC-DM1-1, NFR-5 |
| TC-TTI-008 | API key sanitization in verbose logs | Happy Path | Critical | High | AC-NFR6-1 |
| TC-TTI-009 | Strict mode and bash 4.0+ compatibility | Happy Path | Important | Medium | NFR-7 |
| TC-TTI-010 | Quality-based provider selection — high profile | Happy Path | Critical | High | F-3 |
| TC-TTI-011 | Provider fallback when primary unavailable | Edge Case | Critical | High | F-3 |
| TC-TTI-012 | No providers configured returns auth error | Negative | Important | Medium | F-3 |
| TC-TTI-020 | --list-models shows configured provider models | Happy Path | Critical | High | AC-F4-1 |
| TC-TTI-021 | --all-models shows all known models | Happy Path | Important | Medium | F-4 |
| TC-TTI-022 | --list-models --output-format json produces valid JSON | Happy Path | Critical | High | AC-F4-2, DM-4 |
| TC-TTI-023 | Model listing includes all Imagen 4 variants | Happy Path | Important | Medium | F-4 |
| TC-TTI-030 | Cache key deterministic for same inputs | Happy Path | Critical | High | F-5 |
| TC-TTI-031 | Cache store and lookup returns cached image | Happy Path | Critical | High | F-5, DM-2 |
| TC-TTI-032 | Cache key differs for different models | Edge Case | Important | Medium | F-5 |
| TC-TTI-033 | Cache miss triggers API call | Happy Path | Important | Medium | F-5 |
| TC-TTI-034 | Force regeneration bypasses cache | Happy Path | Important | Medium | F-5 |
| TC-TTI-035 | Retry curl with exponential backoff | Happy Path | Important | Medium | NFR-4 |
| TC-TTI-036 | Graceful fallback without optional dependencies | Edge Case | Important | Medium | NFR-8 |
| TC-TTI-040 | Multi-model comparison generates model-suffixed files | Happy Path | Important | Medium | F-2 |
| TC-TTI-041 | Multi-model with cache uses separate cache keys | Edge Case | Minor | Low | F-2, F-5 |
| TC-TTI-044 | SiliconFlow provider generation (mocked) | Happy Path | Important | Medium | EXT-7 |
| TC-TTI-045 | OpenAI provider end-to-end (mocked) | Happy Path | Critical | High | EXT-1 |
| TC-TTI-046 | Stability AI provider end-to-end (mocked) | Happy Path | Important | Medium | EXT-2 |
| TC-TTI-047 | Hugging Face provider end-to-end (mocked) | Happy Path | Important | Medium | EXT-4 |
| TC-TTI-048 | Black Forest Labs provider end-to-end (mocked) | Happy Path | Important | Medium | EXT-5 |
| TC-TTI-049 | Replicate provider end-to-end (mocked) | Happy Path | Important | Medium | EXT-6 |
| TC-TTI-050 | Batch sequential processing | Happy Path | Important | Medium | F-6 |
| TC-TTI-051 | Batch parallel processing faster than sequential | Happy Path | Important | Medium | F-6 |
| TC-TTI-052 | Large batch (10 jobs) completes successfully | Happy Path | Important | Medium | F-6 |
| TC-TTI-055 | Metadata embedding with exiftool | Happy Path | Minor | Low | F-7 |
| TC-TTI-056 | Metadata sidecar fallback without exiftool | Edge Case | Important | Medium | F-7 |
| TC-TTI-060 | Version check runs after 24h cache expiry | Happy Path | Important | Medium | AC-F9-1 |
| TC-TTI-061 | Version check opt-out via env var | Happy Path | Critical | High | AC-F9-2 |
| TC-TTI-062 | Version check silent failure on network error | Negative | Critical | High | AC-F9-3 |
| TC-TTI-063 | Doc URL in unconfigured provider error | Happy Path | Critical | High | AC-F10-1 |
| TC-TTI-064 | Doc URL anchors match provider headings | Happy Path | Important | Medium | AC-F10-1 |
| TC-TTI-070 | Google Imagen end-to-end with API key auth | Happy Path | Critical | High | F-11, EXT-3 |
| TC-TTI-071 | Google Imagen API URL construction | Happy Path | Important | Medium | F-11 |
| TC-TTI-072 | Google service account JSON auth with mocked token | Happy Path | Critical | High | AC-F11-1 |
| TC-TTI-073 | Google auth token caching | Happy Path | Important | Medium | F-11 |
| TC-TTI-074 | Google auth auto-detection priority | Edge Case | Important | Medium | F-11 |
| TC-TTI-075 | Google auth missing credentials error | Negative | Important | Medium | F-11 |
| TC-TTI-076 | Google Imagen payload aspect ratio mapping | Happy Path | Important | Medium | F-11 |
| TC-TTI-077 | Google model validation rejects invalid models | Negative | Important | Medium | F-11 |
| TC-TTI-080 | JSON output format for generation result | Happy Path | Important | Medium | F-12, DM-3 |
| TC-TTI-081 | JSON output format for errors | Edge Case | Minor | Low | F-12 |
| TC-TTI-085 | Invalid parameter handling — empty prompt | Negative | Important | Medium | F-1 |
| TC-TTI-086 | Invalid parameter handling — invalid quality | Negative | Important | Medium | F-1 |
| TC-TTI-087 | Invalid parameter handling — invalid dimensions | Negative | Important | Medium | F-1 |
| TC-TTI-088 | Invalid provider name rejected | Negative | Important | Medium | F-1 |
| TC-TTI-089 | Invalid model name for provider rejected | Negative | Important | Medium | F-1 |
| TC-TTI-090 | All unit tests pass | Regression | Critical | High | AC-TEST-1 |
| TC-TTI-091 | All integration tests pass | Regression | Critical | High | AC-TEST-2 |
| TC-TTI-092 | All performance tests pass | Regression | Critical | High | AC-TEST-3 |
| TC-TTI-100 | All 7 providers documented with required fields | Happy Path | Critical | High | AC-DOC-1 |
| TC-TTI-101 | Provider heading anchors produce deterministic URLs | Happy Path | Critical | High | AC-DOC-1, AC-F10-1 |
| TC-TTI-102 | Version near top links to changelog subsection | Happy Path | Important | Medium | AC-DOC-2 |
| TC-TTI-110 | Agent prompt includes model discovery workflow | Happy Path | Critical | High | AC-AGENT-1 |
| TC-TTI-120 | AGENTS.md includes new documentation references | Happy Path | Important | Medium | AC-AGENTS-1 |
| TC-TTI-130 | Zero private project references in repository | Happy Path | Critical | High | AC-CLEAN-1 |
| TC-HDR-001 | .sh extension file gets bash-comment license header | Happy Path | Critical | High | AC-HEADER-1 |
| TC-HDR-002 | Shebang-detected file gets header after shebang | Happy Path | Critical | High | AC-HEADER-2 |
| TC-HDR-003 | Bash file with existing header is idempotent | Edge Case | Important | Medium | AC-HEADER-1 |
| TC-HDR-004 | Directory processing finds both .md and .sh files | Happy Path | Important | Medium | AC-HEADER-1 |
| TC-PERF-001 | Startup / --help time under 200ms | Happy Path | Important | Medium | NFR-1 |
| TC-PERF-002 | Cache hit retrieval under 100ms | Happy Path | Critical | High | NFR-2 |
| TC-PERF-003 | Parallel batch speedup over sequential | Happy Path | Important | Medium | F-6 |
| TC-PERF-004 | Rate limiting backoff handling | Negative | Important | Medium | NFR-4 |
| TC-PERF-005 | Timeout enforcement on hung provider | Negative | Important | Medium | NFR-3 |
| TC-PERF-006 | Google auth token caching performance | Happy Path | Minor | Low | NFR-10, F-11 |

### 5.2 Scenario Details

#### TC-TTI-001 - --help output convention compliance

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, F-8
**Test Type(s)**: Unit, Manual
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @cli, @convention

**Preconditions**:
- `tools/text-to-image` is executable and sourceable

**Steps**:
1. Run `tools/text-to-image --help` and capture stdout and exit code
2. Verify exit code is 0
3. Verify output contains tool name `text-to-image`
4. Verify output contains version string (semver pattern)
5. Verify output contains `USAGE:` section
6. Verify output contains `EXAMPLES:` section with 3-5 examples
7. Verify output contains `OPTIONS:` section
8. Verify output contains documentation link: `https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/tools/text-to-image.md`
9. Verify output contains license information (`MIT License`)
10. Verify output contains copyright line

**Expected Outcome**:
- Exit code 0
- Output matches `doc/guides/tools-convention.md` `--help` template format
- All required sections present

---

#### TC-TTI-002 - --version output convention compliance

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-2, F-1
**Test Type(s)**: Unit, Manual
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @cli, @convention

**Preconditions**:
- `tools/text-to-image` is executable and sourceable

**Steps**:
1. Run `tools/text-to-image --version` and capture stdout and exit code
2. Verify exit code is 0
3. Verify first line matches pattern `text-to-image <semver>`
4. Verify output contains copyright line
5. Verify output contains `MIT License - see LICENSE file for full terms`
6. Verify output contains `Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/text-to-image`

**Expected Outcome**:
- Exit code 0
- Multi-line output matching tools convention `--version` format

---

#### TC-TTI-003 - Single image generation with mocked provider

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-1, F-1, EXT-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-integration.sh`
**Tags**: @api, @backend

**Preconditions**:
- `_curl()` mocked to return valid OpenAI JSON response with image URL
- `OPENAI_API_KEY` set to mock value
- Temporary output directory available

**Steps**:
1. Set `OPENAI_API_KEY="sk-mock123"` and `EMBED_METADATA=false`
2. Mock `_curl()` to return `{"data":[{"url":"http://mock.url/image.png"}]}` for generation and write mock data for download
3. Call `generate_image "test prompt" "" 1024 1024 high "$output" "" ""`
4. Verify exit code is 0
5. Verify output image file exists

**Expected Outcome**:
- Image file created at specified output path
- Exit code 0

---

#### TC-TTI-004 - Dry-run simulation shows API call without executing

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F1-3, F-1, F-8
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @cli, @backend

**Preconditions**:
- `DRY_RUN=true` set
- `OPENAI_API_KEY` set to mock value

**Steps**:
1. Set `DRY_RUN=true` and `OPENAI_API_KEY="sk-test12345678"`
2. Call `generate_image_openai "test" "" 1024 1024 high "/tmp/test.png" "dall-e-3"` and capture output
3. Verify output contains `[DRY-RUN]`
4. Verify API key appears sanitized (e.g., `sk-test12…****`)
5. Verify no actual file is created at the output path

**Expected Outcome**:
- Output shows what API call would be made
- No actual API call or file creation occurs

---

#### TC-TTI-005 - Dry-run with OpenAI shows sanitized key

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F1-3, AC-NFR6-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @security, @backend

**Preconditions**:
- `DRY_RUN=true` set
- `OPENAI_API_KEY` set to mock value with known prefix

**Steps**:
1. Set `DRY_RUN=true` and `OPENAI_API_KEY="sk-te123456789"`
2. Call OpenAI generation function in dry-run mode
3. Verify output contains sanitized form `sk-te123…****`
4. Verify full API key does NOT appear in output

**Expected Outcome**:
- Key sanitized to first 8 characters followed by `…****`

---

#### TC-TTI-006 - Dry-run batch processing

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F1-3, F-6
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @cli, @backend

**Preconditions**:
- `DRY_RUN=true` set
- Batch job JSON defined

**Steps**:
1. Set `DRY_RUN=true` with mock API key
2. Define batch jobs JSON array with one job
3. Call `process_batch_sequential` with the jobs
4. Verify output contains `[DRY-RUN]`

**Expected Outcome**:
- Batch processes each job in dry-run mode without API calls

---

#### TC-TTI-007 - Config directory created with 700 permissions

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-DM1-1, NFR-5, DM-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @security, @backend

**Preconditions**:
- `TEXT_TO_IMAGE_CONFIG_DIR` overridden to temp directory
- Temp directory does not pre-exist

**Steps**:
1. Set `TEXT_TO_IMAGE_CONFIG_DIR` to a new temp path
2. Call `ensure_directories`
3. Verify config directory exists
4. Verify `cache/` subdirectory exists
5. Verify `logs/` and `logs/jobs/` subdirectories exist
6. Check permissions of config directory via `stat -c '%a'`

**Expected Outcome**:
- All directories created
- Config directory has permissions `700`

---

#### TC-TTI-008 - API key sanitization in verbose logs

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-NFR6-1, NFR-6
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @security, @backend

**Preconditions**:
- `sanitize_token()` function available

**Steps**:
1. Call `sanitize_token "sk-1234567890abcdef"` and capture result
2. Verify result is `sk-12345…****`
3. Call `sanitize_token ""` and verify result is `unset`
4. Call `sanitize_token "short"` and verify appropriate masking

**Expected Outcome**:
- Long tokens: first 8 chars + `…****`
- Empty tokens: `unset`
- Full token never appears in output

---

#### TC-TTI-009 - Strict mode and bash 4.0+ compatibility

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-7
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: N/A
**Tags**: @backend

**Preconditions**:
- Script file available for inspection

**Steps**:
1. Verify script starts with `#!/usr/bin/env bash`
2. Verify `set -Eeuo pipefail` is present
3. Verify `set -o errtrace` is present
4. Verify `shopt -s inherit_errexit` is present
5. Verify `IFS=$'\n\t'` is set
6. Verify ERR, EXIT, INT TERM traps are configured

**Expected Outcome**:
- All strict mode settings present per `.ai/rules/bash.md`

---

#### TC-TTI-010 - Quality-based provider selection — high profile

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- `OPENAI_API_KEY` set

**Steps**:
1. Set `OPENAI_API_KEY="test"`
2. Call `select_provider "high"` and capture result
3. Verify result is `openai` (first in high-quality chain)

**Expected Outcome**:
- OpenAI selected as first available provider in high quality chain

---

#### TC-TTI-011 - Provider fallback when primary unavailable

**Scenario Type**: Edge Case
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- `OPENAI_API_KEY` unset
- `STABILITY_API_KEY` set

**Steps**:
1. Unset `OPENAI_API_KEY`
2. Set `STABILITY_API_KEY="test"`
3. Call `select_provider "high"` and capture result
4. Verify result is `stability` (second in high-quality chain)

**Expected Outcome**:
- Falls back to Stability AI when OpenAI unavailable

---

#### TC-TTI-012 - No providers configured returns auth error

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- All provider API key env vars unset
- gcloud not in PATH

**Steps**:
1. Unset all 7 provider API key env vars and `GOOGLE_CREDENTIALS`
2. Override PATH to empty directory to hide gcloud
3. Call `select_provider "high"` and capture exit code
4. Verify exit code is `EXIT_AUTH_FAILED` (3)

**Expected Outcome**:
- Exit code 3 (authentication failed)

---

#### TC-TTI-020 - --list-models shows configured provider models

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-1, F-4
**Test Type(s)**: Unit, Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @cli, @backend

**Preconditions**:
- At least one provider API key set

**Steps**:
1. Set `OPENAI_API_KEY="sk-mock123"`
2. Call `list_models false` (configured only) and capture output
3. Verify output contains table headers (Provider, Model ID, Quality)
4. Verify output contains `openai` and `dall-e-3`

**Expected Outcome**:
- Table of configured provider models displayed

---

#### TC-TTI-021 - --all-models shows all known models

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @cli, @backend

**Preconditions**:
- Script sourced

**Steps**:
1. Call `list_models true` (all models) and capture output
2. Verify output contains models from all 7 providers
3. Verify count of models is greater than or equal to configured-only count

**Expected Outcome**:
- All known models listed regardless of API key configuration

---

#### TC-TTI-022 - --list-models --output-format json produces valid JSON

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F4-2, F-4, F-12, DM-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @cli, @backend, @api

**Preconditions**:
- Script sourced
- `jq` available for validation

**Steps**:
1. Call model listing with JSON output format
2. Pipe output through `jq .` to validate JSON syntax
3. Verify output is a JSON array
4. Verify each object contains: provider, model, name, description, quality, cost, limitations

**Expected Outcome**:
- Valid JSON array with required fields per DM-4

---

#### TC-TTI-023 - Model listing includes all Imagen 4 variants

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-4, F-11
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- Script sourced

**Steps**:
1. Call `list_models true` and capture output
2. Verify output contains `imagen-4.0-generate-001`
3. Verify output contains `imagen-4.0-ultra-generate-001`
4. Verify output contains `imagen-4.0-fast-generate-001`
5. Verify output contains `imagen-3.0-generate-001`

**Expected Outcome**:
- All 4+ Google Imagen model variants listed

---

#### TC-TTI-030 - Cache key deterministic for same inputs

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- `compute_cache_key()` function available

**Steps**:
1. Call `compute_cache_key "prompt" "neg" 1024 1024 high openai "dall-e-3"` twice
2. Verify both results are identical
3. Call with different prompt and verify result differs

**Expected Outcome**:
- Same inputs produce same SHA-256 cache key
- Different inputs produce different keys

---

#### TC-TTI-031 - Cache store and lookup returns cached image

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-5, DM-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- Temp cache directory via `ensure_directories`
- Dummy image file created

**Steps**:
1. Create dummy image file
2. Call `cache_store` with known cache key and generation parameters
3. Call `cache_lookup` with same cache key and new output path
4. Verify exit code is 0 (cache hit)
5. Verify output file content matches original

**Expected Outcome**:
- Cached image stored and retrieved correctly
- Metadata JSON sidecar created

---

#### TC-TTI-032 - Cache key differs for different models

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-5
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- `compute_cache_key()` function available

**Steps**:
1. Compute cache key for `dall-e-3` with given prompt/params
2. Compute cache key for `dall-e-2` with same prompt/params
3. Verify keys are different

**Expected Outcome**:
- Model name is part of cache key computation

---

#### TC-TTI-033 - Cache miss triggers API call

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-5
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- Cache is empty
- `ensure_directories` called

**Steps**:
1. Call `cache_lookup` with non-existent key
2. Verify exit code is 1 (cache miss)

**Expected Outcome**:
- Non-existent cache key returns failure

---

#### TC-TTI-034 - Force regeneration bypasses cache

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-integration.sh`
**Tags**: @backend

**Preconditions**:
- Mocked curl returning valid response
- `FORCE=true`

**Steps**:
1. Set `FORCE=true` and mock `_curl()`
2. Generate image with mock provider
3. Verify image created even if cache entry exists

**Expected Outcome**:
- API call made regardless of cache state

---

#### TC-TTI-035 - Retry curl with exponential backoff

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-4
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- `_curl()` mocked to fail once then succeed

**Steps**:
1. Mock `_curl()` to return HTTP 500 on first call, then HTTP 200 on second
2. Call `retry_curl` and capture output
3. Verify final output is success response
4. Verify two calls were made (via counter file)

**Expected Outcome**:
- Retries on 500 error and succeeds on second attempt

---

#### TC-TTI-036 - Graceful fallback without optional dependencies

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-8
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- `yq` not available in PATH
- YAML config file provided

**Steps**:
1. Ensure `yq` is not available (or mock unavailability)
2. Provide a simple YAML config file
3. Call `parse_yaml` and capture output
4. Verify fallback parser produces key-value pairs

**Expected Outcome**:
- YAML parsed with simple fallback when `yq` unavailable

---

#### TC-TTI-040 - Multi-model comparison generates model-suffixed files

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-integration.sh`
**Tags**: @cli, @backend

**Preconditions**:
- Multiple model names provided (comma-separated)
- Mocked curl

**Steps**:
1. Define models `dall-e-3,stable-diffusion-xl-1024-v1-0`
2. For each model, derive output filename: `base-<model>.ext`
3. Verify output files would be `test-dall-e-3.png` and `test-stable-diffusion-xl-1024-v1-0.png`

**Expected Outcome**:
- Each model generates a separate file with model name in filename

---

#### TC-TTI-041 - Multi-model with cache uses separate cache keys

**Scenario Type**: Edge Case
**Impact Level**: Minor
**Priority**: Low
**Related IDs**: F-2, F-5
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- `compute_cache_key()` available

**Steps**:
1. Compute cache keys for same prompt but different models
2. Verify keys are different

**Expected Outcome**:
- Multi-model comparison uses distinct cache keys per model

---

#### TC-TTI-044 - SiliconFlow provider generation (mocked)

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: EXT-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-integration.sh`
**Tags**: @api, @backend

**Preconditions**:
- `SILICONFLOW_API_KEY` set to mock value
- `_curl()` mocked to return SiliconFlow response format

**Steps**:
1. Set `SILICONFLOW_API_KEY` and mock curl
2. Call generation with `--provider siliconflow`
3. Verify image file created and exit code 0

**Expected Outcome**:
- SiliconFlow provider callable via mocked API

---

#### TC-TTI-045 - OpenAI provider end-to-end (mocked)

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: EXT-1, F-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-integration.sh`
**Tags**: @api, @backend

**Preconditions**:
- `OPENAI_API_KEY` set, `_curl()` mocked

**Steps**:
1. Mock curl for OpenAI API response format
2. Call `generate_image` with provider `openai`
3. Verify exit code 0 and image file created

**Expected Outcome**:
- Full OpenAI generation flow works with mocked API

---

#### TC-TTI-046 - Stability AI provider end-to-end (mocked)

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: EXT-2
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-integration.sh`
**Tags**: @api, @backend

**Preconditions**:
- `STABILITY_API_KEY` set, `_curl()` mocked

**Steps**:
1. Mock curl for Stability AI response format
2. Call generation with provider `stability`
3. Verify exit code 0 and image file created

**Expected Outcome**:
- Stability AI provider flow works with mocked API

---

#### TC-TTI-047 - Hugging Face provider end-to-end (mocked)

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: EXT-4
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-integration.sh`
**Tags**: @api, @backend

**Preconditions**:
- `HF_API_KEY` set, `_curl()` mocked

**Steps**:
1. Mock curl for Hugging Face Inference API response
2. Call generation with provider `huggingface`
3. Verify exit code 0 and image file created

**Expected Outcome**:
- Hugging Face provider flow works with mocked API

---

#### TC-TTI-048 - Black Forest Labs provider end-to-end (mocked)

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: EXT-5
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-integration.sh`
**Tags**: @api, @backend

**Preconditions**:
- `BFL_API_KEY` set, `_curl()` mocked

**Steps**:
1. Mock curl for BFL FLUX API response
2. Call generation with provider `bfl`
3. Verify exit code 0 and image file created

**Expected Outcome**:
- Black Forest Labs provider flow works with mocked API

---

#### TC-TTI-049 - Replicate provider end-to-end (mocked)

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: EXT-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-integration.sh`
**Tags**: @api, @backend

**Preconditions**:
- `REPLICATE_API_TOKEN` set, `_curl()` mocked

**Steps**:
1. Mock curl for Replicate predictions API response
2. Call generation with provider `replicate`
3. Verify exit code 0 and image file created

**Expected Outcome**:
- Replicate provider flow works with mocked API

---

#### TC-TTI-050 - Batch sequential processing

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-6
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-integration.sh`
**Tags**: @backend

**Preconditions**:
- Mocked curl, batch jobs JSON with 2 jobs

**Steps**:
1. Define batch JSON with 2 jobs (different prompts and output paths)
2. Call `process_batch_sequential`
3. Verify exit code 0
4. Verify both output files exist

**Expected Outcome**:
- All batch jobs complete sequentially, all files created

---

#### TC-TTI-051 - Batch parallel processing faster than sequential

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-6
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-performance.sh`
**Tags**: @backend, @perf

**Preconditions**:
- Mocked curl with 100ms simulated delay per call
- 2 batch jobs

**Steps**:
1. Time `process_batch_sequential` with 2 jobs
2. Time `process_batch_parallel` with same 2 jobs
3. Compare times

**Expected Outcome**:
- Parallel execution is measurably faster than sequential

---

#### TC-TTI-052 - Large batch (10 jobs) completes successfully

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-6
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-performance.sh`
**Tags**: @backend, @perf

**Preconditions**:
- Mocked curl, 10 batch jobs

**Steps**:
1. Create 10-job batch JSON
2. Call `process_batch_parallel`
3. Verify exit code 0
4. Verify all 10 output files exist

**Expected Outcome**:
- Large batch completes without errors, all files created

---

#### TC-TTI-055 - Metadata embedding with exiftool

**Scenario Type**: Happy Path
**Impact Level**: Minor
**Priority**: Low
**Related IDs**: F-7
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-integration.sh`
**Tags**: @backend

**Preconditions**:
- `exiftool` available (skip if not)
- Dummy image file created

**Steps**:
1. Create dummy image file
2. Call `embed_metadata` with artist, copyright, keywords
3. Read EXIF metadata via `exiftool`
4. Verify artist field matches

**Expected Outcome**:
- EXIF/XMP metadata embedded in image file

---

#### TC-TTI-056 - Metadata sidecar fallback without exiftool

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-7
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- `exiftool` not available (or mocked as unavailable)
- Dummy image file created

**Steps**:
1. Create dummy image file
2. Call `embed_metadata` with metadata parameters
3. Verify `.metadata` sidecar JSON file created alongside image

**Expected Outcome**:
- JSON sidecar file created as fallback

---

#### TC-TTI-060 - Version check runs after 24h cache expiry

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F9-1, F-9
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- Version check timestamp file set to >24h ago (or absent)
- `_curl()` mocked to return script with newer `APP_VERSION`

**Steps**:
1. Set version-check timestamp to 25 hours ago
2. Mock `_curl()` to return a script containing `APP_VERSION="99.0.0"`
3. Run version check function
4. Verify warning message appears on stderr mentioning newer version

**Expected Outcome**:
- Warning printed to stderr: `[WARN] (text-to-image) A newer version is available`

---

#### TC-TTI-061 - Version check opt-out via env var

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-2, F-9
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- `TEXT_TO_IMAGE_NO_VERSION_CHECK=true` set

**Steps**:
1. Set `TEXT_TO_IMAGE_NO_VERSION_CHECK=true`
2. Run version check function
3. Verify no network call is attempted (mock curl should not be called)

**Expected Outcome**:
- Version check skipped entirely

---

#### TC-TTI-062 - Version check silent failure on network error

**Scenario Type**: Negative
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F9-3, F-9, NFR-9
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- Version check timestamp expired
- `_curl()` mocked to fail (network error)

**Steps**:
1. Set version-check timestamp to >24h ago
2. Mock `_curl()` to return exit code 7 (connection refused)
3. Run version check function
4. Verify no error output to stderr (silent discard)
5. Verify function returns 0 (does not propagate failure)

**Expected Outcome**:
- Network failure silently discarded, no user-visible error

---

#### TC-TTI-063 - Doc URL in unconfigured provider error

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F10-1, F-10
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @cli, @backend

**Preconditions**:
- Provider not configured (e.g., Google with no credentials)

**Steps**:
1. Unset all Google auth vars (`GOOGLE_API_KEY`, `GOOGLE_CREDENTIALS`)
2. Attempt generation with `--provider google`
3. Capture stderr output
4. Verify error contains URL: `https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/tools/text-to-image.md#google-imagen`

**Expected Outcome**:
- Error message includes direct deep link to provider setup documentation

---

#### TC-TTI-064 - Doc URL anchors match provider headings

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-F10-1, AC-DOC-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- Script sourced, `PROVIDER_DOC_ANCHORS` map available

**Steps**:
1. Verify `PROVIDER_DOC_ANCHORS` contains entries for all 7 providers
2. Verify anchor values match expected patterns: `openai`, `stability-ai`, `google-imagen`, `hugging-face`, `black-forest-labs`, `replicate`, `siliconflow`

**Expected Outcome**:
- All provider anchors defined and match documentation heading slugs

---

#### TC-TTI-070 - Google Imagen end-to-end with API key auth

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: F-11, EXT-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-integration.sh`
**Tags**: @api, @backend

**Preconditions**:
- `GOOGLE_AUTH_METHOD="api-key"`, `GOOGLE_API_KEY` and `GOOGLE_PROJECT_ID` set
- `_curl()` mocked to return base64-encoded image prediction

**Steps**:
1. Set Google auth env vars
2. Mock curl to return `{"predictions":[{"bytesBase64Encoded":"bW9jayBpbWFnZQ=="}]}`
3. Call `generate_image` with provider `google` and model `imagen-4.0-generate-001`
4. Verify exit code 0 and image file created

**Expected Outcome**:
- Google Imagen generation completes with API key auth

---

#### TC-TTI-071 - Google Imagen API URL construction

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-11
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- `google_imagen_api_url()` function available

**Steps**:
1. Call `google_imagen_api_url "my-project" "us-central1" "imagen-4.0-generate-001"`
2. Verify URL matches expected Vertex AI pattern
3. Test with different project, location, and model combinations

**Expected Outcome**:
- Correct Vertex AI endpoint URL constructed for each model/location combination

---

#### TC-TTI-072 - Google service account JSON auth with mocked token

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-F11-1, F-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-integration.sh`
**Tags**: @api, @backend, @security

**Preconditions**:
- Test RSA key generated via `openssl genrsa`
- Service account JSON file created in temp dir
- `_curl()` mocked for OAuth2 token exchange and image generation

**Steps**:
1. Generate test RSA key with `openssl genrsa 2048`
2. Create service account JSON with test key and project ID
3. Set `GOOGLE_AUTH_METHOD="json"` and `GOOGLE_CREDENTIALS` to file path
4. Mock curl to return OAuth2 token then image prediction
5. Call `generate_image` with provider `google`
6. Verify exit code 0 and image file created

**Expected Outcome**:
- Service account JWT authentication flow completes with mocked token endpoint

---

#### TC-TTI-073 - Google auth token caching

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-11
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend, @perf

**Preconditions**:
- `_GOOGLE_ACCESS_TOKEN` and `_GOOGLE_TOKEN_EXPIRY` set to valid cached values

**Steps**:
1. Set `_GOOGLE_ACCESS_TOKEN="cached-token-abc"` and `_GOOGLE_TOKEN_EXPIRY` to future timestamp
2. Call `obtain_google_access_token`
3. Verify returned token is `cached-token-abc` (no new token fetch)

**Expected Outcome**:
- Cached token returned without network call when not expired

---

#### TC-TTI-074 - Google auth auto-detection priority

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-11
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- `GOOGLE_CREDENTIALS` file present
- Provider selection available

**Steps**:
1. Unset all other provider keys
2. Set `GOOGLE_CREDENTIALS` to a valid service account JSON file
3. Call `select_provider "high"`
4. Verify `google` is selected

**Expected Outcome**:
- Google provider detected via credentials file in auto-detection

---

#### TC-TTI-075 - Google auth missing credentials error

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-11
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- `GOOGLE_AUTH_METHOD="json"`, `GOOGLE_CREDENTIALS` points to nonexistent file

**Steps**:
1. Set `GOOGLE_AUTH_METHOD="json"` and `GOOGLE_CREDENTIALS="/nonexistent/path/creds.json"`
2. Call `obtain_google_access_token` and capture exit code
3. Verify exit code is `EXIT_AUTH_FAILED`

**Expected Outcome**:
- Auth failure with clear error when credentials file missing

---

#### TC-TTI-076 - Google Imagen payload aspect ratio mapping

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-11
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- `google_imagen_build_payload()` function available

**Steps**:
1. Call with 1024x1024 and verify `1:1` aspect ratio
2. Call with 1920x1080 and verify `16:9` aspect ratio
3. Call with 1080x1920 and verify `9:16` aspect ratio
4. Call with 1024x768 and verify `4:3` aspect ratio
5. Call with negative prompt and verify `negativePrompt` field present

**Expected Outcome**:
- Aspect ratios correctly computed from pixel dimensions

---

#### TC-TTI-077 - Google model validation rejects invalid models

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-11
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- Google auth configured

**Steps**:
1. Call `generate_image_google` with model `invalid-model`
2. Verify exit code is `EXIT_INVALID_PARAMS` (2)

**Expected Outcome**:
- Invalid model rejected before API call

---

#### TC-TTI-080 - JSON output format for generation result

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-12, DM-3
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-integration.sh`
**Tags**: @cli, @api

**Preconditions**:
- `OUTPUT_FORMAT=json` set
- Mocked curl for generation

**Steps**:
1. Set `OUTPUT_FORMAT=json`
2. Generate image with mocked provider
3. Capture JSON output
4. Validate JSON with `jq`
5. Verify `status` field is `success`
6. Verify `output` field contains file path

**Expected Outcome**:
- Output is valid JSON per DM-3: `{"status": "success", "output": "/path/to/image.png"}`

---

#### TC-TTI-081 - JSON output format for errors

**Scenario Type**: Edge Case
**Impact Level**: Minor
**Priority**: Low
**Related IDs**: F-12
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-integration.sh`
**Tags**: @cli, @api

**Preconditions**:
- `OUTPUT_FORMAT=json` set
- Error condition triggered (e.g., invalid provider)

**Steps**:
1. Set `OUTPUT_FORMAT=json`
2. Attempt generation with invalid parameters
3. Capture output and verify valid JSON error format

**Expected Outcome**:
- Error output is machine-readable JSON

---

#### TC-TTI-085 - Invalid parameter handling — empty prompt

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @cli, @backend

**Preconditions**:
- `validate_config()` function available

**Steps**:
1. Call `validate_config "" "test.png" "high" 1024 1024`
2. Verify exit code is `EXIT_INVALID_PARAMS` (2)

**Expected Outcome**:
- Empty prompt rejected with appropriate error

---

#### TC-TTI-086 - Invalid parameter handling — invalid quality

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @cli, @backend

**Preconditions**:
- `validate_config()` function available

**Steps**:
1. Call `validate_config "prompt" "test.png" "invalid" 1024 1024`
2. Verify exit code is `EXIT_INVALID_PARAMS` (2)

**Expected Outcome**:
- Invalid quality profile rejected

---

#### TC-TTI-087 - Invalid parameter handling — invalid dimensions

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @cli, @backend

**Preconditions**:
- `validate_config()` function available

**Steps**:
1. Call `validate_config "prompt" "test.png" "high" 100 1024`
2. Verify exit code is `EXIT_INVALID_PARAMS` (2)

**Expected Outcome**:
- Dimensions below minimum threshold rejected

---

#### TC-TTI-088 - Invalid provider name rejected

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-integration.sh`
**Tags**: @cli, @backend

**Preconditions**:
- `generate_image()` available

**Steps**:
1. Call `generate_image` with `provider="invalid_provider"`
2. Verify exit code is `EXIT_INVALID_PARAMS` (2)

**Expected Outcome**:
- Unknown provider name rejected with error

---

#### TC-TTI-089 - Invalid model name for provider rejected

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-1
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-integration.sh`
**Tags**: @cli, @backend

**Preconditions**:
- `OPENAI_API_KEY` set

**Steps**:
1. Call `generate_image` with provider `openai` and model `invalid-model`
2. Verify exit code is `EXIT_INVALID_PARAMS` (2)

**Expected Outcome**:
- Invalid model rejected before API call

---

#### TC-TTI-090 - All unit tests pass

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-TEST-1, F-1 through F-12
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- Tool script and unit test file exist and are executable

**Steps**:
1. Run `bash tools/.tests/test-text-to-image-unit.sh`
2. Verify all tests pass (summary shows 0 failed)
3. Verify exit code 0

**Expected Outcome**:
- All ~42+ unit tests pass

---

#### TC-TTI-091 - All integration tests pass

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-TEST-2, F-1, F-3, F-11
**Test Type(s)**: Integration
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-integration.sh`
**Tags**: @backend, @api

**Preconditions**:
- Tool script and integration test file exist and are executable

**Steps**:
1. Run `bash tools/.tests/test-text-to-image-integration.sh`
2. Verify all tests pass (summary shows 0 failed)
3. Verify exit code 0

**Expected Outcome**:
- All ~21+ integration tests pass

---

#### TC-TTI-092 - All performance tests pass

**Scenario Type**: Regression
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-TEST-3, NFR-1, NFR-2
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-performance.sh`
**Tags**: @backend, @perf

**Preconditions**:
- Tool script and performance test file exist and are executable

**Steps**:
1. Run `bash tools/.tests/test-text-to-image-performance.sh`
2. Verify all tests pass (summary shows 0 failed)
3. Verify exit code 0

**Expected Outcome**:
- All ~8+ performance tests pass (startup <200ms, cache hit <100ms)

---

#### TC-TTI-100 - All 7 providers documented with required fields

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-DOC-1
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/tools/text-to-image.md`
**Tags**: @ui

**Preconditions**:
- Documentation file exists

**Steps**:
1. Open `doc/tools/text-to-image.md`
2. For each of the 7 providers (OpenAI, Stability AI, Google Imagen, Hugging Face, Black Forest Labs, Replicate, SiliconFlow), verify:
   - Dedicated heading (e.g., `### OpenAI`)
   - Sign-up URL
   - API key console URL
   - Environment variable name
   - Gotchas / limitations
   - Approximate pricing

**Expected Outcome**:
- All 7 providers fully documented with all required fields

---

#### TC-TTI-101 - Provider heading anchors produce deterministic URLs

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-DOC-1, AC-F10-1
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `doc/tools/text-to-image.md`
**Tags**: @ui

**Preconditions**:
- Documentation file exists
- Script `PROVIDER_DOC_ANCHORS` map accessible

**Steps**:
1. Extract heading anchor slugs from doc (e.g., `### OpenAI` -> `#openai`)
2. Compare with `PROVIDER_DOC_ANCHORS` values in the tool script
3. Verify all 7 anchors match

**Expected Outcome**:
- Doc-linked error URLs will resolve to correct documentation sections

---

#### TC-TTI-102 - Version near top links to changelog subsection

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-DOC-2
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `doc/tools/text-to-image.md`
**Tags**: @ui

**Preconditions**:
- Documentation file exists

**Steps**:
1. Open `doc/tools/text-to-image.md`
2. Verify version line near top (e.g., `> Version 1.0.0 | [Changelog](#100-2026-03-07)`)
3. Verify `## Changelog` section exists
4. Verify `### 1.0.0` subsection exists with date
5. Verify changelog anchor link resolves correctly

**Expected Outcome**:
- Version displayed at top with working link to changelog entry

---

#### TC-TTI-110 - Agent prompt includes model discovery workflow

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-AGENT-1, F-4, F-12
**Test Type(s)**: Manual
**Automation Level**: Manual
**Target Layer / Location**: `.opencode/agent/image-generator.md`
**Tags**: @ui

**Preconditions**:
- Agent prompt file updated

**Steps**:
1. Open `.opencode/agent/image-generator.md`
2. Verify prompt includes instruction to run `tools/text-to-image --list-models --output-format json`
3. Verify prompt includes guidance to parse JSON response for model selection
4. Verify task-based routing table or guidance exists (photorealistic, illustration, etc.)
5. Verify reference to `doc/tools/text-to-image.md` for troubleshooting

**Expected Outcome**:
- Agent prompt enables autonomous model discovery and task-based selection

---

#### TC-TTI-120 - AGENTS.md includes new documentation references

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-AGENTS-1
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: `AGENTS.md`
**Tags**: @ui

**Preconditions**:
- `AGENTS.md` updated

**Steps**:
1. Open `AGENTS.md`
2. Verify Key References table includes `doc/tools/text-to-image.md`
3. Verify Key References table includes `doc/guides/tools-convention.md`
4. Verify `[planned]` tag removed from `tools/` entries in repo structure

**Expected Outcome**:
- AGENTS.md references updated to reflect new deliverables

---

#### TC-TTI-130 - Zero private project references in repository

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-CLEAN-1
**Test Type(s)**: Manual
**Automation Level**: Semi-automated
**Target Layer / Location**: Repository-wide
**Tags**: @security, @backend

**Preconditions**:
- All files committed

**Steps**:
1. Run `grep -rn "menuvivo" tools/ doc/tools/ .opencode/agent/image-generator.md`
2. Run `grep -rn "text-to-img[^a]" tools/ doc/tools/` (match `text-to-img` but not `text-to-image`)
3. Run `grep -rn "PDEV-" tools/ doc/tools/ .opencode/agent/image-generator.md`
4. Verify zero matches for all three searches

**Expected Outcome**:
- No private project identifiers found in any committed file

---

#### TC-HDR-001 - .sh extension file gets bash-comment license header

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-HEADER-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-add-header-location.sh`
**Tags**: @backend

**Preconditions**:
- `scripts/add-header-location.sh` enhanced for bash support
- Temp `.sh` file without header created

**Steps**:
1. Create temp file `test-script.sh` with `#!/usr/bin/env bash` and some content
2. Run `scripts/add-header-location.sh` on the file
3. Verify file now contains `# Copyright (c)` line
4. Verify file contains `# MIT License` line
5. Verify file contains `# Latest version:` line
6. Verify header appears as bash comments (lines starting with `#`)

**Expected Outcome**:
- MIT license header added as bash comments to `.sh` file

---

#### TC-HDR-002 - Shebang-detected file gets header after shebang

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: AC-HEADER-2
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-add-header-location.sh`
**Tags**: @backend

**Preconditions**:
- Temp file without `.sh` extension but with bash shebang

**Steps**:
1. Create temp file `my-tool` (no extension) with `#!/usr/bin/env bash` on line 1
2. Run `scripts/add-header-location.sh` on the file
3. Verify shebang remains on line 1
4. Verify license header appears on lines 2-4
5. Verify original content follows the header

**Expected Outcome**:
- Header inserted after shebang line, preserving shebang as first line

---

#### TC-HDR-003 - Bash file with existing header is idempotent

**Scenario Type**: Edge Case
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-HEADER-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-add-header-location.sh`
**Tags**: @backend

**Preconditions**:
- Bash file already containing MIT license header

**Steps**:
1. Create temp `.sh` file with existing license header
2. Run `scripts/add-header-location.sh` on the file
3. Run it again
4. Verify file has exactly one copy of the header (not duplicated)

**Expected Outcome**:
- Script is idempotent; running twice produces same result

---

#### TC-HDR-004 - Directory processing finds both .md and .sh files

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: AC-HEADER-1
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `scripts/.tests/test-add-header-location.sh`
**Tags**: @backend

**Preconditions**:
- Temp directory with both `.md` and `.sh` files

**Steps**:
1. Create temp directory with one `.md` file and one `.sh` file
2. Run `scripts/add-header-location.sh` on the directory
3. Verify both files received appropriate headers (YAML frontmatter for `.md`, bash comments for `.sh`)

**Expected Outcome**:
- Directory processing handles both file types

---

#### TC-PERF-001 - Startup / --help time under 200ms

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-1
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-performance.sh`
**Tags**: @perf

**Preconditions**:
- Tool script available and executable

**Steps**:
1. Measure time for `tools/text-to-image --help` using `date +%s%3N`
2. Repeat 3 times and take maximum
3. Verify maximum is < 200ms

**Expected Outcome**:
- Startup time under 200ms (p99)

---

#### TC-PERF-002 - Cache hit retrieval under 100ms

**Scenario Type**: Happy Path
**Impact Level**: Critical
**Priority**: High
**Related IDs**: NFR-2
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-performance.sh`
**Tags**: @perf, @backend

**Preconditions**:
- Cache populated with a known entry
- Mocked curl (should not be called on cache hit)

**Steps**:
1. Generate an image to populate cache
2. Measure time for second generation with same parameters (cache hit)
3. Verify time < 100ms

**Expected Outcome**:
- Cached image retrieval completes in under 100ms

---

#### TC-PERF-003 - Parallel batch speedup over sequential

**Scenario Type**: Happy Path
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: F-6
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-performance.sh`
**Tags**: @perf, @backend

**Preconditions**:
- Mocked curl with simulated 100ms delay
- 2 batch jobs

**Steps**:
1. Time sequential batch processing
2. Time parallel batch processing
3. Verify parallel is faster

**Expected Outcome**:
- Parallel processing demonstrates measurable speedup

---

#### TC-PERF-004 - Rate limiting backoff handling

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-4
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-performance.sh`
**Tags**: @backend, @perf

**Preconditions**:
- `_curl()` mocked to always return HTTP 429

**Steps**:
1. Mock curl to return 429 with `Retry-After: 2` header
2. Call `retry_curl`
3. Verify retries are attempted (up to 3)
4. Verify eventual failure with `EXIT_NETWORK_ERROR`

**Expected Outcome**:
- Rate limit handled with backoff, eventually fails after max retries

---

#### TC-PERF-005 - Timeout enforcement on hung provider

**Scenario Type**: Negative
**Impact Level**: Important
**Priority**: Medium
**Related IDs**: NFR-3
**Test Type(s)**: Unit
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-unit.sh`
**Tags**: @backend

**Preconditions**:
- `timeout` command available
- Mocked generation that hangs (sleep)

**Steps**:
1. Mock `generate_image` to sleep 10 seconds
2. Run with 1-second timeout
3. Verify timeout exit code (124)

**Expected Outcome**:
- Hung provider times out and does not block indefinitely

---

#### TC-PERF-006 - Google auth token caching performance

**Scenario Type**: Happy Path
**Impact Level**: Minor
**Priority**: Low
**Related IDs**: NFR-10, F-11
**Test Type(s)**: Performance
**Automation Level**: Automated
**Target Layer / Location**: `tools/.tests/test-text-to-image-performance.sh`
**Tags**: @perf, @backend

**Preconditions**:
- Google token cached with future expiry

**Steps**:
1. Set cached Google token
2. Call `obtain_google_access_token` 100 times in loop
3. Measure total time
4. Verify 100 lookups complete in < 500ms

**Expected Outcome**:
- Token caching avoids repeated network calls, 100 lookups fast

## 6. Environments and Test Data

### Test Environments

| Environment | Purpose | Requirements |
|-------------|---------|-------------|
| Local development | All test types | Bash 4+, curl, optional: jq, yq, exiftool, openssl, bc |
| CI (Linux) | Automated tests | Bash 4+, curl, jq |
| CI (macOS) | Portability verification | Bash 4+ (via homebrew), curl |

### Test Data Strategy

- **API keys**: Mock values (e.g., `sk-mock123`, `mock-google-key`) — never real keys
- **Image data**: String `"mock image data"` or base64-encoded `"bW9jayBpbWFnZQ=="` ("mock image")
- **API responses**: Inline JSON matching provider response formats
- **Config files**: Created in `mktemp -d` temp directories, cleaned up in EXIT trap
- **RSA keys**: Generated on-the-fly via `openssl genrsa 2048` for Google service account tests
- **Batch jobs**: Inline JSON arrays with temp directory output paths

### Mocking Strategy

All external commands are wrapped in mockable functions per `.ai/rules/bash.md` section 10.3:

| External | Wrapper | Mock Technique |
|----------|---------|----------------|
| `curl` | `_curl()` | Override function in test to return fixture data |
| `jq` | `_jq()` | Override via `JQ_CMD` env var or function |
| `yq` | Via `command -v` | Remove from PATH to test fallback |
| `exiftool` | Via `command -v` | Remove from PATH to test sidecar fallback |
| `openssl` | Direct call | Real calls for test RSA key generation |
| `gcloud` | Via `command -v` | Remove from PATH to test detection |

## 7. Automation Plan and Implementation Mapping

| TC-ID | Automation Level | Test File | Implementation Phase |
|-------|-----------------|-----------|---------------------|
| TC-TTI-001 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-002 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-003 | Automated | `tools/.tests/test-text-to-image-integration.sh` | Phase 2 |
| TC-TTI-004 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-005 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-006 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-007 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-008 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-009 | Manual | N/A | Phase 1 |
| TC-TTI-010 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-011 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-012 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-020 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-021 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-022 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-023 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-030 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-031 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-032 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-033 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-034 | Automated | `tools/.tests/test-text-to-image-integration.sh` | Phase 2 |
| TC-TTI-035 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-036 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-040 | Automated | `tools/.tests/test-text-to-image-integration.sh` | Phase 2 |
| TC-TTI-041 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-044 | Automated | `tools/.tests/test-text-to-image-integration.sh` | Phase 2 |
| TC-TTI-045 | Automated | `tools/.tests/test-text-to-image-integration.sh` | Phase 2 |
| TC-TTI-046 | Automated | `tools/.tests/test-text-to-image-integration.sh` | Phase 2 |
| TC-TTI-047 | Automated | `tools/.tests/test-text-to-image-integration.sh` | Phase 2 |
| TC-TTI-048 | Automated | `tools/.tests/test-text-to-image-integration.sh` | Phase 2 |
| TC-TTI-049 | Automated | `tools/.tests/test-text-to-image-integration.sh` | Phase 2 |
| TC-TTI-050 | Automated | `tools/.tests/test-text-to-image-integration.sh` | Phase 2 |
| TC-TTI-051 | Automated | `tools/.tests/test-text-to-image-performance.sh` | Phase 2 |
| TC-TTI-052 | Automated | `tools/.tests/test-text-to-image-performance.sh` | Phase 2 |
| TC-TTI-055 | Automated | `tools/.tests/test-text-to-image-integration.sh` | Phase 2 |
| TC-TTI-056 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-060 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-061 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-062 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-063 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-064 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-070 | Automated | `tools/.tests/test-text-to-image-integration.sh` | Phase 2 |
| TC-TTI-071 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-072 | Automated | `tools/.tests/test-text-to-image-integration.sh` | Phase 2 |
| TC-TTI-073 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-074 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-075 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-076 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-077 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-080 | Automated | `tools/.tests/test-text-to-image-integration.sh` | Phase 2 |
| TC-TTI-081 | Automated | `tools/.tests/test-text-to-image-integration.sh` | Phase 2 |
| TC-TTI-085 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-086 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-087 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-088 | Automated | `tools/.tests/test-text-to-image-integration.sh` | Phase 2 |
| TC-TTI-089 | Automated | `tools/.tests/test-text-to-image-integration.sh` | Phase 2 |
| TC-TTI-090 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-TTI-091 | Automated | `tools/.tests/test-text-to-image-integration.sh` | Phase 2 |
| TC-TTI-092 | Automated | `tools/.tests/test-text-to-image-performance.sh` | Phase 2 |
| TC-TTI-100 | Manual | N/A | Phase 3 |
| TC-TTI-101 | Semi-automated | N/A | Phase 3 |
| TC-TTI-102 | Manual | N/A | Phase 3 |
| TC-TTI-110 | Manual | N/A | Phase 4 |
| TC-TTI-120 | Semi-automated | N/A | Phase 6 |
| TC-TTI-130 | Semi-automated | N/A | Phase 6 |
| TC-HDR-001 | Automated | `scripts/.tests/test-add-header-location.sh` | Phase 5 |
| TC-HDR-002 | Automated | `scripts/.tests/test-add-header-location.sh` | Phase 5 |
| TC-HDR-003 | Automated | `scripts/.tests/test-add-header-location.sh` | Phase 5 |
| TC-HDR-004 | Automated | `scripts/.tests/test-add-header-location.sh` | Phase 5 |
| TC-PERF-001 | Automated | `tools/.tests/test-text-to-image-performance.sh` | Phase 2 |
| TC-PERF-002 | Automated | `tools/.tests/test-text-to-image-performance.sh` | Phase 2 |
| TC-PERF-003 | Automated | `tools/.tests/test-text-to-image-performance.sh` | Phase 2 |
| TC-PERF-004 | Automated | `tools/.tests/test-text-to-image-performance.sh` | Phase 2 |
| TC-PERF-005 | Automated | `tools/.tests/test-text-to-image-unit.sh` | Phase 2 |
| TC-PERF-006 | Automated | `tools/.tests/test-text-to-image-performance.sh` | Phase 2 |

### Test execution commands

```bash
# Unit tests (fast, isolated, mocked)
bash tools/.tests/test-text-to-image-unit.sh

# Integration tests (mocked API flows)
bash tools/.tests/test-text-to-image-integration.sh

# Performance tests (timing, caching, batching)
bash tools/.tests/test-text-to-image-performance.sh

# Header script tests
bash scripts/.tests/test-add-header-location.sh

# All tests (via aggregator)
bash scripts/test-all.sh
```

## 8. Risks, Assumptions, and Open Questions

### Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Blueprint test naming/path references not fully updated | Test failures | Systematic search-replace during porting; TC-TTI-130 catches residual references |
| Google service account test requires `openssl` for RSA key generation | Test skip on minimal environments | Skip test gracefully if `openssl` not available |
| Performance tests sensitive to CI machine load | False failures | Use generous thresholds (200ms, 100ms) and allow retries |
| `bc` dependency for performance assertions | Test failure on minimal systems | Check for `bc` and skip performance tests if unavailable |
| Mock curl behavior may not match all provider response edge cases | Missing coverage | Blueprint tests provide proven mocks; extend as needed |

### Assumptions

| ID | Assumption |
|----|-----------|
| TA-1 | The tool script follows `.ai/rules/bash.md` testable main guard pattern, allowing sourcing for unit tests |
| TA-2 | All external commands are wrapped in mockable functions (`_curl()`, `_jq()`, etc.) |
| TA-3 | Test framework is embedded per `.ai/rules/bash.md` section 11 (no external test runner needed) |
| TA-4 | CI environments have at least bash 4+, curl, and jq available |
| TA-5 | Blueprint test files are accurate reference implementations that need only naming/path adaptation |

### Open Questions

| ID | Question | Status |
|----|----------|--------|
| OQ-TP-1 | Should integration tests with real API keys be run in CI with secrets, or only manually? Current plan: mocked only in CI, real API tests manual. | Open |
| OQ-TP-2 | Should a dedicated `.ai/rules/testing-strategy.mdc` file be created to formalize the bash testing approach already documented in `.ai/rules/bash.md` sections 10-12? | Open |
| OQ-TP-3 | Should cross-platform tests (macOS vs Linux `stat` flags, `date` differences) be part of CI or manual? | Open |

## 9. Plan Revision Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-07 | @test-plan-writer | Initial test plan — 71 scenarios across 9 categories covering all 17 AC |

## 10. Test Execution Log

_No tests executed yet._
