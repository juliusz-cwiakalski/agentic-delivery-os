#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/blueprints/zai-peak-hours-hook--install.sh
# ados_distribution: redistributable
#
# Blueprint: Install the Z.AI peak-hours pre-iteration hook.
#
# Copies the inactive example from scripts/hooks/pre-opencode-iteration-zai.sh
# to the default hook path (~/.ados/hooks/pre-opencode-iteration) so that
# deliver-ticket.sh and ceo-loop.sh pause during the Z.AI Coding Plan peak
# window (04:00–10:00 UTC) when the configured model uses zai-coding-plan/.
#
# Prerequisites:
#   - ADOS installed (scripts/install.sh --local or --global)
#   - A zai-coding-plan/ model assigned to pm/ceo in your OpenCode config
#
# Usage:
#   bash doc/templates/blueprints/zai-peak-hours-hook--install.sh
#
# Or the one-liner (from repo root):
#   mkdir -p ~/.ados/hooks && cp scripts/hooks/pre-opencode-iteration-zai.sh ~/.ados/hooks/pre-opencode-iteration && chmod +x ~/.ados/hooks/pre-opencode-iteration
#
# See: doc/guides/zai-peak-hours-hook.md for full documentation.

set -Eeuo pipefail

HOOK_SRC="scripts/hooks/pre-opencode-iteration-zai.sh"
HOOK_DST="${HOME}/.ados/hooks/pre-opencode-iteration"

# Resolve repo root (script may be run from repo root or doc/templates/blueprints/)
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." && pwd -P)"

SRC="${REPO_ROOT}/${HOOK_SRC}"

if [[ ! -f "${SRC}" ]]; then
  printf '[ERROR] Hook source not found: %s\n' "${SRC}" >&2
  printf '        Run this script from an ADOS-installed repository.\n' >&2
  exit 1
fi

mkdir -p "$(dirname "${HOOK_DST}")"
cp "${SRC}" "${HOOK_DST}"
chmod +x "${HOOK_DST}"

printf '[INFO] Z.AI peak-hours hook installed: %s\n' "${HOOK_DST}"
printf '[INFO] Peak window: 04:00–10:00 UTC (activates only with zai-coding-plan/ models)\n'
printf '[INFO] Verify: ls -la %s\n' "${HOOK_DST}"
printf '[INFO] Uninstall: rm -f %s\n' "${HOOK_DST}"
