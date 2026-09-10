#!/usr/bin/env bash
set -Eeuo pipefail
set -o errtrace
shopt -s inherit_errexit 2>/dev/null || true
IFS=$'\n\t'

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
readonly ROOT
readonly TOOL="${ROOT}/tools/knowledge-gap"
readonly SCRATCH_PARENT="${ROOT}/tmp/tmpdir"
mkdir -p "${SCRATCH_PARENT}"
work="$(mktemp -d "${SCRATCH_PARENT}/knowledge-gap-test.XXXXXX")"
trap '[[ -n "${work:-}" && -d "${work}" ]] && rm -rf "${work}"' EXIT

fail() { printf '[FAIL] %s\n' "$1" >&2; exit 1; }
assert_contains() { [[ "$1" == *"$2"* ]] || fail "expected '$2' in '$1'"; }
copy_contract() {
  local root="$1"
  mkdir -p "${root}/doc/templates" "${root}/doc/knowledge/gaps"
  cp "${ROOT}/doc/templates/knowledge-gap-schema.yaml" "${root}/doc/templates/"
  git -C "${root}" init -q
  git -C "${root}" config user.email test@example.invalid
  git -C "${root}" config user.name Test
}
write_record() {
  local root="$1" id="$2" status="${3:-Open}" history="${4:-[]}" type="${5:-missing}" resolution="null" disposition="null"
  [[ "${status}" != "Resolved" ]] || resolution='{canonical_ref: doc/guides/fixed.md, verified_at: 2026-01-02T00:00:00Z, verification_notes: Original task passed., related_refs: [GH-41]}'
  [[ "${status}" != "Dismissed" ]] || disposition='{disposed_at: 2026-01-02T00:00:00Z, rationale: Evidence shows no deficiency.}'
  mkdir -p "${root}/doc/knowledge/gaps"
  printf -- '---\nid: %s\nstatus: %s\ntype: %s\narea: docs\nsummary: Missing procedure\nowners: [docs]\ncreated: 2026-01-01T00:00:00Z\nupdated: 2026-01-01T00:00:00Z\ncontext: A sanitized task cannot be completed.\ndiagnosis: Canonical guidance is absent.\nevidence_checked: [{source: doc/index.md, observation: No route is present.}]\nimpact: Contributors cannot complete the task.\noccurrence: {count: 1, last_observed: 2026-01-01T00:00:00Z}\nrelationships: {changes: [], decisions: [], work: [], gaps: []}\ndesired_resolution: Add and verify canonical guidance.\nresolution: %s\ndisposition: %s\nhistory: %s\nreopening_evidence: null\n---\n' "${id}" "${status}" "${type}" "${resolution}" "${disposition}" "${history}" >"${root}/doc/knowledge/gaps/${id}--fixture.md"
}

project="${work}/valid"
copy_contract "${project}"
write_record "${project}" KG-0001 Open
output="$("${TOOL}" validate --root "${project}")"
assert_contains "${output}" 'Validated 1'
[[ "$("${TOOL}" next-id --root "${project}")" == 'KG-0002' ]] || fail 'allocator did not use max+1'
assert_contains "$("${TOOL}" index --root "${project}")" 'KG-0001'

mv "${project}/doc/knowledge/gaps/KG-0001--fixture.md" "${project}/doc/knowledge/gaps/KG-0002--fixture.md"
if "${TOOL}" validate --root "${project}" >"${work}/out" 2>"${work}/err"; then fail 'path/id mismatch passed'; fi
assert_contains "$(<"${work}/err")" 'filename must be'

matrix="${work}/matrix"
copy_contract "${matrix}"
types=(missing completeness discoverability contradiction drift staleness-risk ownership vocabulary accessibility source-authority decision-needed)
for index in "${!types[@]}"; do
  printf -v id 'KG-%04d' "$((index + 1))"
  write_record "${matrix}" "${id}" Open '[]' "${types[index]}"
done
write_record "${matrix}" KG-0012 Resolved '[{kind: resolution, at: 2026-01-02T00:00:00Z, canonical_ref: doc/guides/fixed.md, verification_notes: Original task passed.}]'
write_record "${matrix}" KG-0013 Dismissed '[{kind: disposition, at: 2026-01-02T00:00:00Z, rationale: Evidence shows no deficiency.}]'
assert_contains "$("${TOOL}" validate --root "${matrix}")" 'Validated 13'

holes="${work}/holes"
copy_contract "${holes}"
write_record "${holes}" KG-0002 Open
write_record "${holes}" KG-0009 Open
git -C "${holes}" add .
git -C "${holes}" commit -qm holes
[[ "$("${TOOL}" next-id --root "${holes}")" == 'KG-0010' ]] || fail 'allocator filled a hole'
write_record "${holes}" KG-9999 Open
if "${TOOL}" next-id --root "${holes}" >"${work}/out" 2>"${work}/err"; then fail 'exhausted allocator passed'; fi
assert_contains "$(<"${work}/err")" 'allocation is exhausted'

invalid="${work}/invalid"
copy_contract "${invalid}"
write_record "${invalid}" KG-0001 Open
python3 - "${invalid}/doc/knowledge/gaps/KG-0001--fixture.md" <<'PY'
import pathlib, sys
p=pathlib.Path(sys.argv[1]); p.write_text(p.read_text().replace('status: Open', 'status: In Progress'))
PY
if "${TOOL}" validate --root "${invalid}" >"${work}/out" 2>"${work}/err"; then fail 'tracker workflow status passed'; fi
assert_contains "$(<"${work}/err")" 'field status'

rm -f "${project}/doc/knowledge/gaps/KG-0002--fixture.md"
write_record "${project}" KG-0001 Resolved '[{kind: resolution, at: 2026-01-02T00:00:00Z, canonical_ref: doc/guides/fixed.md, verification_notes: Original task passed.}]'
git -C "${project}" add .
git -C "${project}" commit -qm baseline
printf '%s\n' 'status: Open' >/dev/null
python3 - "${project}/doc/knowledge/gaps/KG-0001--fixture.md" <<'PY'
import pathlib
p=pathlib.Path(__import__('sys').argv[1]); s=p.read_text(); s=s.replace('status: Resolved','status: Open').replace('resolution: {canonical_ref: doc/guides/fixed.md, verified_at: 2026-01-02T00:00:00Z, verification_notes: Original task passed., related_refs: [GH-41]}','resolution: null'); p.write_text(s)
PY
if "${TOOL}" validate --root "${project}" --base-ref HEAD >"${work}/out" 2>"${work}/err"; then fail 'unsupported reopening passed'; fi
assert_contains "$(<"${work}/err")" 'requires appended reopening history'

git -C "${project}" restore .
python3 - "${project}/doc/knowledge/gaps/KG-0001--fixture.md" <<'PY'
import pathlib, sys
p=pathlib.Path(sys.argv[1]); s=p.read_text(); s=s.replace('status: Resolved','status: Open').replace('resolution: {canonical_ref: doc/guides/fixed.md, verified_at: 2026-01-02T00:00:00Z, verification_notes: Original task passed., related_refs: [GH-41]}','resolution: null').replace('history: [{kind: resolution, at: 2026-01-02T00:00:00Z, canonical_ref: doc/guides/fixed.md, verification_notes: Original task passed.}]','history: [{kind: resolution, at: 2026-01-02T00:00:00Z, canonical_ref: doc/guides/fixed.md, verification_notes: Original task passed.}, {kind: reopening, at: 2026-01-03T00:00:00Z, evidence: {source: rerun, observation: Independent recurrence.}}]').replace('reopening_evidence: null','reopening_evidence: {source: rerun, observation: Independent recurrence.}'); p.write_text(s)
PY
assert_contains "$("${TOOL}" validate --root "${project}" --base-ref HEAD)" 'Validated 1'

collision="${work}/collision"
copy_contract "${collision}"
write_record "${collision}" KG-0001 Open
cp "${collision}/doc/knowledge/gaps/KG-0001--fixture.md" "${collision}/doc/knowledge/gaps/KG-0001--other.md"
if "${TOOL}" validate --root "${collision}" >"${work}/out" 2>"${work}/err"; then fail 'provisional duplicate passed'; fi
assert_contains "$(<"${work}/err")" 'duplicate identity'

branches="${work}/branches"
copy_contract "${branches}"
write_record "${branches}" KG-0001 Open
git -C "${branches}" add .
git -C "${branches}" commit -qm baseline
base_branch="$(git -C "${branches}" branch --show-current)"
git -C "${branches}" checkout -qb allocation-a
write_record "${branches}" KG-0002 Open
git -C "${branches}" add .
git -C "${branches}" commit -qm allocation-a
git -C "${branches}" checkout -q "${base_branch}"
git -C "${branches}" checkout -qb allocation-b
write_record "${branches}" KG-0002 Open
mv "${branches}/doc/knowledge/gaps/KG-0002--fixture.md" "${branches}/doc/knowledge/gaps/KG-0002--other.md"
git -C "${branches}" add .
git -C "${branches}" commit -qm allocation-b
git -C "${branches}" merge -q --no-edit allocation-a
if "${TOOL}" validate --root "${branches}" >"${work}/out" 2>"${work}/err"; then fail 'concurrent branch identity collision passed'; fi
assert_contains "$(<"${work}/err")" 'duplicate identity'

git -C "${project}" restore .
rm -f "${project}/doc/knowledge/gaps/KG-0001--fixture.md"
if "${TOOL}" validate --root "${project}" --base-ref HEAD >"${work}/out" 2>"${work}/err"; then fail 'durable deletion passed'; fi
assert_contains "$(<"${work}/err")" 'was deleted or renumbered'

printf '[PASS] knowledge-gap schema matrix, allocation, index, identity, and baseline lifecycle checks\n'
