---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/guides/tools-convention.md
---
# Tools Convention

Standard for building, documenting, and maintaining CLI tools in `tools/`.

## Design Principle

Tools are **standalone, agent-agnostic CLI utilities**. They are not coupled to any specific AI coding tool (OpenCode, Claude Code, Cursor, etc.). Any user or any coding agent can invoke them directly from a terminal. This means:

- No dependency on AI tool frameworks or runtimes
- Standard CLI interface (flags, stdin/stdout, exit codes)
- Self-contained documentation and help
- Works in CI/CD pipelines, shell scripts, and interactive terminals

## Naming and Location

| Aspect | Convention |
|--------|-----------|
| Directory | `tools/` at repo root |
| Extension | **No `.sh` extension** — invoked by name (e.g., `tools/text-to-image`) |
| Naming | kebab-case (e.g., `text-to-image`, `pdf-to-text`) |
| Executable | `chmod +x` — must be directly executable |
| Shell | Bash 4.0+ with strict mode (see `.ai/rules/bash.md`) |

This differs from `scripts/` which holds repo-internal automation (`.sh` extension required, not intended for external use).

## Versioning

Each tool is versioned **independently**. There is no repo-wide tool version.

### In the script

```bash
readonly APP_VERSION="1.0.0"
```

Use [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.

- **MAJOR**: Breaking changes to CLI interface (renamed flags, changed exit codes, removed features)
- **MINOR**: New features, new flags, new providers (backward-compatible)
- **PATCH**: Bug fixes, documentation updates, internal refactoring

### In the documentation

Display the version near the top of the tool's doc (`doc/tools/<tool-name>.md`), linking to the corresponding changelog entry:

```markdown
# tool-name User Guide

> Version 1.2.0 | [Changelog](#120-2026-04-15)
```

### Changelog

Each tool's documentation includes a `## Changelog` section at the bottom. Each version is a subsection:

```markdown
## Changelog

### 1.2.0 (2026-04-15)
- Added: new `--foo` flag for bar processing
- Fixed: edge case in provider fallback

### 1.1.0 (2026-03-20)
- Added: SiliconFlow provider support
- Changed: default quality profile from medium to high

### 1.0.0 (2026-03-07)
- Initial release
```

## License Header

Every tool script starts with the standard ADOS license header as bash comments:

```bash
#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/<tool-name>
```

The `Latest version` URL always points to `main` branch.

## `--help` Output

The `--help` output must include:

1. **Tool name, version, and one-line description**
2. **Usage syntax**
3. **Basic examples** (3-5 most common use cases)
4. **Options reference** (all flags with descriptions)
5. **Link to full documentation** on GitHub (main branch)
6. **License information**

### Template

```
<tool-name> <version> — <one-line description>

Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
MIT License - see LICENSE file for full terms
Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/<tool-name>

USAGE:
  <tool-name> [OPTIONS]

EXAMPLES:
  <tool-name> --example-flag "value" --output result.txt
  <tool-name> --dry-run --verbose

OPTIONS:
  -h, --help          Show this help message and exit
  -V, --version       Show version and exit
  -n, --dry-run       Show what would be done without executing
  -v, --verbose       Enable debug logging
  ...

DOCUMENTATION:
  Full guide: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/tools/<tool-name>.md

EXIT CODES:
  0 - Success
  2 - Invalid parameters
  ...
```

## `--version` Output

Multi-line format:

```
<tool-name> <version>
Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
MIT License - see LICENSE file for full terms
Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/<tool-name>
```

### Implementation

```bash
show_version() {
  cat <<EOF
${APP_NAME} ${APP_VERSION}
Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
MIT License - see LICENSE file for full terms
Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/${APP_NAME}
EOF
}
```

## Automatic Version Check

Every tool checks for updates on each invocation, but **no more than once per 24 hours**.

### Mechanism

1. Check timestamp file in config directory (`~/.ai/<tool-name>/version-check`)
2. If last check was < 24 hours ago, skip
3. Fetch the raw script from GitHub: `https://raw.githubusercontent.com/juliusz-cwiakalski/agentic-delivery-os/main/tools/<tool-name>`
4. Grep for `APP_VERSION` and extract the version string
5. Compare with local `APP_VERSION`
6. If newer version available, print a non-blocking warning to stderr
7. Update timestamp file

### Behavior

- **Outdated**: Prints warning to stderr (does not block execution):
  ```
  [WARN] (<tool-name>) A newer version is available (1.2.0 vs your 1.0.0).
    Update: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/<tool-name>
  ```
- **Up to date**: Silent
- **Check fails** (network error, parse error, timeout): **Silently discarded** — never block or warn the user
- **Opt-out**: Set environment variable `<TOOL_NAME_UPPER>_NO_VERSION_CHECK=true` (e.g., `TEXT_TO_IMAGE_NO_VERSION_CHECK=true`)

### Implementation sketch

```bash
_check_version() {
  local check_file="${CONFIG_DIR}/version-check"
  local now
  now="$(date +%s)"

  # Opt-out check
  local env_var_name
  env_var_name="$(printf '%s' "${APP_NAME}" | tr '[:lower:]-' '[:upper:]_')_NO_VERSION_CHECK"
  if [[ "${!env_var_name:-false}" == "true" ]]; then
    return 0
  fi

  # 24h cache check
  if [[ -f "$check_file" ]]; then
    local last_check
    last_check="$(cat "$check_file" 2>/dev/null || echo 0)"
    if (( now - last_check < 86400 )); then
      return 0
    fi
  fi

  # Fetch and compare (background-safe, silent on failure)
  {
    local raw_url="https://raw.githubusercontent.com/juliusz-cwiakalski/agentic-delivery-os/main/tools/${APP_NAME}"
    local remote_version
    remote_version="$(_curl -sS --max-time 5 "$raw_url" 2>/dev/null | grep -oP 'APP_VERSION="\K[^"]+' || true)"

    printf '%s' "$now" > "$check_file" 2>/dev/null || true

    if [[ -n "$remote_version" && "$remote_version" != "$APP_VERSION" ]]; then
      # Simple version comparison (lexicographic works for semver with same digit count)
      if [[ "$(printf '%s\n%s' "$APP_VERSION" "$remote_version" | sort -V | tail -1)" == "$remote_version" && "$remote_version" != "$APP_VERSION" ]]; then
        log_warn "A newer version is available ($remote_version vs your $APP_VERSION)."
        printf '[WARN]  (%s)   Update: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/%s\n' "$APP_NAME" "$APP_NAME" >&2
      fi
    fi
  } 2>/dev/null || true
}
```

## Configuration Directory

Each tool uses `~/.ai/<tool-name>/` for persistent state:

```
~/.ai/<tool-name>/
  ├── .env              # Environment variable overrides (API keys, etc.)
  ├── cache/            # Cached results (tool-specific)
  ├── logs/             # Execution logs
  └── version-check     # Timestamp of last version check (epoch seconds)
```

- Directory permissions: `700` (user-only access — contains API keys)
- Created automatically on first run if missing
- Configurable via `<TOOL_NAME_UPPER>_CONFIG_DIR` env var (e.g., `TEXT_TO_IMAGE_CONFIG_DIR`)

## Documentation

Each tool gets a dedicated documentation file: `doc/tools/<tool-name>.md`

### Required sections

| Section | Content |
|---------|---------|
| Title + version | `# <tool-name> User Guide` with version linking to changelog |
| Overview | What the tool does, supported providers/backends |
| Requirements | System dependencies (bash version, curl, optional tools) |
| Installation | How to make executable, add to PATH |
| Provider/Backend Setup | Per-provider subsections with stable headings (see below) |
| Usage Examples | Common use cases with copy-pasteable commands |
| Configuration | Config directory, env vars, .env file |
| Troubleshooting | Common errors, debugging tips |
| CLI Reference | Full options reference |
| Changelog | Versioned subsections |

### Stable documentation anchors

When a tool supports multiple providers or backends, each gets a **consistent markdown heading** so GitHub produces deterministic anchor URLs:

```markdown
## Provider Setup

### OpenAI
...
### Stability AI
...
### Google Imagen
...
```

These produce stable URLs like:
```
https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/tools/<tool-name>.md#openai
https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/tools/<tool-name>.md#stability-ai
```

The script can link to these in error messages (see Error Handling below).

## Error Handling

### Exit codes

Use semantic exit codes consistently across all tools:

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

### Documentation links in errors

When a user triggers an error related to configuration (e.g., missing API key, unconfigured provider), the error message includes a direct link to the relevant documentation section:

```
[ERROR] (text-to-image) Provider 'google' is not configured. Set up your API key:
  https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/tools/text-to-image.md#google-imagen
```

Implementation pattern:

```bash
readonly DOC_BASE_URL="https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/tools/${APP_NAME}.md"

# Map provider names to doc anchors
declare -A PROVIDER_DOC_ANCHORS=(
  [openai]="openai"
  [stability]="stability-ai"
  [google]="google-imagen"
  # ...
)

provider_not_configured_error() {
  local provider="$1"
  local anchor="${PROVIDER_DOC_ANCHORS[$provider]:-}"
  local doc_url="${DOC_BASE_URL}"
  [[ -n "$anchor" ]] && doc_url="${doc_url}#${anchor}"
  log_err "Provider '${provider}' is not configured. Set up your API key:"
  printf '[ERROR] (%s)   %s\n' "$APP_NAME" "$doc_url" >&2
}
```

## Tests

Each tool has test files in `tools/.tests/`:

| File | Purpose |
|------|---------|
| `test-<tool-name>-unit.sh` | Unit tests (mocked externals, fast) |
| `test-<tool-name>-integration.sh` | Integration tests (real APIs where possible, may need keys) |
| `test-<tool-name>-performance.sh` | Performance tests (response time, caching, concurrency) |

Tests follow `.ai/rules/bash.md` (strict mode, mockable wrappers, testable main guard).

Run: `bash tools/.tests/test-<tool-name>-unit.sh`

## Bash Coding Rules

All tools follow `.ai/rules/bash.md`. Key requirements:

- Strict mode: `set -Eeuo pipefail`, `set -o errtrace`, `shopt -s inherit_errexit`
- Mockable external commands via wrapper functions (e.g., `_curl()`, `_jq()`)
- Testable main guard: `if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main "$@"; fi`
- Structured sections: settings → traps → utilities → domain → CLI → main
- Functions: small, single-purpose, verb-named

## Checklist for New Tools

When creating a new tool, verify:

- [ ] File at `tools/<tool-name>` (no `.sh` extension), executable
- [ ] License header (3-line bash comment)
- [ ] `APP_VERSION` set with semver
- [ ] `--help` with examples, doc link, license info
- [ ] `--version` with name, version, copyright, MIT, URL
- [ ] Automatic version check with 24h cache and opt-out
- [ ] Config directory at `~/.ai/<tool-name>/`
- [ ] Semantic exit codes
- [ ] Doc links in configuration error messages
- [ ] Documentation at `doc/tools/<tool-name>.md` with version, provider setup, changelog
- [ ] Unit tests at `tools/.tests/test-<tool-name>-unit.sh`
- [ ] `AGENTS.md` Key References updated (if applicable)
- [ ] No coupling to any specific AI coding tool framework
