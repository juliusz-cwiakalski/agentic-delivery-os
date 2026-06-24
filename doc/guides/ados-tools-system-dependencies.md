---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/guides/system-dependencies.md
---
# System Dependencies

External system tools required by ADOS scripts and CLI utilities.

This document covers the four shell programs that ship with the repository:

| Program | Path | Purpose |
|---------|------|---------|
| `text-to-image` | `tools/text-to-image` | AI image generation CLI (7 providers) |
| `install.sh` | `scripts/install.sh` | Install/update ADOS globally or locally |
| `uninstall.sh` | `scripts/uninstall.sh` | Remove ADOS from global or local install |
| `add-header-location.sh` | `scripts/add-header-location.sh` | Add MIT license headers to files |

## Dependency Matrix

Each tool is marked **required** (hard failure if missing) or **optional** (graceful degradation or fallback).

### Core Shell & Utilities

| Tool | Requirement | Used by | Why |
|------|-------------|---------|-----|
| `bash` (>=4) | required | all 4 | Shell interpreter; associative arrays, `shopt -s inherit_errexit`, `set -Eeuo pipefail` |
| `printf` | required | all 4 | Structured log output (`log_info`, `log_warn`, `log_err`, `log_debug`) |
| `mktemp` | required | `text-to-image`, `add-header-location.sh` | Create temporary files for curl stderr capture, format conversion staging, awk processing |
| `rm` | required | all 4 | Remove files and directories (cache cleanup, temp files, uninstall) |
| `mkdir` | required | `text-to-image`, `install.sh` | Create config/cache/log directories and project directory stubs |
| `cp` | required | `install.sh`, `add-header-location.sh`, `text-to-image` | Copy files during install, replace processed files, store in cache |
| `chmod` | required | `text-to-image` | Set restrictive `700` permissions on config/cache directories |
| `date` | required | `text-to-image` | Timestamps for YAML sidecars, structured logs, version-check cache, JWT token expiry |
| `cat` | required | `text-to-image`, `add-header-location.sh` | Read version-check file, write YAML heredocs, assemble file content |
| `sleep` | required | `text-to-image` | Exponential backoff between API retries, polling intervals |
| `kill` | required | `text-to-image` | Timeout wrapper for long-running generation jobs |
| `wait` | required | `text-to-image` | Collect exit codes from background batch jobs and timeout wrapper |

### Networking

| Tool | Requirement | Used by | Why |
|------|-------------|---------|-----|
| `curl` | required | `text-to-image` | All API calls to 7 image-generation providers, download generated images, version check from GitHub |

### Version Control

| Tool | Requirement | Used by | Why |
|------|-------------|---------|-----|
| `git` | required | `install.sh`, `add-header-location.sh` | Clone/update ADOS repo (`git clone`, `git pull --ff-only`), resolve repo root (`git rev-parse --show-toplevel`), get commit SHAs |

### JSON / YAML Processing

| Tool | Requirement | Used by | Why |
|------|-------------|---------|-----|
| `jq` | required | `text-to-image` | Build API request payloads, parse API responses, structured JSON logging, cache metadata, batch job processing, model listing |
| `yq` | optional | `text-to-image` | Parse YAML config files for batch processing; falls back to simple `awk` key-value parsing when absent |

### File Comparison & Text Processing

| Tool | Requirement | Used by | Why |
|------|-------------|---------|-----|
| `diff` | required | `install.sh`, `add-header-location.sh` | Compare source vs destination files to detect changes and skip unchanged files |
| `grep` | required | all 4 | Check `.gitignore` entries, detect existing license headers, parse HTTP `Retry-After` headers, match version strings |
| `sed` | required | `add-header-location.sh`, `text-to-image` | Indent JSON for YAML literal blocks (`sed 's/^/    /'`), strip HTTP header values |
| `awk` | required | `add-header-location.sh`, `text-to-image` | Frontmatter manipulation in markdown files, YAML fallback parsing, human-readable file-size formatting |
| `head` | required | `add-header-location.sh` | Read first line to detect bash shebangs |
| `tail` | required | `add-header-location.sh`, `text-to-image` | Skip shebang line when inserting headers; version comparison via `sort -V \| tail -1` |
| `sort` | required | `add-header-location.sh`, `text-to-image` | Sort found files, semantic version comparison (`sort -V`) |
| `tr` | required | `uninstall.sh`, `text-to-image` | Count path separators for safe-`rm` depth check, base64 URL-safe encoding (`tr '+/' '-_'`), strip carriage returns |
| `wc` | required | `uninstall.sh` | Count path separators to enforce minimum directory depth before `rm -rf` |
| `cut` | required | `text-to-image` | Extract SHA-256 hash and cache directory size from command output |
| `xargs` | required | `text-to-image` | Trim whitespace from model names in multi-model mode |

### File System Inspection

| Tool | Requirement | Used by | Why |
|------|-------------|---------|-----|
| `find` | required | `add-header-location.sh`, `text-to-image` | Find `.md`/`.sh`/shebang files in directories; remove oldest cache files by mtime |
| `file` | required | `text-to-image` | Detect actual MIME type of downloaded images to verify format matches the requested extension |
| `stat` | required | `text-to-image` | Get output file size in bytes for YAML sidecar (tries GNU `--format` then BSD `-f` syntax) |
| `du` | required | `text-to-image` | Measure cache directory size for automatic cleanup threshold |
| `realpath` | required | `install.sh`, `uninstall.sh`, `add-header-location.sh` | Canonicalize paths for safe comparison (prevent `rm /` or `rm $HOME`), compute relative paths |
| `readlink` | optional | `install.sh`, `uninstall.sh` | Fallback for `realpath` on systems where it is unavailable |
| `basename` | required | `text-to-image`, `install.sh` | Extract filenames from paths |
| `dirname` | required | `text-to-image`, `install.sh` | Get parent directory for output path validation and `mkdir -p` |
| `ls` | required | `uninstall.sh` | Check if directories are empty before removing (`ls -A`) |
| `rmdir` | required | `uninstall.sh` | Remove empty directories (safer than `rm -rf`) |
| `pwd` | required | `install.sh`, `uninstall.sh` | Display current project path |

### Hashing

| Tool | Requirement | Used by | Why |
|------|-------------|---------|-----|
| `sha256sum` | required (one of three) | `text-to-image` | Compute deterministic cache keys from generation parameters |
| `shasum` | fallback | `text-to-image` | macOS fallback for SHA-256 hashing |
| `cksum` | fallback | `text-to-image` | Last-resort non-cryptographic hash when neither `sha256sum` nor `shasum` is available |

> At least one of `sha256sum`, `shasum`, or `cksum` must be present. On Ubuntu `sha256sum` is provided by `coreutils`.

### Encoding & Cryptography

| Tool | Requirement | Used by | Why |
|------|-------------|---------|-----|
| `base64` | required | `text-to-image` | Decode base64-encoded images from Stability AI, Google Imagen, and Hugging Face responses; encode JWT header/payload for Google service-account auth |
| `openssl` | optional | `text-to-image` | Sign JWT with RS256 for Google service-account authentication (`openssl dgst -sha256 -sign`); only needed when using `GOOGLE_CREDENTIALS` JSON key file |

### Image Processing (all optional)

These tools enable automatic format conversion and metadata embedding. When absent, `text-to-image` logs a warning and saves the image in its native provider format.

| Tool | Requirement | Used by | Why |
|------|-------------|---------|-----|
| `cwebp` | optional | `text-to-image` | Preferred converter for PNG/JPG to WebP format |
| `avifenc` | optional | `text-to-image` | Preferred converter for PNG/JPG to AVIF format |
| `magick` / `convert` | optional | `text-to-image` | ImageMagick general-purpose image format conversion fallback (WebP, AVIF, PNG, JPG) |
| `identify` | optional | `text-to-image` | Read image dimensions (width x height) for YAML sidecar metadata |
| `exiftool` | optional | `text-to-image` | Embed metadata (artist, copyright, keywords, prompt) directly into image EXIF data |

### External CLIs (optional)

| Tool | Requirement | Used by | Why |
|------|-------------|---------|-----|
| `gcloud` | optional | `text-to-image` | Google Cloud authentication fallback (`gcloud auth print-access-token`, `gcloud config get-value project`); only needed when not using a service-account JSON key |
| `nproc` | optional | `text-to-image` | Detect CPU core count for parallel batch processing; defaults to `4` if unavailable |

## Summary

The four shell programs collectively use approximately 40 distinct system tools:

- **Hard requirements** that cause immediate failure if missing: `bash` (>=4), `curl` (for `text-to-image`), `git` (for `install.sh` and `add-header-location.sh`), `jq` (for `text-to-image`), plus standard POSIX utilities (`grep`, `sed`, `awk`, `find`, `diff`, `stat`, `file`, `realpath`, `base64`, etc.).
- **Optional with graceful degradation**: `yq`, `openssl`, `gcloud`, `cwebp`, `avifenc`, ImageMagick (`magick`/`convert`/`identify`), `exiftool`, `nproc`, `readlink`.
- **Standard POSIX/GNU utilities** expected on any Linux or macOS system: `printf`, `mktemp`, `rm`, `mkdir`, `cp`, `chmod`, `date`, `cat`, `head`, `tail`, `sort`, `tr`, `wc`, `cut`, `xargs`, `basename`, `dirname`, `ls`, `rmdir`, `pwd`, `du`, `sleep`, `kill`, `wait`.

## Installing on Ubuntu

The following commands install every required and optional dependency on an Ubuntu-based system (22.04+).

### All dependencies in one command

```bash
sudo apt-get update && sudo apt-get install -y \
  bash \
  coreutils \
  findutils \
  grep \
  sed \
  gawk \
  diffutils \
  file \
  curl \
  git \
  jq \
  yq \
  openssl \
  imagemagick \
  webp \
  libavif-bin \
  libimage-exiftool-perl
```

### What each package provides

| apt package | Tools provided | Notes |
|-------------|---------------|-------|
| `bash` | `bash` | Already installed on Ubuntu; ensures version >=4 |
| `coreutils` | `printf`, `mktemp`, `rm`, `mkdir`, `cp`, `chmod`, `date`, `cat`, `head`, `tail`, `sort`, `tr`, `wc`, `cut`, `basename`, `dirname`, `ls`, `rmdir`, `pwd`, `du`, `sha256sum`, `base64`, `nproc`, `stat`, `sleep`, `kill`, `readlink`, `realpath` | Already installed on Ubuntu |
| `findutils` | `find`, `xargs` | Already installed on Ubuntu |
| `grep` | `grep` | Already installed on Ubuntu |
| `sed` | `sed` | Already installed on Ubuntu |
| `gawk` | `awk` | Ubuntu ships `mawk` by default; `gawk` provides full POSIX awk |
| `diffutils` | `diff` | Already installed on Ubuntu |
| `file` | `file` | Detects MIME types of downloaded images |
| `curl` | `curl` | HTTP client for all API calls |
| `git` | `git` | Clone/update ADOS repo, detect repo root |
| `jq` | `jq` | JSON processing for API payloads and responses |
| `yq` | `yq` | YAML config parsing (optional; install via snap if not in apt) |
| `openssl` | `openssl` | JWT signing for Google service-account auth (optional) |
| `imagemagick` | `magick`, `convert`, `identify` | Image format conversion and dimension detection (optional) |
| `webp` | `cwebp` | Preferred PNG/JPG to WebP converter (optional) |
| `libavif-bin` | `avifenc` | Preferred PNG/JPG to AVIF converter (optional) |
| `libimage-exiftool-perl` | `exiftool` | EXIF metadata embedding (optional) |

### Notes

- **`yq`**: On Ubuntu 22.04+ the `yq` package may not be available in default repositories. Install via snap instead:

  ```bash
  sudo snap install yq
  ```

- **`gcloud`**: Not available via apt. Follow the [Google Cloud SDK install guide](https://cloud.google.com/sdk/docs/install) if you need Google Imagen support without a service-account JSON key.

- **Minimal install** (scripts only, no `text-to-image`): If you only need `install.sh`, `uninstall.sh`, and `add-header-location.sh`, the base Ubuntu packages plus `git` are sufficient:

  ```bash
  sudo apt-get update && sudo apt-get install -y git
  ```

- **Verify your install**: After installing, run the following to confirm all required tools are available:

  ```bash
  for cmd in bash curl git jq grep sed awk find diff file stat \
             realpath base64 sha256sum mktemp sort tr wc cut xargs; do
    printf '%-14s %s\n' "$cmd" "$(command -v "$cmd" 2>/dev/null || echo 'MISSING')"
  done
  ```
