#!/usr/bin/env bash
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
readonly ROOT
failures=0

pass() { printf '[PASS] %s\n' "$1"; }
fail() { printf '[FAIL] %s\n' "$1" >&2; failures=$((failures + 1)); }
require_file() {
  if [[ -f "${ROOT}/$1" ]]; then pass "$1 exists"; else fail "$1 missing"; fi
}
require_text() {
  local path="$1" text="$2"
  if grep -Fq -- "${text}" "${ROOT}/${path}"; then pass "${path} contains ${text}"; else fail "${path} missing ${text}"; fi
}

for path in \
  .opencode/agent/knowledge.md \
  .opencode/command/knowledge-review.md \
  .opencode/command/contributor-orientation.md \
  .ados-claude/agents/knowledge.md \
  .ados-claude/skills/knowledge-review/SKILL.md \
  .ados-claude/skills/contributor-orientation/SKILL.md \
  doc/guides/project-knowledge-management.md \
  doc/templates/knowledge-gap-schema.yaml \
  doc/templates/knowledge-gap-template.md \
  doc/templates/knowledge-instructions-template.md \
  tools/knowledge-gap; do
  require_file "${path}"
done

require_text .opencode/agent/knowledge.md 'mode: all'
require_text .opencode/command/knowledge-review.md 'agent: knowledge'
require_text .opencode/command/contributor-orientation.md 'agent: knowledge'
require_text .opencode/README.md "\`knowledge\`:"
require_text AGENTS.md "\`knowledge\` —"
require_text scripts/install.sh '"tools/knowledge-gap"'
require_text scripts/uninstall.sh 'knowledge-review.md'
require_text scripts/uninstall.sh 'contributor-orientation.md'
require_text scripts/uninstall.sh '"tools/knowledge-gap"'
require_text doc/00-index.md 'project-knowledge-management.md'
require_text README.md 'project-knowledge-management.md'

python3 - "${ROOT}" <<'PY' || failures=$((failures + 1))
import pathlib, sys
try:
    import yaml, jsonschema
except ImportError as exc:
    raise SystemExit(f"missing test dependency: {exc.name}")
root=pathlib.Path(sys.argv[1])
schema=yaml.safe_load((root/'doc/templates/knowledge-gap-schema.yaml').read_text())
assert schema.pop('ados_distribution') == 'redistributable'
jsonschema.Draft202012Validator.check_schema(schema)
types=schema['properties']['type']['enum']
assert len(types) == 11 and len(set(types)) == 11
assert schema['properties']['status']['enum'] == ['Open','Resolved','Dismissed']
print('[PASS] schema is valid and taxonomy/status sets are closed')
PY

if ((failures)); then
  printf '[FAIL] knowledge contracts: %d failure(s)\n' "${failures}" >&2
  exit 1
fi
printf '[PASS] knowledge contracts complete\n'
