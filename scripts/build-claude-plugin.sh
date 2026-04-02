#!/usr/bin/env bash
# ==============================================================================
# build-claude-plugin.sh - Generate Claude Code plugin from .opencode/ source
# ==============================================================================
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski
# MIT License - see LICENSE file for full terms
#
# PURPOSE:
#   Transform .opencode/ agent/command definitions to Claude Code plugin format.
#   This script reads the single source of truth (.opencode/) and generates
#   a Claude Code-compatible plugin directory (.ados-claude/).
#
# EXTENSIBILITY:
#   This script is designed to support multiple coding tools in the future.
#   To add a new tool (e.g., Copilot CLI, Codex, Cursor):
#
#   1. Add a new tool case to the build_plugin() function
#   2. Create tool-specific transformation functions if needed:
#      - transform_<tool>_agent_frontmatter()
#      - transform_<tool>_command_to_skill()
#      - generate_<tool>_manifest()
#   3. Call the build script with the tool name:
#      ./scripts/build-<tool>-plugin.sh
#
#   Current tools:
#   - claude: Claude Code by Anthropic
#   - Future: copilot, codex, cursor, windsurf
#
# USAGE:
#   ./scripts/build-claude-plugin.sh [--dry-run] [--verbose]
#
# OUTPUT:
#   .ados-claude/
#   ├── .claude-plugin/
#   │   └── plugin.json
#   ├── agents/
#   │   └── *.md
#   └── skills/
#       └── */SKILL.md
#
# DESIGN DECISIONS (from spec DEC-1 to DEC-8):
#   - Plugin location: .ados-claude/ (short, distinctive)
#   - Plugin name: ados
#   - Source of truth: .opencode/ (no duplication)
#   - Model assignment: from claude.model frontmatter (optional, default: sonnet)
#   - License headers: applied to all generated files
#   - Build idempotency: removes existing output before regeneration
# ==============================================================================

set -euo pipefail

# ==============================================================================
# Configuration
# ==============================================================================

readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Tool configuration (extensible pattern)
readonly TOOL="${TOOL:-claude}"
readonly SOURCE_DIR="${REPO_ROOT}/.opencode"
readonly OUTPUT_DIR="${REPO_ROOT}/.ados-${TOOL}"

# License header for generated files
# Note: Each file gets copyright, license, and source URL
generate_license_header() {
    local source_path="$1"
    cat <<EOF
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/${source_path}
EOF
}

# Default model for files without claude.model
readonly DEFAULT_MODEL="sonnet"

# Verbosity flags
VERBOSE="${VERBOSE:-false}"
DRY_RUN="${DRY_RUN:-false}"

# ==============================================================================
# Utility Functions
# ==============================================================================

log() {
    if [[ "${VERBOSE}" == "true" ]]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
    fi
}

error() {
    echo "ERROR: $*" >&2
    exit 1
}

warn() {
    echo "WARN: $*" >&2
}

# ==============================================================================
# YAML Frontmatter Parsing
# ==============================================================================

# Extract YAML frontmatter from a file
# Returns: frontmatter content (without --- delimiters)
extract_frontmatter() {
    local file="$1"
    local in_frontmatter=false
    local content=""

    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ "$line" == "---" ]]; then
            if [[ "$in_frontmatter" == "false" ]]; then
                in_frontmatter=true
                continue
            else
                break
            fi
        fi
        if [[ "$in_frontmatter" == "true" ]]; then
            content+="$line"$'\n'
        fi
    done < "$file"

    echo "$content"
}

# Extract body content (after frontmatter) from a file
extract_body() {
    local file="$1"
    local in_frontmatter=false
    local after_frontmatter=false
    local content=""

    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ "$line" == "---" ]]; then
            if [[ "$in_frontmatter" == "false" ]]; then
                in_frontmatter=true
            else
                after_frontmatter=true
                continue
            fi
        elif [[ "$after_frontmatter" == "true" ]]; then
            content+="$line"$'\n'
        fi
    done < "$file"

    echo "$content"
}

# Extract a value from YAML frontmatter
# Usage: get_yaml_value "yaml_content" "key"
# Handles: simple keys, nested keys (e.g., "claude.model")
# For arrays, returns the first element or "true" for boolean flags
get_yaml_value() {
    local yaml="$1"
    local key="$2"
    local value=""
    local in_array=false
    local array_values=()

    # Handle nested keys like "claude.model"
    local parent_key=""
    local child_key="$key"
    if [[ "$key" == *"."* ]]; then
        parent_key="${key%%.*}"
        child_key="${key#*.}"
    fi

    # Parse YAML line by line
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip empty lines and comments
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

        # Handle nested key context
        if [[ -n "$parent_key" ]]; then
            # Look for parent key
            if [[ "$line" =~ ^[[:space:]]*${parent_key}:[[:space:]]*$ ]]; then
                # Parent found, continue to next line which should have child key
                continue
            fi
            # Check if we're in the parent's nested block (indented)
            if [[ "$line" =~ ^[[:space:]]+${child_key}:[[:space:]]+(.+)$ ]]; then
                value="${BASH_REMATCH[1]}"
                # Remove quotes if present
                value="${value#\"}"
                value="${value%\"}"
                value="${value#\'}"
                value="${value%\'}"
                break
            fi
        else
            # Simple key matching
            if [[ "$line" =~ ^[[:space:]]*${child_key}:[[:space:]]+(.+)$ ]]; then
                value="${BASH_REMATCH[1]}"
                # Remove quotes if present
                value="${value#\"}"
                value="${value%\"}"
                value="${value#\'}"
                value="${value%\'}"

                # Handle multiline strings (description with >-)
                if [[ "$value" == ">-" || "$value" == ">" || "$value" == "|-" || "$value" == "|" ]]; then
                    in_array=true
                    local multiline_value=""
                    while IFS= read -r ml_line; do
                        # Stop at next key
                        if [[ "$ml_line" =~ ^[[:space:]]*[a-zA-Z_-]+:[[:space:]] ]]; then
                            break
                        fi
                        multiline_value+="$ml_line "
                    done
                    value="${multiline_value#"${multiline_value%%[![:space:]]*}"}"  # trim leading
                    value="${value%"${value##*[![:space:]]}"}"  # trim trailing
                    break
                fi

                # Handle arrays
                if [[ "$value" == "[]" ]]; then
                    value=""
                    break
                fi

                break
            fi
        fi
    done <<< "$yaml"

    echo "$value"
}

# ==============================================================================
# Claude Code Transformation Functions
# ==============================================================================

# Transform agent frontmatter from OpenCode to Claude Code format
# Input: source agent file
# Output: transformed frontmatter
transform_agent_frontmatter() {
    local source_file="$1"
    local agent_name
    agent_name="$(basename "$source_file" .md)"

    local frontmatter
    frontmatter="$(extract_frontmatter "$source_file")"

    # Extract values from source frontmatter
    local description model
    description="$(get_yaml_value "$frontmatter" "description")"
    model="$(get_yaml_value "$frontmatter" "claude.model")"

    # Apply defaults
    description="${description:-${agent_name} agent}"
    model="${model:-${DEFAULT_MODEL}}"

    # Generate Claude Code frontmatter
    # Note: allowed-tools is set to mcp__* for MCP tool access
    # The user can override this in Claude Code settings
    cat <<EOF
---
$(generate_license_header ".opencode/agent/${agent_name}.md")
name: ${agent_name}
description: ${description}
model: ${model}
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - WebFetch
  - "mcp__*"
---
EOF
}

# Transform command to skill for Claude Code
# Input: source command file
# Output: skill file content with transformed frontmatter
transform_command_to_skill() {
    local source_file="$1"
    local skill_name
    skill_name="$(basename "$source_file" .md)"

    local frontmatter
    frontmatter="$(extract_frontmatter "$source_file")"

    # Extract values from source frontmatter
    local description model
    description="$(get_yaml_value "$frontmatter" "description")"
    model="$(get_yaml_value "$frontmatter" "claude.model")"

    # Apply defaults
    description="${description:-${skill_name} skill}"
    model="${model:-${DEFAULT_MODEL}}"

    # Generate Claude Code skill frontmatter
    # Skills typically need read/analysis tools
    cat <<EOF
---
$(generate_license_header ".opencode/command/${skill_name}.md")
name: ${skill_name}
description: ${description}
model: ${model}
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - WebFetch
  - "mcp__*"
---
EOF
}

# Generate plugin manifest for Claude Code
# Output: JSON manifest content
generate_manifest() {
    cat <<'EOF'
{
  "name": "ados",
  "version": "1.0.0",
  "author": "Juliusz Ćwiąkalski",
  "description": "Agentic Delivery OS - AI-powered software delivery system"
}
EOF
}

# ==============================================================================
# Build Functions
# ==============================================================================

# Build the complete plugin
build_plugin() {
    local tool="$1"
    local source_dir="$2"
    local output_dir="$3"

    log "Building ${tool} plugin..."
    log "Source: ${source_dir}"
    log "Output: ${output_dir}"

    # Clean existing output
    if [[ -d "${output_dir}" ]]; then
        log "Removing existing output directory..."
        rm -rf "${output_dir}"
    fi

    # Create output structure
    mkdir -p "${output_dir}/agents"
    mkdir -p "${output_dir}/.claude-plugin"

    # Transform agents
    log "Transforming agents..."
    local agent_count=0
    for agent_file in "${source_dir}/agent"/*.md; do
        [[ -f "$agent_file" ]] || continue

        local agent_name
        agent_name="$(basename "$agent_file" .md)"
        local output_file="${output_dir}/agents/${agent_name}.md"

        # Transform frontmatter
        local transformed_frontmatter body
        transformed_frontmatter="$(transform_agent_frontmatter "$agent_file")"
        body="$(extract_body "$agent_file")"

        # Write output file
        {
            echo "$transformed_frontmatter"
            echo "$body"
        } > "$output_file"

        ((agent_count++)) || true
    done

    log "Transformed ${agent_count} agents"

    # Transform commands to skills
    log "Transforming commands to skills..."
    local skill_count=0
    for command_file in "${source_dir}/command"/*.md; do
        [[ -f "$command_file" ]] || continue

        local skill_name
        skill_name="$(basename "$command_file" .md)"
        local skill_dir="${output_dir}/skills/${skill_name}"
        local output_file="${skill_dir}/SKILL.md"

        mkdir -p "$skill_dir"

        # Transform frontmatter
        local transformed_frontmatter body
        transformed_frontmatter="$(transform_command_to_skill "$command_file")"
        body="$(extract_body "$command_file")"

        # Write output file
        {
            echo "$transformed_frontmatter"
            echo "$body"
        } > "$output_file"

        ((skill_count++)) || true
    done

    log "Transformed ${skill_count} skills"

    # Generate manifest
    log "Generating manifest..."
    generate_manifest > "${output_dir}/.claude-plugin/plugin.json"

    echo "✓ Built ${tool} plugin successfully"
    echo "  - Agents: ${agent_count}"
    echo "  - Skills: ${skill_count}"
    echo "  - Output: ${output_dir}"
}

# ==============================================================================
# Main
# ==============================================================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --verbose|-v)
                VERBOSE="true"
                shift
                ;;
            --help|-h)
                cat <<EOF
Usage: ${SCRIPT_NAME} [OPTIONS]

Generate Claude Code plugin from .opencode/ source definitions.

Options:
  --dry-run    Show what would be done without making changes
  --verbose    Enable verbose output
  --help       Show this help message

Environment:
  TOOL         Tool name (default: claude)

Examples:
  ${SCRIPT_NAME}
  ${SCRIPT_NAME} --verbose
  TOOL=copilot ${SCRIPT_NAME}  # Future: build Copilot plugin
EOF
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done

    # Validate source
    if [[ ! -d "${SOURCE_DIR}" ]]; then
        error "Source directory not found: ${SOURCE_DIR}"
    fi

    if [[ ! -d "${SOURCE_DIR}/agent" ]]; then
        error "Agent directory not found: ${SOURCE_DIR}/agent"
    fi

    if [[ ! -d "${SOURCE_DIR}/command" ]]; then
        error "Command directory not found: ${SOURCE_DIR}/command"
    fi

    # Dry run mode
    if [[ "${DRY_RUN}" == "true" ]]; then
        echo "DRY RUN - would build ${TOOL} plugin:"
        echo "  Source: ${SOURCE_DIR}"
        echo "  Output: ${OUTPUT_DIR}"
        echo "  Agents: $(ls -1 "${SOURCE_DIR}/agent"/*.md 2>/dev/null | wc -l) files"
        echo "  Skills: $(ls -1 "${SOURCE_DIR}/command"/*.md 2>/dev/null | wc -l) files"
        exit 0
    fi

    # Build plugin
    build_plugin "${TOOL}" "${SOURCE_DIR}" "${OUTPUT_DIR}"
}

main "$@"