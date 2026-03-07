---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/quality/test-specs/test-spec-text-to-image-tool.md

id: TEST-SPEC-TEXT-TO-IMAGE-TOOL
status: Current
created: 2026-03-07
last_updated: 2026-03-07
owners: [Juliusz Ćwiąkalski]
service: tools
links:
  related_changes: ["GH-26"]
  feature_spec: "doc/spec/features/feature-text-to-image-tool.md"
summary: "Test specification for the text-to-image CLI tool — 81 automated tests across unit, integration, and performance suites."
---

# Test Specification: text-to-image CLI Tool

## 1. Testing Strategy

All bash testing follows `.ai/rules/bash.md` sections 10-12:

- **Embedded test framework** — no external test runner dependencies
- **Mockable wrappers** for external commands (`_curl()`, `_jq()`, `_exiftool()`)
- **Testable main guard** for sourcing scripts under test
- **Dependency injection** via environment variables
- **Temp directories** for isolation; cleanup in EXIT trap
- **Mock API keys** — never real credentials in tests

## 2. Test Suites

| Suite | File | Tests | Scope |
|-------|------|-------|-------|
| Unit | `tools/.tests/test-text-to-image-unit.sh` | 52 | Pure functions, mocked externals, validation, config parsing |
| Integration | `tools/.tests/test-text-to-image-integration.sh` | 21 | End-to-end flows with mocked curl, provider interactions, batch |
| Performance | `tools/.tests/test-text-to-image-performance.sh` | 8 | Timing, cache performance, parallel batch, rate limiting |

### Running Tests

```bash
bash tools/.tests/test-text-to-image-unit.sh
bash tools/.tests/test-text-to-image-integration.sh
bash tools/.tests/test-text-to-image-performance.sh
```

## 3. Coverage by Functional Capability

| Capability | Description | Test Coverage |
|-----------|-------------|---------------|
| F-1 | Single image generation | `--help`, `--version`, `--dry-run` convention compliance; mocked generation flow |
| F-2 | Multi-model comparison | Model-suffixed output files; separate cache keys per model |
| F-3 | Quality-based provider selection | High/medium/low profile chains; fallback when primary unavailable; error when no providers configured |
| F-4 | Model discovery | `--list-models` for configured providers; `--all-models` for all; JSON output validation; Imagen 4 variants |
| F-5 | Response caching | Deterministic cache keys; store and lookup; cache miss; force bypass |
| F-6 | Batch processing | Sequential and parallel execution; large batch (10 jobs) |
| F-7 | Metadata embedding | EXIF with exiftool; JSON sidecar fallback without exiftool |
| F-8 | Dry-run simulation | API call display without execution; sanitized credentials in output |
| F-9 | Version check | 24h cache expiry; opt-out via env var; silent failure on network error |
| F-10 | Doc-linked errors | URL in unconfigured provider error; anchors match 7 provider headings |
| F-11 | Google multi-auth | API key auth; service account JWT (mocked token); gcloud detection; token caching; missing credentials error; aspect ratio mapping; model validation |
| F-12 | Machine-readable output | JSON format for generation results and errors |

## 4. Coverage by Non-Functional Requirement

| NFR | Description | Test Coverage |
|-----|-------------|---------------|
| NFR-1 | Startup < 200ms | Performance suite: `--help` timing (3 runs, max < 200ms) |
| NFR-2 | Cache hit < 100ms | Performance suite: cache hit retrieval timing |
| NFR-3 | API timeout 60s/120s | Unit: timeout enforcement on hung provider |
| NFR-4 | Retry with backoff | Unit: retry on HTTP 500; Performance: rate limit (HTTP 429) backoff |
| NFR-5 | Config dir `700` | Unit: directory creation and permission verification |
| NFR-6 | API key sanitization | Unit: `sanitize_token()` — long tokens, empty tokens, short tokens |
| NFR-7 | Bash 4.0+ | Manual: strict mode settings verification |
| NFR-8 | Optional dependencies | Unit: graceful fallback without yq |
| NFR-9 | Version check non-blocking | Unit: silent failure on network error |
| NFR-10 | Cache size cleanup | Performance: Google auth token caching |

## 5. Provider Integration Coverage

Each provider has a mocked end-to-end integration test verifying the full generation flow:

| Provider | Test | Notes |
|----------|------|-------|
| OpenAI | Mocked DALL-E generation | URL-based image download |
| Stability AI | Mocked SD generation | Binary response handling |
| Google Imagen | Mocked Vertex AI prediction | API key auth, service account JWT auth, API URL construction, aspect ratio mapping |
| Hugging Face | Mocked Inference API | Binary response |
| Black Forest Labs | Mocked FLUX generation | Async polling pattern |
| Replicate | Mocked predictions API | Async polling pattern |
| SiliconFlow | Mocked generation | OpenAI-compatible response format |

## 6. Negative and Edge Case Coverage

| Category | Scenarios |
|----------|-----------|
| Input validation | Empty prompt, invalid quality, invalid dimensions, invalid provider name, invalid model name |
| Provider errors | No providers configured (exit code 3), provider fallback chain |
| Authentication | Google missing credentials (exit code 3), API key sanitization |
| Network | Version check silent failure, retry on HTTP 500 |
| Rate limiting | HTTP 429 with backoff, max retries exhausted |
| Cache | Cache miss triggers API call, force regeneration bypasses cache |
| Dependencies | Fallback parsing without yq, sidecar fallback without exiftool |

## 7. Mocking Strategy

| External Command | Wrapper | Mock Technique |
|-----------------|---------|----------------|
| `curl` | `_curl()` | Override function in test to return fixture data |
| `jq` | `_jq()` | Override via `JQ_CMD` env var or function |
| `yq` | Via `command -v` | Remove from PATH to test fallback |
| `exiftool` | Via `command -v` | Remove from PATH to test sidecar fallback |
| `openssl` | Direct call | Real calls for test RSA key generation |
| `gcloud` | Via `command -v` | Remove from PATH to test detection |

## 8. Test Data

- **API keys**: Mock values (e.g., `sk-mock123`, `mock-google-key`)
- **Image data**: String `"mock image data"` or base64-encoded `"bW9jayBpbWFnZQ=="`
- **API responses**: Inline JSON matching provider response formats
- **Config files**: Created in `mktemp -d` temp directories, cleaned up in EXIT trap
- **RSA keys**: Generated on-the-fly via `openssl genrsa 2048` for Google service account tests
- **Batch jobs**: Inline JSON arrays with temp directory output paths

## 9. Related Test Specifications

- **License header script tests**: `scripts/.tests/test-add-header-location.sh` (18 tests) — covers bash file detection, header insertion, idempotency, and directory processing for both `.md` and bash files
