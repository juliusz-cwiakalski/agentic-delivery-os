---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/changes/2026-03/2026-03-06--GH-26--text-to-img-toolbox/chg-GH-26-spec.md

change:
  ref: GH-26
  type: feat
  status: Complete
  slug: text-to-img-toolbox
  title: "Publish text-to-image CLI tool, agent tuning, and tools convention"
  owners: [Juliusz Ćwiąkalski]
  service: tools
  labels: [cli, image-generation, agent-tuning, convention]
  version_impact: minor
  audience: external
  security_impact: low
  risk_level: medium
  dependencies:
    internal: [tools/, .opencode/agent/image-generator.md, scripts/add-header-location.sh, AGENTS.md]
    external: [OpenAI API, Stability AI API, Google Vertex AI (Imagen), Hugging Face Inference API, Black Forest Labs API, Replicate API, SiliconFlow API]
---

# CHANGE SPECIFICATION

**PURPOSE**: Publish a standalone, agent-agnostic `text-to-image` CLI tool under `tools/`, create comprehensive user documentation with per-provider setup guides, tune the `@image-generator` agent for model discovery and task-based routing, enhance the license-header script for bash files, and establish the `tools/` convention for all future CLI utilities in ADOS.

## 1. SUMMARY

ADOS provides an `@image-generator` agent but lacks the CLI tool it references. A battle-tested ~2100-line bash script exists in a private project and needs to be extracted, adapted for open-source publication under MIT license, and published as `tools/text-to-image`. This change also establishes the `tools/` directory convention (already documented in `doc/guides/tools-convention.md`), tunes the agent prompt for intelligent model selection, creates extensive per-provider documentation, enhances the license-header script for bash files, and updates `AGENTS.md` with references to the new documentation.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **`@image-generator` agent** (`.opencode/agent/image-generator.md`) exists and references a `text-to-image` CLI tool that does not yet exist in the repository.
- **`tools/` directory** is declared in `AGENTS.md` as `[planned]` — no tools exist yet.
- **`doc/guides/tools-convention.md`** has been written and defines the full standard for building CLI tools (versioning, help, license headers, version check, config directory, error handling, tests).
- **`scripts/add-header-location.sh`** adds MIT license headers to Markdown files but does not support bash scripts.
- **Source script** (~2100 lines) supports 7 providers: OpenAI DALL-E, Stability AI, Google Imagen (3 auth methods, 5 models), Hugging Face, Black Forest Labs FLUX, Replicate, SiliconFlow.
- **GH-27** (AGENTS.md creation) is already delivered and merged.

### 2.2 Pain Points / Gaps

- The `@image-generator` agent cannot function because the tool it references does not exist.
- No convention exists for building tools in `tools/` — this change is the first to establish the pattern.
- The source script contains private project references (paths, config directory naming, internal documentation URLs) that must be removed before open-source publication.
- The existing agent prompt lacks model discovery capabilities — it cannot determine which providers are available or which model is best for a given task type.
- The license-header script cannot process bash files, leaving new tool scripts without proper headers.

## 3. PROBLEM STATEMENT

The `@image-generator` agent references a `text-to-image` CLI tool that does not exist in the repository. Without this tool, the agent is non-functional. Additionally, no convention or precedent exists for publishing standalone CLI tools under `tools/`, making this the founding contribution to that directory. The source script from a private project must be adapted for open-source use, documented extensively, and accompanied by tests — all while establishing patterns that future tools will follow.

## 4. GOALS

| ID | Goal | Rationale |
|----|------|-----------|
| G-1 | Publish `tools/text-to-image` as a standalone, executable CLI tool | Enable the `@image-generator` agent and any user/agent to generate images from text prompts |
| G-2 | Create per-provider documentation with stable anchor URLs | Allow error messages and agent prompts to deep-link to setup instructions |
| G-3 | Tune `@image-generator` agent for model discovery and task-based routing | Enable intelligent provider/model selection based on available API keys and task requirements |
| G-4 | Port and adapt test suite (unit, integration, performance) | Ensure reliability and prevent regressions as the tool evolves |
| G-5 | Enhance `scripts/add-header-location.sh` for bash script support | Ensure all new files (including tools) receive proper MIT license headers |
| G-6 | Establish `tools/` convention as a living example | The first tool sets the precedent; `doc/guides/tools-convention.md` is already written |

### 4.1 Success Metrics / KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Tool execution | `tools/text-to-image --help`, `--version`, `--dry-run`, `--list-models` all exit 0 | Manual and automated test |
| Provider coverage | All 7 providers callable via `--provider` flag | Integration tests with configured API keys |
| Unit test pass rate | 100% of unit tests pass | `bash tools/.tests/test-text-to-image-unit.sh` |
| Documentation completeness | All 7 providers have setup sections with sign-up URL, API key console URL, env var, gotchas, and approximate pricing | Manual review of `doc/tools/text-to-image.md` |
| Agent model discovery | `@image-generator` can run `--list-models --output-format json` and parse the result to select a model | Agent invocation test |
| Header script coverage | `scripts/add-header-location.sh` correctly processes `.sh` files and shebang-detected bash files | Unit tests in `scripts/.tests/` |

### 4.2 Non-Goals

- `[OUT]` Building a GUI or web interface for image generation.
- `[OUT]` Supporting image editing, inpainting, or outpainting (generation only).
- `[OUT]` Implementing image-to-image or style transfer capabilities.
- `[OUT]` Creating a package manager distribution (homebrew, npm, etc.).
- `[OUT]` Supporting providers beyond the 7 already implemented in the source.
- `[OUT]` Implementing real-time streaming of generation progress.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Description |
|----|-----------|-------------|
| F-1 | Single image generation | Generate one image from a text prompt using a selected or auto-selected provider/model |
| F-2 | Multi-model comparison | Generate the same prompt across multiple models simultaneously, producing model-suffixed output files |
| F-3 | Quality-based provider selection | Automatically select the best available provider based on quality profile (high/medium/low) and configured API keys |
| F-4 | Model discovery | List available models for configured providers (`--list-models`) or all known models (`--all-models`), with JSON output support |
| F-5 | Response caching | Cache generated images by SHA-256 hash of generation parameters to avoid redundant API calls |
| F-6 | Batch processing | Process multiple image generation jobs from a YAML configuration file, sequentially or in parallel |
| F-7 | Metadata embedding | Embed EXIF/XMP metadata (artist, copyright, keywords, description, prompt) in generated images via exiftool, with JSON sidecar fallback |
| F-8 | Dry-run simulation | Validate command structure and show what API calls would be made without executing them |
| F-9 | Automatic version check | Check for newer versions of the tool on GitHub (24h cache, silent failure, opt-out via env var) |
| F-10 | Documentation-linked error messages | Configuration errors (missing API keys, unconfigured providers) include direct links to the relevant provider setup section in documentation |
| F-11 | Google Imagen multi-auth | Support 3 authentication methods for Google Imagen: service account JSON, gcloud CLI, and API key, with automatic detection |
| F-12 | Machine-readable output | Support `--output-format json` for all operations (generation results, errors, model listing) to enable programmatic consumption by agents |

### 5.1 Capability Details

**F-1: Single image generation**
- Rationale: Core purpose of the tool — translate text prompts into image files.
- Inputs: `--prompt`, `--output`, optional `--provider`, `--model`, `--quality`, `--width`, `--height`, `--negative-prompt`.
- Quality profiles define provider fallback chains: high (OpenAI → Stability → Google), medium (Stability → OpenAI → Replicate), low (Hugging Face → Stability → SiliconFlow).

**F-3: Quality-based provider selection**
- Rationale: Users should not need to know which providers are configured; the tool selects the best available one based on the quality profile and available API keys.
- The selection chain is deterministic and documented in `--help` output.

**F-4: Model discovery**
- Rationale: Enables the `@image-generator` agent to auto-discover which models are available at runtime, rather than relying on hardcoded lists in the agent prompt.
- `--list-models` shows models for providers with configured API keys.
- `--all-models` shows all known models regardless of configuration.
- Both support `--output-format json` for machine parsing.

**F-9: Automatic version check**
- Rationale: Users running an older version should be notified without blocking their workflow.
- Mechanism: Fetch raw script from GitHub main branch, extract `APP_VERSION`, compare. Cache result for 24 hours. Silent on failure. Opt-out: `TEXT_TO_IMAGE_NO_VERSION_CHECK=true`.

**F-10: Documentation-linked error messages**
- Rationale: When a provider is not configured, the error should guide the user to the exact documentation section for that provider's setup.
- Error messages include a stable GitHub URL like: `https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/tools/text-to-image.md#openai`

**F-11: Google Imagen multi-auth**
- Rationale: Google Imagen via Vertex AI supports multiple authentication mechanisms; the tool should support all three to cover production (service account), development (gcloud), and legacy (API key) workflows.
- Auto-detection priority: service account JSON → gcloud CLI → API key.
- Override via `--google-auth-method` flag.

## 6. USER & SYSTEM FLOWS

### Flow 1: Single Image Generation (Human User)

1. User invokes `tools/text-to-image --prompt "..." --output image.png`
2. Tool loads configuration from `~/.ai/text-to-image/.env` if present
3. Tool checks for version updates (if 24h cache expired)
4. Tool selects provider based on quality profile and available API keys
5. Tool validates prompt, output path, and dimensions
6. Tool checks cache for existing matching image
7. On cache miss: tool calls provider API with retry logic
8. Tool saves image to output path
9. Tool stores image in cache with metadata
10. Tool reports success (text or JSON format)

### Flow 2: Agent-Driven Model Discovery and Generation

1. `@image-generator` runs `tools/text-to-image --list-models --output-format json`
2. Agent parses JSON response to determine available providers and models
3. Agent selects model based on task type (e.g., photorealistic → DALL-E 3, illustration → Stable Diffusion)
4. Agent invokes `tools/text-to-image --prompt "..." --provider X --model Y --output path.png --output-format json`
5. Agent parses JSON response for status, output path, and any warnings

### Flow 3: Unconfigured Provider Error

1. User invokes `tools/text-to-image --provider google --prompt "..." --output img.png`
2. Tool detects no Google authentication method is available
3. Tool outputs error with link: `https://github.com/.../doc/tools/text-to-image.md#google-imagen`
4. User follows link, configures credentials, retries successfully

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- Port and adapt `tools/text-to-image` from private project source (~2100 lines)
- Rename config directory from `~/.ai/text-to-img/` to `~/.ai/text-to-image/` (consistent with tool name)
- Rename tool from `text-to-img` to `text-to-image` (ADOS naming)
- Remove all private project references from the script
- Implement `--help` per tools convention (examples, doc link, license info)
- Implement `--version` per tools convention (name, version, copyright, MIT, URL)
- Implement automatic version check per tools convention (24h cache, silent failure, opt-out)
- Implement documentation-linked error messages for unconfigured providers
- Create `doc/tools/text-to-image.md` with per-provider setup guides, stable anchors, version, changelog
- Create unit tests: `tools/.tests/test-text-to-image-unit.sh`
- Create integration tests: `tools/.tests/test-text-to-image-integration.sh`
- Create performance tests: `tools/.tests/test-text-to-image-performance.sh`
- Tune `@image-generator` agent (`.opencode/agent/image-generator.md`) for model discovery and task-based routing
- Enhance `scripts/add-header-location.sh` to detect and process bash scripts (by `.sh` extension or shebang)
- Update `AGENTS.md` Key References with new documentation links
- Apply MIT license headers to all new files

### 7.2 Out of Scope

- `[OUT]` Image editing, inpainting, outpainting, or image-to-image transformation
- `[OUT]` Adding new providers beyond the 7 already supported
- `[OUT]` Package manager distribution (homebrew formula, npm package, etc.)
- `[OUT]` Web UI or API server mode
- `[OUT]` Real-time generation progress streaming
- `[OUT]` Changes to other agents beyond `@image-generator`

### 7.3 Deferred / Maybe-Later

- Support for additional image generation providers (e.g., Midjourney API when available)
- Prompt template library for common use cases
- Image quality assessment/scoring integration
- Cost tracking and budget management across providers

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

_Not applicable — this is a CLI tool, not a service._

### 8.2 Events / Messages

_Not applicable — no event-driven communication._

### 8.3 Data Model Impact

**DM-1: Configuration directory structure**

```
~/.ai/text-to-image/
  ├── .env              # API keys and environment overrides
  ├── cache/            # Cached images keyed by SHA-256 hash
  │   ├── <hash>        # Cached image file
  │   └── <hash>.metadata  # JSON metadata for cache entry
  ├── logs/             # Execution logs
  │   ├── main.log      # Main execution log (JSON lines)
  │   └── jobs/         # Per-job logs for batch processing
  └── version-check     # Timestamp of last version check (epoch seconds)
```

- Directory permissions: `700` (owner-only, contains API keys)
- Created automatically on first run
- Configurable via `TEXT_TO_IMAGE_CONFIG_DIR` environment variable

**DM-2: Cache metadata format**

```json
{
  "cache_key": "<sha256-hash>",
  "timestamp": "2026-03-07T12:00:00Z",
  "provider": "openai",
  "model": "dall-e-3",
  "prompt": "...",
  "negative_prompt": "",
  "width": 1024,
  "height": 1024,
  "quality": "high"
}
```

**DM-3: JSON output format (single image)**

```json
{"status": "success", "output": "/path/to/image.png"}
```

**DM-4: JSON output format (model listing)**

```json
[
  {
    "provider": "openai",
    "model": "dall-e-3",
    "name": "DALL-E 3",
    "description": "...",
    "quality": "high",
    "cost": "~$0.040",
    "limitations": "..."
  }
]
```

### 8.4 External Integrations

| ID | Provider | API Endpoint | Auth Mechanism | Env Var |
|----|----------|-------------|----------------|---------|
| EXT-1 | OpenAI DALL-E | `api.openai.com/v1/images/generations` | Bearer token | `OPENAI_API_KEY` |
| EXT-2 | Stability AI | `api.stability.ai/v1/generation/*/text-to-image` | Bearer token | `STABILITY_API_KEY` |
| EXT-3 | Google Imagen | `*-aiplatform.googleapis.com/v1/projects/*/locations/*/publishers/google/models/*:predict` | OAuth2 / API key | `GOOGLE_CREDENTIALS`, `GOOGLE_API_KEY`, or gcloud CLI |
| EXT-4 | Hugging Face | `api-inference.huggingface.co/models/*` | Bearer token | `HF_API_KEY` |
| EXT-5 | Black Forest Labs | `api.blackforestlabs.ai/v1/images/generate` | Bearer token | `BFL_API_KEY` |
| EXT-6 | Replicate | `api.replicate.com/v1/predictions` | Bearer token | `REPLICATE_API_TOKEN` |
| EXT-7 | SiliconFlow | `api.siliconflow.cn/v1/images/generations` | Bearer token | `SILICONFLOW_API_KEY` |

### 8.5 Backward Compatibility

_Not applicable — this is a new tool with no prior version._

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Startup | Tool must start and display `--help` in under 200ms | p99 < 200ms |
| NFR-2 | Cache hit | Cached image retrieval must complete in under 100ms | p99 < 100ms |
| NFR-3 | API timeout | Individual provider API calls must time out after 60s (Google Imagen: 120s) | Hard limit |
| NFR-4 | Retry | Failed API calls retry up to 3 times with exponential backoff | 3 retries max |
| NFR-5 | Security | Config directory permissions must be `700` (owner-only) | Enforced on creation |
| NFR-6 | Security | API keys must never appear in log output (sanitized to first 8 chars + `…****`) | All log levels |
| NFR-7 | Portability | Must work on Bash 4.0+ (Linux and macOS) | Tested on both |
| NFR-8 | Dependencies | Only `bash` and `curl` are required; `jq`, `yq`, `exiftool` are optional with graceful fallbacks | Startup check |
| NFR-9 | Isolation | Version check must never block execution or produce user-visible errors on failure | Silent discard |
| NFR-10 | Cache size | Cache cleanup triggers when size exceeds 100MB (configurable via `CACHE_MAX_SIZE_MB`) | Automatic |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

| ID | Requirement | Detail |
|----|-------------|--------|
| TEL-1 | Structured logging | All log entries include `[LEVEL]` prefix and `(text-to-image)` context tag per `.ai/rules/bash.md` |
| TEL-2 | JSON log files | `~/.ai/text-to-image/logs/main.log` stores JSON-line entries with timestamp, level, and message |
| TEL-3 | Per-job logs | Batch processing creates per-job log files under `logs/jobs/` for individual troubleshooting |
| TEL-4 | Verbose mode | `--verbose` / `-v` enables `[DEBUG]` level output to stderr |
| TEL-5 | Dry-run tracing | `--dry-run` logs the exact API calls that would be made, with sanitized credentials |

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Private project references leak into committed files | H | M | Systematic search-and-replace during porting; reviewer checklist item; grep for known private project identifiers before merge | L |
| RSK-2 | Google Imagen auth complexity (3 methods) causes user confusion | M | M | Per-method documentation with clear prerequisites; auto-detection with `--google-auth-method auto` as default; error messages link to specific doc section | L |
| RSK-3 | Provider API changes break integration | M | L | Each provider is isolated in its own function; integration tests detect breakage; retry logic handles transient failures | L |
| RSK-4 | Large script size (~2100 lines) makes review difficult | M | M | Structured sections per `.ai/rules/bash.md`; unit tests for individual functions; code review focuses on section at a time | L |
| RSK-5 | Test adaptation from private project naming/paths fails | L | M | Tests are rewritten to use ADOS conventions; fixtures are self-contained in temp directories | L |
| RSK-6 | Cache key collisions produce wrong images | H | L | SHA-256 hash of all generation parameters (prompt, dimensions, quality, provider, model); metadata verification on cache hit | L |

## 12. ASSUMPTIONS

| ID | Assumption |
|----|-----------|
| A-1 | The source script's 7-provider support is sufficient for initial release; no new providers are needed. |
| A-2 | Users have at least one provider API key configured before using the tool. |
| A-3 | The `doc/guides/tools-convention.md` document (already written) accurately reflects the desired standards. |
| A-4 | GH-27 (AGENTS.md) is merged and the branch is based on it. |
| A-5 | The tool name is `text-to-image` (not `text-to-img` as in the source). |
| A-6 | The config directory is `~/.ai/text-to-image/` (matching the tool name). |

## 13. DEPENDENCIES

| ID | Dependency | Type | Status |
|----|-----------|------|--------|
| DEP-1 | GH-27 (AGENTS.md) | Internal | Merged (PR #28) |
| DEP-2 | `.opencode/agent/image-generator.md` | Internal | Exists, to be tuned |
| DEP-3 | `.ai/rules/bash.md` | Internal | Exists, defines coding standards |
| DEP-4 | `doc/guides/tools-convention.md` | Internal | Exists, defines tool standards |
| DEP-5 | Source script (~2100 lines, private project) | External | Available for porting |
| DEP-6 | 7 external provider APIs | External | Available (API key required) |

## 14. OPEN QUESTIONS

| ID | Question | Context | Owner |
|----|----------|---------|-------|
| OQ-1 | Should the tool support a `--config` flag for YAML batch files in v1.0.0, or defer batch processing to a later minor release? | The source supports it, but it adds complexity. Decision: include it — the source is battle-tested. | @pm |
| OQ-2 | Should the version check fetch the full script file or a smaller metadata endpoint? | Current approach fetches the raw script and greps for `APP_VERSION`. This downloads ~2100 lines for a version string. Consider a dedicated version file. | @architect |
| OQ-3 | What is the appropriate cache eviction strategy beyond size limit? | Current: remove oldest files when cache exceeds 100MB. Consider TTL-based eviction. | @pm |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | Tool name is `text-to-image` (not `text-to-img`) | Consistent with ADOS naming convention; clarity over brevity | 2026-03-06 |
| DEC-2 | Config directory is `~/.ai/text-to-image/` | Matches tool name per `doc/guides/tools-convention.md` | 2026-03-06 |
| DEC-3 | Tools are standalone, agent-agnostic CLI utilities | No coupling to any AI coding tool framework (OpenCode, Claude Code, etc.) | 2026-03-06 |
| DEC-4 | `doc/guides/tools-convention.md` written by PM before spec | Convention needed to be established before the first tool is built | 2026-03-06 |
| DEC-5 | Include batch processing in v1.0.0 | Source implementation is battle-tested; deferring would reduce utility | 2026-03-07 |
| DEC-6 | All 7 providers included in initial release | Proven implementations from source; no reason to exclude any | 2026-03-07 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Change Type | Description |
|-----------|------------|-------------|
| `tools/text-to-image` | New | CLI tool — ported, adapted, and published |
| `tools/.tests/test-text-to-image-unit.sh` | New | Unit tests for the tool |
| `tools/.tests/test-text-to-image-integration.sh` | New | Integration tests for the tool |
| `tools/.tests/test-text-to-image-performance.sh` | New | Performance tests for the tool |
| `doc/tools/text-to-image.md` | New | User documentation with per-provider setup guides |
| `.opencode/agent/image-generator.md` | Modified | Tuned for model discovery and task-based routing |
| `scripts/add-header-location.sh` | Modified | Enhanced to support bash script license headers |
| `AGENTS.md` | Modified | Key References updated with new doc links |

## 17. ACCEPTANCE CRITERIA

**AC-F1-1**: Given the tool is installed, when the user runs `tools/text-to-image --help`, then the output includes tool name, version, usage syntax, basic examples, options reference, documentation link, and license information, and exits with code 0. _(References: F-1, F-8)_

**AC-F1-2**: Given the tool is installed, when the user runs `tools/text-to-image --version`, then the output includes tool name, version, copyright, MIT license reference, and latest-version URL, and exits with code 0. _(References: F-1)_

**AC-F1-3**: Given a valid prompt and output path, when the user runs `tools/text-to-image --dry-run --prompt "test" --output test.png`, then the tool shows what API call would be made without executing it, and exits with code 0. _(References: F-1, F-8)_

**AC-F4-1**: Given at least one provider API key is configured, when the user runs `tools/text-to-image --list-models`, then the tool displays available models for configured providers and exits with code 0. _(References: F-4)_

**AC-F4-2**: Given any configuration state, when the user runs `tools/text-to-image --list-models --output-format json`, then the output is valid JSON containing an array of model objects with provider, model, name, description, quality, cost, and limitations fields. _(References: F-4, F-12)_

**AC-F9-1**: Given the tool has not checked for updates in the last 24 hours, when the user runs any command, then the tool checks for a newer version on GitHub, warns to stderr if outdated, and does not block execution. _(References: F-9)_

**AC-F9-2**: Given `TEXT_TO_IMAGE_NO_VERSION_CHECK=true` is set, when the user runs any command, then no version check is performed. _(References: F-9)_

**AC-F9-3**: Given the version check fails (network error, parse error, timeout), when the user runs any command, then the failure is silently discarded with no user-visible error. _(References: F-9)_

**AC-F10-1**: Given a provider is not configured, when the user specifies that provider via `--provider`, then the error message includes a direct URL to the provider's setup section in `doc/tools/text-to-image.md` on GitHub. _(References: F-10)_

**AC-F11-1**: Given Google service account JSON credentials are configured via `GOOGLE_CREDENTIALS`, when the user runs with `--provider google`, then the tool authenticates using JWT-based OAuth2 and generates an image. _(References: F-11)_

**AC-DM1-1**: Given the tool is run for the first time, when the config directory does not exist, then the tool creates `~/.ai/text-to-image/` with permissions `700`. _(References: DM-1, NFR-5)_

**AC-NFR6-1**: Given verbose mode is enabled, when API calls are logged, then API keys are sanitized to first 8 characters followed by `…****`. _(References: NFR-6)_

**AC-TEST-1**: Given the test suite is available, when the user runs `bash tools/.tests/test-text-to-image-unit.sh`, then all unit tests pass. _(References: F-1 through F-12)_

**AC-TEST-2**: Given provider API keys are configured, when the user runs `bash tools/.tests/test-text-to-image-integration.sh`, then integration tests pass for configured providers. _(References: F-1, F-3, F-11)_

**AC-TEST-3**: Given the test suite is available, when the user runs `bash tools/.tests/test-text-to-image-performance.sh`, then performance tests pass (startup < 200ms, cache hit < 100ms). _(References: NFR-1, NFR-2)_

**AC-DOC-1**: Given the documentation exists, when a user reads `doc/tools/text-to-image.md`, then each of the 7 providers has a dedicated section with stable heading (producing deterministic GitHub anchor URLs), sign-up URL, API key console URL, environment variable name, gotchas, and approximate pricing. _(References: F-10)_

**AC-DOC-2**: Given the documentation exists, then it displays the current version near the top linking to the changelog subsection, and the changelog contains versioned subsections. _(References: F-9)_

**AC-AGENT-1**: Given the `@image-generator` agent prompt is updated, when the agent needs to generate an image, then it first runs `--list-models --output-format json` to discover available models and selects an appropriate model based on task type. _(References: F-4, F-12)_

**AC-HEADER-1**: Given `scripts/add-header-location.sh` is enhanced, when the script processes a file with `.sh` extension, then it adds the MIT license header as bash comments. _(References: G-5)_

**AC-HEADER-2**: Given `scripts/add-header-location.sh` is enhanced, when the script processes a file with a `#!/usr/bin/env bash` or `#!/bin/bash` shebang (regardless of extension), then it adds the MIT license header as bash comments after the shebang line. _(References: G-5)_

**AC-AGENTS-1**: Given `AGENTS.md` is updated, then the Key References table includes entries for `doc/tools/text-to-image.md` and `doc/guides/tools-convention.md`. _(References: G-6)_

**AC-CLEAN-1**: Given all files are committed, when searching the entire repository for the private source project name, then zero matches are found. _(References: RSK-1)_

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

- **Phase 1**: Tool implementation, tests, and documentation are delivered on the feature branch `feat/GH-26/text-to-img-toolbox`.
- **Phase 2**: Code review focuses on: (a) no private project references, (b) tools convention compliance, (c) all 7 providers functional.
- **Phase 3**: Merge to main. The tool becomes immediately available to all users and the `@image-generator` agent.
- **Communication**: Update the GitHub issue GH-26 with the PR link. No external communication required — this is an internal capability enablement.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

_Not applicable — no data migration needed. The tool creates its config directory on first run._

## 20. PRIVACY / COMPLIANCE REVIEW

- API keys are stored in the user's home directory (`~/.ai/text-to-image/.env`) with `700` permissions.
- API keys are sanitized in all log output (first 8 chars + mask).
- Image prompts are cached locally; no telemetry is sent to external services beyond the provider API calls.
- No personally identifiable information (PII) is collected or stored.
- The tool operates entirely client-side; there is no server component.

## 21. SECURITY REVIEW HIGHLIGHTS

| Concern | Mitigation |
|---------|-----------|
| API key exposure in logs | Sanitized via `sanitize_token()` — first 8 chars + `…****` (NFR-6) |
| API key exposure in process list | Keys passed via `-H` headers in curl, not as URL parameters |
| Config directory permissions | Created with `chmod 700` on first run (NFR-5) |
| Untrusted YAML config | Parsed via `yq` with fallback to simple key-value; no `eval` of untrusted input beyond shell-escaped values |
| Network request to GitHub for version check | Silent failure on any error; never blocks; opt-out available (NFR-9) |
| Source `.env` file | Only sourced from `~/.ai/text-to-image/.env` (known, user-controlled path) |

## 22. MAINTENANCE & OPERATIONS IMPACT

- **Cache management**: Automatic cleanup when cache exceeds 100MB. Users can manually clear `~/.ai/text-to-image/cache/`.
- **Log rotation**: Not automated; users manage `~/.ai/text-to-image/logs/` manually. Consider adding log rotation in a future minor release.
- **Version updates**: Users are notified of new versions via automatic check. Update is manual (re-clone or copy the script).
- **Provider API changes**: Each provider is isolated in its own function. API changes require updating only the affected function.

## 23. GLOSSARY

| Term | Definition |
|------|-----------|
| Provider | An external AI image generation service (e.g., OpenAI, Stability AI) |
| Quality profile | A setting (high/medium/low) that determines provider selection priority |
| Cache key | SHA-256 hash of generation parameters used to identify cached images |
| Sidecar file | A `.metadata` JSON file created alongside an image when exiftool is unavailable |
| Version check | Automatic comparison of local tool version with latest on GitHub |
| Tools convention | The standard defined in `doc/guides/tools-convention.md` for building CLI tools |

## 24. APPENDICES

### Appendix A: Supported Providers and Models

| Provider | Default Model | Additional Models | Auth Env Var |
|----------|--------------|-------------------|-------------|
| OpenAI | dall-e-3 | dall-e-2 | `OPENAI_API_KEY` |
| Stability AI | stable-diffusion-v1-6 | stable-diffusion-3-medium, SDXL | `STABILITY_API_KEY` |
| Google Imagen | imagen-4.0-generate-001 | imagen-4.0-ultra-generate-001, imagen-4.0-fast-generate-001, imagen-3.0-generate-001, imagegeneration | `GOOGLE_CREDENTIALS` / `GOOGLE_API_KEY` / gcloud |
| Hugging Face | stabilityai/stable-diffusion-2-1 | Any HF-hosted model via `HF_MODEL` | `HF_API_KEY` |
| Black Forest Labs | flux-1.1-pro | flux-1.0-pro | `BFL_API_KEY` |
| Replicate | stability-ai/sdxl | Any Replicate model via `REPLICATE_MODEL` | `REPLICATE_API_TOKEN` |
| SiliconFlow | stabilityai/stable-diffusion-3-medium | stabilityai/stable-diffusion-xl-1.0 | `SILICONFLOW_API_KEY` |

### Appendix B: Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid parameters |
| 3 | Authentication failed |
| 4 | Rate limit exceeded |
| 5 | Server error |
| 6 | Network error |
| 7 | File system error |
| 8 | Config error |
| 9 | Batch partial failure |
| 100 | Unknown error |

### Appendix C: Quality Profile Chains

| Profile | Provider Chain |
|---------|---------------|
| high | OpenAI → Stability AI → Google Imagen |
| medium | Stability AI → OpenAI → Replicate |
| low | Hugging Face → Stability AI → SiliconFlow |

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-07 | @spec-writer | Initial specification |

---

## AUTHORING GUIDELINES

- This specification uses only information from the planning session and existing repository documentation.
- Functional capabilities describe _what_ the system must do, not _how_ it is implemented.
- Acceptance Criteria use Given/When/Then format and reference at least one capability or requirement ID.
- NFRs include measurable thresholds.
- Risks include Impact and Probability ratings with mitigations.
- No file paths, code snippets, or implementation tasks appear in the body of this spec.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided workItemRef (GH-26)
- [x] `change.status` is "Proposed"
- [x] `owners` has at least one entry
- [x] All sections present in correct order per spec structure
- [x] ID prefixes (F-, DM-, NFR-, AC-, DEC-, RSK-, OQ-) are consistent and unique within category
- [x] Acceptance Criteria reference at least one ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact and Probability
- [x] No implementation tasks, file paths, or code-level instructions in spec body
- [x] No references to private source project
