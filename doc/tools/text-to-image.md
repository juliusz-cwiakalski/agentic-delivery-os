---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/tools/text-to-image.md
---

# text-to-image User Guide

> Version 1.0.0 | [Changelog](#100-2026-03-07)

<!-- TOC -->
* [text-to-image User Guide](#text-to-image-user-guide)
  * [Overview](#overview)
  * [Requirements](#requirements)
  * [Installation](#installation)
  * [Provider Setup](#provider-setup)
    * [OpenAI](#openai)
    * [Stability AI](#stability-ai)
    * [Google Imagen](#google-imagen)
    * [Hugging Face](#hugging-face)
    * [Black Forest Labs](#black-forest-labs)
    * [Replicate](#replicate)
    * [SiliconFlow](#siliconflow)
  * [Usage Examples](#usage-examples)
    * [Single image generation](#single-image-generation)
    * [Specify provider and model](#specify-provider-and-model)
    * [Quality profiles](#quality-profiles)
    * [Custom dimensions](#custom-dimensions)
    * [Output formats](#output-formats)
    * [Negative prompts](#negative-prompts)
    * [Multi-model comparison](#multi-model-comparison)
    * [Batch processing (YAML)](#batch-processing-yaml)
    * [Dry run](#dry-run)
    * [Metadata embedding](#metadata-embedding)
    * [JSON output (for agents and scripts)](#json-output-for-agents-and-scripts)
    * [Model discovery](#model-discovery)
    * [Google Imagen with specific auth method](#google-imagen-with-specific-auth-method)
  * [Configuration](#configuration)
    * [Configuration directory](#configuration-directory)
    * [`.env` file](#env-file)
    * [Environment variable overrides](#environment-variable-overrides)
    * [Caching](#caching)
    * [YAML sidecar metadata](#yaml-sidecar-metadata)
      * [Debugging with sidecars](#debugging-with-sidecars)
  * [Troubleshooting](#troubleshooting)
    * [Common errors](#common-errors)
    * [Debugging](#debugging)
    * [Version check](#version-check)
  * [CLI Reference](#cli-reference)
  * [Changelog](#changelog)
    * [1.0.0 (2026-03-07)](#100-2026-03-07)
<!-- TOC -->

## Overview

`text-to-image` is a standalone, agent-agnostic CLI tool that generates images from text prompts using seven AI image-generation providers. It provides a unified interface with quality-based provider selection, response caching, batch processing, metadata embedding, and machine-readable JSON output.

Supported providers:

| Provider | Default Model | Auth Env Var |
|----------|--------------|-------------|
| OpenAI | dall-e-3 | `OPENAI_API_KEY` |
| Stability AI | stable-diffusion-xl-1024-v1-0 | `STABILITY_API_KEY` |
| Google Imagen | imagen-4.0-generate-001 | `GOOGLE_CREDENTIALS` / `GOOGLE_API_KEY` / gcloud |
| Hugging Face | stabilityai/stable-diffusion-2-1 | `HF_API_KEY` |
| Black Forest Labs | flux-1.1-pro | `BFL_API_KEY` |
| Replicate | stability-ai/sdxl | `REPLICATE_API_TOKEN` |
| SiliconFlow | stabilityai/stable-diffusion-3-medium | `SILICONFLOW_API_KEY` |

The tool is designed to be invoked by humans, shell scripts, CI/CD pipelines, and AI coding agents alike — it has no dependency on any specific AI tool framework.

## Requirements

**Required:**

- **Bash** 4.0 or higher
- **curl** for HTTP requests to provider APIs

**Optional (with fallbacks):**

- **jq** — JSON processing (fallback to basic parsing via grep/sed)
- **yq** — YAML parsing for batch config files (fallback to key-value parsing)
- **exiftool** — EXIF/XMP metadata embedding (fallback to `.metadata` JSON sidecar files)
- **sha256sum** or **shasum** — cache key generation (fallback to `cksum`)
- **openssl** — required for Google service account JWT-based authentication

## Installation

1. Clone the repository (or copy the tool file):

```bash
git clone https://github.com/juliusz-cwiakalski/agentic-delivery-os.git
```

2. The tool is already executable. Verify:

```bash
tools/text-to-image --version
```

3. Optionally, add `tools/` to your PATH for convenience:

```bash
export PATH="$PATH:/path/to/agentic-delivery-os/tools"
text-to-image --version
```

4. On first run, the tool creates `~/.ai/text-to-image/` (permissions `700`) for configuration, cache, and logs.

## Provider Setup

Configure at least one provider by setting the appropriate environment variable. You can set variables in your shell profile or in `~/.ai/text-to-image/.env`.

### OpenAI

**Sign up:** [platform.openai.com](https://platform.openai.com/)

**Get API key:** [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

**Environment variable:**

```bash
export OPENAI_API_KEY="sk-your-openai-key"
```

**Models:**

| Model ID | Name | Quality | Cost | Notes |
|----------|------|---------|------|-------|
| `dall-e-3` | DALL-E 3 (default) | High | ~$0.040/img | 1024x1024 max, no negative prompt support |
| `dall-e-2` | DALL-E 2 | Medium | ~$0.020/img | 512x512 max, lower quality than DALL-E 3 |

**Gotchas:**

- OpenAI enforces content policy — prompts with prohibited content are rejected
- DALL-E 3 does not support `--negative-prompt`; it rewrites prompts internally
- Maximum resolution is 1024x1024 for DALL-E 3 (standard), 1792x1024 or 1024x1792 (wide/tall)
- Billing is per-image, not per-pixel

### Stability AI

**Sign up:** [platform.stability.ai](https://platform.stability.ai/)

**Get API key:** [platform.stability.ai/account/keys](https://platform.stability.ai/account/keys)

**Environment variable:**

```bash
export STABILITY_API_KEY="sk-your-stability-key"
```

**Models (v1 API — legacy engines):**

| Model ID | Name | Quality | Cost | Notes |
|----------|------|---------|------|-------|
| `stable-diffusion-xl-1024-v1-0` | SDXL 1024 (default) | High | ~$0.004/img | Legacy, optimal at 1024x1024 |

> **Note:** Stability AI offers newer models (SD3, SD3.5, Stable Image Core, Stable Image Ultra) via their v2beta REST API. Support for v2beta is planned. The models listed above are the only ones available through the current v1 integration.

**Gotchas:**

- Only legacy v1 engine IDs are currently supported; newer models require v2beta API (planned)
- SDXL produces best results at 1024x1024; non-square outputs may have artifacts
- Stability AI credits must be purchased separately from the API key
- Negative prompts are supported and recommended for quality control

### Google Imagen

Google Imagen is accessed via Vertex AI and supports **three authentication methods** with automatic detection.

**Sign up:** [console.cloud.google.com](https://console.cloud.google.com/)

**Enable Vertex AI:** [console.cloud.google.com/vertex-ai](https://console.cloud.google.com/vertex-ai) — you must enable the Vertex AI API and billing for your project.

**Authentication methods (in auto-detection priority order):**

**Method 1: Service Account JSON (recommended for production)**

```bash
export GOOGLE_CREDENTIALS="/path/to/service-account.json"
export GOOGLE_PROJECT_ID="your-google-project-id"   # optional if in JSON file
```

The service account needs the `roles/aiplatform.user` role. Requires `openssl` and `jq` for JWT signing. The tool creates a signed JWT, exchanges it for an OAuth2 access token, and caches the token for 1 hour.

You can also pass the path via CLI flag:

```bash
tools/text-to-image --google-credentials /path/to/service-account.json --provider google --prompt "..." --output img.png
```

**Method 2: gcloud CLI (recommended for development)**

```bash
gcloud auth login
# or: gcloud auth application-default login
export GOOGLE_PROJECT_ID="your-project-id"
```

If the `gcloud` CLI is installed and authenticated, the tool automatically uses it to obtain an access token. No additional configuration needed.

**Method 3: API Key (legacy)**

```bash
export GOOGLE_API_KEY="your-google-api-key"
export GOOGLE_PROJECT_ID="your-google-project-id"
```

**Override auto-detection:**

```bash
tools/text-to-image --google-auth-method gcloud --provider google --prompt "..." --output img.png
```

Valid methods: `auto`, `json`, `service-account`, `gcloud`, `api-key`.

**Models:**

| Model ID | Name | Quality | Cost | Notes |
|----------|------|---------|------|-------|
| `imagen-4.0-generate-001` | Imagen 4 Standard (default) | High | ~$0.040/img | Latest generation |
| `imagen-4.0-ultra-generate-001` | Imagen 4 Ultra | High | ~$0.080/img | Highest quality |
| `imagen-4.0-fast-generate-001` | Imagen 4 Fast | Medium | ~$0.020/img | Faster, lower cost |
| `imagen-3.0-generate-001` | Imagen 3 | High | ~$0.050/img | Previous generation |

**Gotchas:**

- Vertex AI must be enabled and billing must be active on the Google Cloud project
- The `GOOGLE_LOCATION` (default: `us-central1`) must support the Imagen model you choose
- Service account authentication requires `openssl` and `jq` to be installed
- Image generation may be slower than other providers due to Vertex AI overhead (timeout: 120s vs 60s for others)
- Content safety filters are enforced and may reject certain prompts

### Hugging Face

**Sign up:** [huggingface.co/join](https://huggingface.co/join)

**Get token:** [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)

**Environment variable:**

```bash
export HF_API_KEY="hf-your-huggingface-token"
```

**Models:**

| Model ID | Name | Quality | Cost | Notes |
|----------|------|---------|------|-------|
| `stabilityai/stable-diffusion-2-1` | Stable Diffusion 2.1 (default) | Low | Free tier | Rate limited, slower |
| `runwayml/stable-diffusion-v1-5` | Stable Diffusion 1.5 | Low | Free tier | Older but reliable |
| `black-forest-labs/flux-1.1-pro` | FLUX 1.1 Pro | High | ~$0.010/img | Via HF Inference API |

**Custom models:** Use any Hugging Face-hosted model via the `HF_MODEL` environment variable:

```bash
export HF_MODEL="CompVis/stable-diffusion-v1-4"
tools/text-to-image --provider huggingface --prompt "..." --output img.png
```

**Gotchas:**

- Free tier has strict rate limits — expect delays during peak usage
- Inference API models may take 30-60 seconds to cold-start if not recently used
- Some models require a Pro subscription
- Image quality on free-tier models is lower than paid providers

### Black Forest Labs

**Sign up:** [blackforestlabs.ai](https://blackforestlabs.ai/)

**Get API key:** [blackforestlabs.ai/dashboard](https://blackforestlabs.ai/dashboard)

**Environment variable:**

```bash
export BFL_API_KEY="your-bfl-key"
```

**Models:**

| Model ID | Name | Quality | Cost | Notes |
|----------|------|---------|------|-------|
| `flux-1.1-pro` | FLUX 1.1 Pro (default) | High | ~$0.015/img | Fast, high quality |
| `flux-1.0-pro` | FLUX 1.0 Pro | Medium | ~$0.010/img | Previous version |

**Gotchas:**

- BFL API uses an asynchronous generation pattern — the tool polls for completion
- Generation is typically fast (5-15 seconds) for FLUX 1.1 Pro
- API may have limited availability during high-demand periods

### Replicate

**Sign up:** [replicate.com](https://replicate.com/)

**Get token:** [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)

**Environment variable:**

```bash
export REPLICATE_API_TOKEN="your-replicate-token"
```

**Models:**

| Model ID | Name | Quality | Cost | Notes |
|----------|------|---------|------|-------|
| `stability-ai/sdxl` | SDXL (default) | Medium | ~$0.005/img | Per-second billing |
| `black-forest-labs/flux-1.1-pro` | FLUX 1.1 Pro | High | ~$0.020/img | Per-second billing |

**Custom models:** Use any Replicate model via the `REPLICATE_MODEL` environment variable:

```bash
export REPLICATE_MODEL="owner/model-name:version"
tools/text-to-image --provider replicate --prompt "..." --output img.png
```

**Gotchas:**

- Replicate bills per second of GPU compute, not per image — costs can vary
- Models cold-start if not recently used (can add 30-60 seconds)
- Custom model versions must include the full version hash

### SiliconFlow

**Sign up:** [siliconflow.cn](https://siliconflow.cn/)

**Get API key:** [cloud.siliconflow.cn/account/ak](https://cloud.siliconflow.cn/account/ak)

**Environment variable:**

```bash
export SILICONFLOW_API_KEY="your-siliconflow-key"
```

**Models:**

| Model ID | Name | Quality | Cost | Notes |
|----------|------|---------|------|-------|
| `stabilityai/stable-diffusion-3-medium` | SD3 Medium (default) | High | ~$0.003/img | Very cost-effective |
| `stabilityai/stable-diffusion-xl-1.0` | SDXL 1.0 | Medium | ~$0.002/img | Budget option |

**Gotchas:**

- SiliconFlow is a China-based provider — network latency may be higher outside Asia
- API documentation is primarily in Chinese
- Very competitive pricing compared to Western providers

## Usage Examples

### Single image generation

```bash
tools/text-to-image --prompt "sunset over mountains" --output sunset.png
```

### Specify provider and model

```bash
tools/text-to-image --prompt "portrait" --provider openai --model dall-e-3 --output portrait.png
```

### Quality profiles

Quality profiles automatically select the best available provider based on your configured API keys:

```bash
# High quality (default): OpenAI -> Stability -> Google
tools/text-to-image --prompt "product photo" --quality high --output product.png

# Medium quality: Stability -> OpenAI -> Replicate
tools/text-to-image --prompt "illustration" --quality medium --output illustration.png

# Low quality (fastest, cheapest): Hugging Face -> Stability -> SiliconFlow
tools/text-to-image --prompt "quick sketch" --quality low --output sketch.png
```

> **Important: Quality profiles vs. direct model selection**
>
> The built-in quality profiles route to providers based on API key availability, **not** actual model quality. An E2E evaluation of 168 images across 12 use cases showed Google Imagen 4.0 models consistently outperform alternatives (80% avg vs 61% for DALL-E 3 and 23–53% for SDXL). The current fallback chains (`high: OpenAI → Stability → Google`) put weaker models first.
>
> **For best results, specify `--provider` and `--model` directly:**
>
> ```bash
> # Recommended: explicit model selection based on quality data
> tools/text-to-image --prompt "product photo" --provider google --model imagen-4.0-ultra-generate-001 --output product.avif
>
> # Best value: Imagen 4.0 Fast at ~$0.020/img scores 79.4% avg
> tools/text-to-image --prompt "illustration" --provider google --model imagen-4.0-fast-generate-001 --output illustration.avif
> ```
>
> **Recommended models by use case (from E2E evaluation):**
>
> | Use Case | Best Model | Score | Cost |
> |----------|-----------|-------|------|
> | Product photography | `google / imagen-4.0-generate-001` | 88.0% | ~$0.040 |
> | Interior / real estate | `google / imagen-4.0-ultra-generate-001` | 87.5% | ~$0.080 |
> | Team headshots | `google / imagen-4.0-ultra-generate-001` | 86.5% | ~$0.080 |
> | Food photography | `google / imagen-4.0-ultra-generate-001` | 85.0% | ~$0.080 |
> | Icons / UI elements | `replicate / flux-1.1-pro` | 85.1% | ~$0.020 |
> | Hero banners (text) | `google / imagen-4.0-ultra-generate-001` | 84.6% | ~$0.080 |
> | Blog illustrations | `google / imagen-4.0-ultra-generate-001` | 83.3% | ~$0.080 |
> | Social media stories | `google / imagen-4.0-generate-001` | 83.6% | ~$0.040 |
> | Social media posts | `google / imagen-4.0-fast-generate-001` | 81.0% | ~$0.020 |
> | Abstract backgrounds | `google / imagen-3.0-generate-001` | 74.9% | ~$0.050 |
> | Logos | `google / imagen-4.0-fast-generate-001` | 73.4% | ~$0.020 |
> | Testimonial cards | `google / imagen-4.0-ultra-generate-001` | 71.1% | ~$0.080 |

### Custom dimensions

```bash
tools/text-to-image --prompt "panoramic landscape" --width 2048 --height 1024 --output panorama.png
```

### Output formats

The tool supports multiple output image formats: **PNG** (default), **JPG**, **WebP**, and **AVIF**.

The output format is determined by the file extension in `--output`:

```bash
# PNG (default, lossless)
tools/text-to-image --prompt "landscape" --output landscape.png

# AVIF (recommended — best compression/quality ratio)
tools/text-to-image --prompt "landscape" --output landscape.avif

# WebP (good compression, wide browser support)
tools/text-to-image --prompt "landscape" --output landscape.webp

# JPG (lossy, smallest for photos)
tools/text-to-image --prompt "landscape" --output landscape.jpg
```

If no recognized extension is specified, the tool auto-appends the provider's native format (usually `.png`).

**AVIF** is recommended for production assets — it provides 50–80% smaller files than PNG at equivalent visual quality. Conversion requires `avifenc` (from libavif). For WebP, `cwebp` is needed. ImageMagick (`convert`) serves as a universal fallback for format conversion.

### Negative prompts

```bash
tools/text-to-image --prompt "portrait of a cat" --negative-prompt "blurry, low quality, distorted" --output cat.png
```

### Multi-model comparison

Generate the same prompt across multiple models simultaneously:

```bash
tools/text-to-image --prompt "futuristic city" --models "dall-e-3,stable-diffusion-xl-1024-v1-0,flux-1.1-pro" --output city.png
```

This produces model-suffixed output files: `city-dall-e-3.png`, `city-stable-diffusion-xl-1024-v1-0.png`, `city-flux-1.1-pro.png`.

### Batch processing (YAML)

Create a YAML configuration file:

```yaml
jobs:
  - prompt: "sunset over mountains"
    output: "sunset.png"
    quality: high
    width: 1024
    height: 768
  - prompt: "cyberpunk city"
    output: "city.png"
    quality: medium
    width: 512
    height: 512
    metadata: true
    artist: "AI Assistant"
  - prompt: "portrait"
    output: "portrait.jpg"
    quality: low
    copyright: "2026"
```

Run sequentially or in parallel:

```bash
# Sequential
tools/text-to-image --config batch.yaml

# Parallel (up to 4 concurrent jobs)
tools/text-to-image --config batch.yaml --parallel --max-parallel 4
```

### Dry run

Validate command structure and see what API calls would be made:

```bash
tools/text-to-image --dry-run --prompt "test image" --output test.png
```

### Metadata embedding

Embed EXIF/XMP metadata in generated images (requires `exiftool`, falls back to `.metadata` JSON sidecar):

```bash
tools/text-to-image --prompt "landscape" --output landscape.jpg \
  --metadata --artist "AI Generator" --copyright "2026" \
  --keywords "ai,generated,landscape" --description "AI-generated landscape"
```

### JSON output (for agents and scripts)

```bash
# Image generation with JSON result
tools/text-to-image --prompt "test" --output test.png --output-format json
# Output: {"status":"success","output":"/path/to/test.png"}

# Model listing with JSON
tools/text-to-image --list-models --output-format json
# Output: [{"provider":"openai","model":"dall-e-3","name":"DALL-E 3",...}, ...]
```

### Model discovery

```bash
# List models for configured providers
tools/text-to-image --list-models

# List all known models (including unconfigured providers)
tools/text-to-image --all-models
```

### Google Imagen with specific auth method

```bash
# Force gcloud authentication
tools/text-to-image --provider google --google-auth-method gcloud \
  --prompt "gourmet dish" --output dish.png

# Use service account JSON
tools/text-to-image --provider google --google-credentials /path/to/sa.json \
  --prompt "product photo" --output product.png

# Specify region
tools/text-to-image --provider google --google-location europe-west1 \
  --prompt "cityscape" --output city.png
```

## Configuration

### Configuration directory

The tool stores configuration, cache, and logs in `~/.ai/text-to-image/`:

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

- Created automatically on first run with permissions `700` (owner-only)
- Override location: `export TEXT_TO_IMAGE_CONFIG_DIR="/custom/path"`

### `.env` file

Create `~/.ai/text-to-image/.env` with your API keys to avoid setting them in every shell session:

```bash
OPENAI_API_KEY="sk-your-openai-key"
STABILITY_API_KEY="sk-your-stability-key"
GOOGLE_CREDENTIALS="/path/to/service-account.json"
GOOGLE_PROJECT_ID="your-project-id"
HF_API_KEY="hf-your-token"
BFL_API_KEY="your-bfl-key"
REPLICATE_API_TOKEN="your-replicate-token"
SILICONFLOW_API_KEY="your-siliconflow-key"
```

### Environment variable overrides

| Variable | Default | Description |
|----------|---------|-------------|
| `TEXT_TO_IMAGE_CONFIG_DIR` | `~/.ai/text-to-image` | Config directory location |
| `TEXT_TO_IMAGE_NO_VERSION_CHECK` | `false` | Set to `true` to disable automatic version check |
| `DRY_RUN` | `false` | Set to `true` to enable dry-run mode |
| `VERBOSE` | `false` | Set to `true` for debug output |
| `CURL_CMD` | `curl` | Override curl command |
| `JQ_CMD` | `jq` | Override jq command |
| `YQ_CMD` | `yq` | Override yq command |
| `EXIFTOOL_CMD` | `exiftool` | Override exiftool command |

### Caching

Images are cached in `~/.ai/text-to-image/cache/` using SHA-256 hashes of generation parameters (prompt, dimensions, quality, provider, model). Cache hits return in under 100ms.

- **Bypass cache:** Use `--force` to force regeneration
- **Cache cleanup:** Automatic when cache exceeds 100MB (configurable via `CACHE_MAX_SIZE_MB`)
- **Clear cache manually:** `rm -rf ~/.ai/text-to-image/cache/*`

### YAML sidecar metadata

Every image generation writes a YAML sidecar file alongside the output image (same path with `.yaml` extension). This sidecar captures the full generation context for debugging, auditing, and reproducibility.

**Example:** generating `assets/hero.avif` also creates `assets/hero.yaml`.

**Sidecar schema:**

```yaml
generation:
  timestamp: "2026-03-10T14:30:00Z"
  tool_version: "1.0.0"
  duration_ms: 4500
  status: "success"         # or "error"
  error_message: ""         # populated on errors

input:
  prompt: |
    The full prompt text...
  negative_prompt: ""
  provider: "google"
  model: "imagen-4.0-generate-001"
  width: 1024
  height: 1024
  quality: "high"
  native_format: "png"

request:
  url: "https://..."
  method: "POST"
  headers:
    content_type: "application/json"
  payload: |
    { full sanitized request JSON }

response:
  http_code: 200
  body: |
    { full sanitized response JSON, base64 data replaced with size placeholder }

output:
  file_path: "/path/to/output.avif"
  file_size_bytes: 123456
  file_size_human: "121K"
  format_detected: "image/png"
  format_requested: "avif"
  width_px: 1024
  height_px: 1024
```

**Disabling:** Use `--no-generation-info` to suppress sidecar creation.

**Error sidecars:** Sidecars are written even when generation fails. The `generation.status` field is set to `"error"` and `generation.error_message` contains the failure reason. The `response` section captures the raw HTTP response for provider-specific error diagnosis.

#### Debugging with sidecars

When a generation fails, inspect the sidecar to diagnose the issue:

```bash
# Check status and error message
yq '.generation.status, .generation.error_message' assets/hero.yaml

# Check HTTP response code
yq '.response.http_code' assets/hero.yaml

# Inspect the full response body for provider-specific errors
yq '.response.body' assets/hero.yaml

# Review the request payload that was sent
yq '.request.payload' assets/hero.yaml
```

Common patterns:

- **HTTP 400:** Bad request — prompt too long, unsupported dimensions, or content policy violation. Check `response.body`.
- **HTTP 401/403:** Auth failure — check `input.provider` and verify the corresponding API key.
- **HTTP 429:** Rate limited — wait and retry, or switch to a different provider/model.
- **HTTP 500/502/503:** Server error — retry with `--force`, or switch provider.

## Troubleshooting

### Common errors

**"No available provider"**

No API keys are configured for any provider. Set at least one provider's environment variable (see [Provider Setup](#provider-setup)).

**"Provider 'X' is not configured"**

The specified provider's API key is not set. The error message includes a direct link to the relevant provider's setup section in this guide.

**"Width must be between 256 and 2048"**

Image dimensions must be within 256-2048 pixels. Some providers have additional constraints (e.g., DALL-E 3 supports specific sizes only).

**"Network error"**

Unable to reach the provider API. Check your internet connection and try again. The tool retries up to 3 times with exponential backoff.

**"Rate limit exceeded"**

The provider has throttled your requests. Wait for the backoff period or switch to a different provider using `--provider` or a different `--quality` profile.

**"Authentication failed"**

Your API key is invalid or expired. Verify the key at the provider's console (see links in [Provider Setup](#provider-setup)).

**"File system error"**

Cannot write to the output directory or config directory. Check permissions:

```bash
ls -la ~/.ai/text-to-image/
ls -la "$(dirname output.png)"
```

### Debugging

Enable verbose output for detailed execution logs:

```bash
tools/text-to-image --verbose --prompt "test" --output test.png
```

Verbose mode shows:

- Provider selection logic
- API request details (with sanitized credentials)
- Cache lookup results
- Response parsing steps
- Timing information

### Version check

The tool checks for newer versions on GitHub once every 24 hours. If outdated, it prints a warning to stderr without blocking execution.

- **Disable:** `export TEXT_TO_IMAGE_NO_VERSION_CHECK=true`
- **Check failures are silent:** Network errors, parse errors, and timeouts are silently discarded

## CLI Reference

```
text-to-image 1.0.0 — Generate images from text prompts using multiple AI providers

USAGE:
  text-to-image [OPTIONS]

OPTIONS:
  -h, --help                    Show help message and exit
  -V, --version                 Show version and exit
  -n, --dry-run                 Show what would be done without executing API calls
  -v, --verbose                 Enable debug logging

  --prompt TEXT                 Text prompt for image generation (required)
  --output FILE                 Output image file path (required)
  --quality high|medium|low     Quality profile (default: high)
                                 - high: OpenAI -> Stability -> Google
                                 - medium: Stability -> OpenAI -> Replicate
                                 - low: Hugging Face -> Stability -> SiliconFlow
  --width PIXELS                Image width (default: 1024, min: 256, max: 2048)
  --height PIXELS               Image height (default: 1024, min: 256, max: 2048)
  --negative-prompt TEXT        Negative prompt to avoid certain elements
  --provider PROVIDER           Specify provider: openai, stability, google,
                                 huggingface, bfl, replicate, siliconflow
  --model MODEL                 Specify model ID (e.g., dall-e-3, imagen-4.0-generate-001)
  --models MODELS               Comma-separated list for multi-model comparison

  --config YAML                 YAML configuration file for batch processing
  --parallel                    Enable parallel batch processing
  --max-parallel NUM            Max parallel jobs (default: CPU cores)
  --force                       Force regeneration (bypass cache)

  --metadata                    Embed metadata in generated image
  --artist TEXT                 Artist metadata for embedding
  --copyright TEXT              Copyright metadata for embedding
  --keywords TEXT               Keywords metadata for embedding
  --description TEXT            Description metadata for embedding

  --google-credentials FILE     Path to Google service account JSON key file
  --google-location REGION      Google Cloud region (default: us-central1)
  --google-auth-method METHOD   Google auth: auto, json, service-account, gcloud,
                                  api-key (default: auto)

  --no-generation-info          Disable YAML sidecar with request/response details
                                  (enabled by default; sidecar written alongside output image)

  --list-models                 List available models for configured providers
  --all-models                  List all known models (including unconfigured)
  --output-format text|json     Output format (default: text)

EXIT CODES:
  0   Success
  1   General error
  2   Invalid parameters
  3   Authentication failed
  4   Rate limit exceeded
  5   Server error
  6   Network error
  7   File system error
  8   Config error
  9   Batch partial failure
  100 Unknown error
```

## Changelog

### 1.0.0 (2026-03-07)

- Initial release as part of Agentic Delivery OS
- 7 providers: OpenAI DALL-E, Stability AI, Google Imagen, Hugging Face, Black Forest Labs FLUX, Replicate, SiliconFlow
- Quality-based provider selection (high/medium/low profiles)
- Multi-model comparison (`--models`)
- Batch processing via YAML config (`--config`)
- Response caching with SHA-256 keys
- EXIF/XMP metadata embedding with sidecar fallback
- Dry-run simulation (`--dry-run`)
- Automatic version check (24h cache, silent failure, opt-out)
- Documentation-linked error messages for unconfigured providers
- Google Imagen multi-auth (service account, gcloud, API key)
- Machine-readable JSON output (`--output-format json`)
- Model discovery (`--list-models`, `--all-models`)
- YAML sidecar with request/response logging (enabled by default, `--no-generation-info` to disable)
- Error YAML sidecar (written even on failure for debugging)
- AVIF and WebP output format support with auto-conversion
- Native format auto-detection and extension appending
