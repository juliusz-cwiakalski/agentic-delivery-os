---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-text-to-image-tool.md

id: SPEC-TEXT-TO-IMAGE-TOOL
status: Current
created: 2026-03-07
last_updated: 2026-03-07
owners: [Juliusz Ćwiąkalski]
service: tools
links:
  related_changes: ["GH-26"]
  guides:
    - "doc/tools/text-to-image.md"
    - "doc/guides/tools-convention.md"
summary: "Standalone CLI tool for AI image generation from text prompts, supporting 7 providers with quality-based selection, caching, batch processing, and machine-readable output."
---

# Feature: text-to-image CLI Tool

## Overview

`tools/text-to-image` is a standalone, agent-agnostic CLI tool that generates images from text prompts using seven AI image-generation providers. It provides a unified interface with quality-based provider selection, response caching, batch processing, metadata embedding, and machine-readable JSON output.

The tool follows the `tools/` convention defined in `doc/guides/tools-convention.md`. It is the first tool published in the `tools/` directory and establishes the pattern for future CLI utilities.

## Supported Providers

| Provider | Default Model | Auth Env Var |
|----------|--------------|-------------|
| OpenAI | dall-e-3 | `OPENAI_API_KEY` |
| Stability AI | stable-diffusion-xl-1024-v1-0 | `STABILITY_API_KEY` |
| Google Imagen | imagen-4.0-generate-001 | `GOOGLE_CREDENTIALS` / `GOOGLE_API_KEY` / gcloud |
| Hugging Face | stabilityai/stable-diffusion-2-1 | `HF_API_KEY` |
| Black Forest Labs | flux-1.1-pro | `BFL_API_KEY` |
| Replicate | stability-ai/sdxl | `REPLICATE_API_TOKEN` |
| SiliconFlow | stabilityai/stable-diffusion-3-medium | `SILICONFLOW_API_KEY` |

## Functional Capabilities

### Single Image Generation (F-1)

The tool generates one image from a text prompt using a selected or auto-selected provider and model. Users specify `--prompt` and `--output`; optional flags control provider, model, quality, dimensions, and negative prompts.

### Multi-Model Comparison (F-2)

The `--models` flag accepts a comma-separated list of models. The tool generates the same prompt across all specified models simultaneously, producing model-suffixed output files (e.g., `output-dall-e-3.png`, `output-flux-1.1-pro.png`).

### Quality-Based Provider Selection (F-3)

When no provider is explicitly specified, the tool selects the best available provider based on a quality profile and configured API keys:

| Profile | Provider Chain |
|---------|---------------|
| high (default) | OpenAI → Stability AI → Google Imagen |
| medium | Stability AI → OpenAI → Replicate |
| low | Hugging Face → Stability AI → SiliconFlow |

### Model Discovery (F-4)

`--list-models` shows models for providers with configured API keys. `--all-models` shows all known models regardless of configuration. Both support `--output-format json` for machine parsing by agents and scripts.

### Response Caching (F-5)

Generated images are cached by SHA-256 hash of generation parameters (prompt, dimensions, quality, provider, model). Cache hits return in under 100ms. The `--force` flag bypasses the cache. Automatic cleanup triggers when cache size exceeds 100MB (configurable via `CACHE_MAX_SIZE_MB`).

### Batch Processing (F-6)

A YAML configuration file (`--config`) defines multiple image generation jobs. Jobs run sequentially by default or in parallel with `--parallel` (concurrency controlled via `--max-parallel`).

### Metadata Embedding (F-7)

When `--metadata` is specified, the tool embeds EXIF/XMP metadata (artist, copyright, keywords, description, prompt) in generated images via exiftool. When exiftool is unavailable, a `.metadata` JSON sidecar file is created instead.

### Dry-Run Simulation (F-8)

`--dry-run` validates the command structure and shows what API calls would be made without executing them. API keys are sanitized in dry-run output.

### Automatic Version Check (F-9)

On each invocation, the tool checks for a newer version on GitHub (no more than once per 24 hours). If outdated, a non-blocking warning is printed to stderr. Opt-out via `TEXT_TO_IMAGE_NO_VERSION_CHECK=true`. Check failures are silently discarded.

### Documentation-Linked Error Messages (F-10)

When a provider is not configured, the error message includes a direct URL to that provider's setup section in `doc/tools/text-to-image.md` on GitHub. Each provider heading produces a deterministic anchor URL.

### Google Imagen Multi-Auth (F-11)

Three authentication methods are supported for Google Imagen via Vertex AI, with automatic detection:

1. **Service account JSON** (production) — JWT-based OAuth2 via `GOOGLE_CREDENTIALS`
2. **gcloud CLI** (development) — automatic token via authenticated gcloud
3. **API key** (legacy) — via `GOOGLE_API_KEY`

Auto-detection priority follows the order above. Override via `--google-auth-method`.

### Machine-Readable Output (F-12)

`--output-format json` produces JSON output for all operations (generation results, errors, model listing), enabling programmatic consumption by agents and scripts.

## Non-Functional Requirements

| ID | Category | Requirement | Threshold |
|----|----------|-------------|-----------|
| NFR-1 | Startup | `--help` displays in under 200ms | p99 < 200ms |
| NFR-2 | Cache hit | Cached image retrieval under 100ms | p99 < 100ms |
| NFR-3 | API timeout | Provider API calls time out after 60s (Google: 120s) | Hard limit |
| NFR-4 | Retry | Failed API calls retry up to 3 times with exponential backoff | 3 retries max |
| NFR-5 | Security | Config directory permissions `700` (owner-only) | Enforced on creation |
| NFR-6 | Security | API keys sanitized in all log output (first 8 chars + `…****`) | All log levels |
| NFR-7 | Portability | Bash 4.0+ (Linux and macOS) | Tested on both |
| NFR-8 | Dependencies | Only `bash` and `curl` required; `jq`, `yq`, `exiftool` optional with fallbacks | Startup check |
| NFR-9 | Isolation | Version check never blocks execution or produces user-visible errors on failure | Silent discard |
| NFR-10 | Cache size | Cache cleanup when exceeding 100MB (configurable) | Automatic |

## Configuration

The tool stores configuration, cache, and logs in `~/.ai/text-to-image/`:

```
~/.ai/text-to-image/
  ├── .env              # API keys and environment overrides
  ├── cache/            # Cached images keyed by SHA-256 hash
  ├── logs/             # Execution logs (JSON lines)
  │   └── jobs/         # Per-job logs for batch processing
  └── version-check     # Timestamp of last version check
```

Created automatically on first run with permissions `700`. Location overridable via `TEXT_TO_IMAGE_CONFIG_DIR`.

## Exit Codes

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

## Integration with Agents

The `@image-generator` agent uses the tool for image generation. The agent workflow is:

1. Run `tools/text-to-image --list-models --output-format json` to discover available providers and models
2. Select an appropriate model based on task type and available providers
3. Invoke the tool with the selected provider/model and `--output-format json`
4. Parse JSON response for status and output path

## Related Documentation

- **User guide**: [doc/tools/text-to-image.md](../../tools/text-to-image.md) — per-provider setup, usage examples, troubleshooting
- **Tools convention**: [doc/guides/tools-convention.md](../../guides/tools-convention.md) — standard for building CLI tools
- **Tests**: `tools/.tests/test-text-to-image-{unit,integration,performance}.sh` — 81 automated tests
