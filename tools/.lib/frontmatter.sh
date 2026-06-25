#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/tools/.lib/frontmatter.sh
# tools/.lib/frontmatter.sh — SHARED stdlib-only front-matter parser
#
# Sourced by tools/validate-decision-record and tools/generate-decision-index so
# both tools parse record front matter IDENTICALLY (plan task 4.2). Defines:
#
#   _frontmatter_to_json <file>   -> emits the YAML front matter as JSON on stdout
#   _record_body          <file>   -> emits the Markdown body (after the front matter) on stdout
#   _has_frontmatter      <file>   -> exit 0 if a leading `---`-fenced block exists, else 1
#
# Stdlib-only (DEC-4 / SD-4): python3 only — NO `import yaml` (python3 3.14 ships
# none) and NO external deps. The parser targets the FOCUSED YAML subset the
# decision-record front matter actually uses: nested maps (2-space indentation),
# block sequences (`- item`), flow sequences (`[a, b]` / `[]`), scalars,
# `null`/`true`/`false`, and single/double-quoted strings. Comment-only lines and
# trailing `# ...` comments are stripped. Constructs outside this subset raise a
# python exception (caught) rather than silently mis-parsing — the calling tool
# then reports an actionable parse error.
#
# This file is a sourced library: it defines functions ONLY and does not set shell
# options, run code, or parse args on source (testable-sourcing friendly).
# License header is applied by scripts/add-header-location.sh (tools/ qualifies).

_frontmatter_to_json() {
  local -r fm_file="$1"
  python3 - "$fm_file" <<'PY'
import sys, json, re

def parse_value(s):
    s = s.strip()
    if s == '' or s == 'null' or s == '~':
        return None
    if s == 'true':
        return True
    if s == 'false':
        return False
    if len(s) >= 2 and ((s[0] == '"' and s[-1] == '"') or (s[0] == "'" and s[-1] == "'")):
        return s[1:-1]
    if s.startswith('[') and s.endswith(']'):
        inner = s[1:-1].strip()
        if not inner:
            return []
        return [parse_value(x) for x in _split_flow(inner)]
    if re.fullmatch(r'-?\d+', s):
        return int(s)
    if re.fullmatch(r'-?\d+\.\d+', s):
        return float(s)
    return s

def _split_flow(s):
    out = []; cur = ''; inq = None; depth = 0
    for ch in s:
        if inq:
            cur += ch
            if ch == inq:
                inq = None
        elif ch in '"\'':
            inq = ch; cur += ch
        elif ch == '[':
            depth += 1; cur += ch
        elif ch == ']':
            depth -= 1; cur += ch
        elif ch == ',' and depth == 0:
            out.append(cur); cur = ''
        else:
            cur += ch
    if cur.strip():
        out.append(cur)
    return [x.strip() for x in out]

def _strip_comment(line):
    out = []; inq = None
    for ch in line:
        if inq:
            out.append(ch)
            if ch == inq:
                inq = None
        elif ch in '"\'':
            inq = ch; out.append(ch)
        elif ch == '#':
            if (not out) or out[-1] in (' ', '\t'):
                break
            out.append(ch)
        else:
            out.append(ch)
    return ''.join(out).rstrip()

def _parse_map(lines, i, indent):
    obj = {}
    while i < len(lines):
        ind, content = lines[i]
        if ind < indent:
            break
        if ind > indent:
            i += 1; continue
        if content.startswith('- '):
            break
        key, _, rest = content.partition(':')
        key = key.strip()
        rest = rest.strip()
        i += 1
        if rest == '':
            if i < len(lines) and lines[i][0] > indent:
                val, i = _parse(lines, i, lines[i][0])
            else:
                val = None
            obj[key] = val
        else:
            obj[key] = parse_value(rest)
    return (obj, i)

def _parse_seq(lines, i, indent):
    arr = []
    while i < len(lines):
        ind, content = lines[i]
        if ind < indent:
            break
        if ind > indent:
            i += 1; continue
        if not content.startswith('- '):
            break
        item = content[2:].strip()
        i += 1
        if item == '':
            if i < len(lines) and lines[i][0] > indent:
                val, i = _parse(lines, i, lines[i][0])
                arr.append(val)
            else:
                arr.append(None)
        elif ':' in item and not (item.startswith('"') or item.startswith("'")):
            sub = [(indent + 2, item)]
            while i < len(lines) and lines[i][0] > indent:
                sub.append(lines[i]); i += 1
            val, _ = _parse_map(sub, 0, indent + 2)
            arr.append(val)
        else:
            arr.append(parse_value(item))
    return (arr, i)

def _parse(lines, i, indent):
    if i >= len(lines):
        return (None, i)
    if lines[i][1].startswith('- '):
        return _parse_seq(lines, i, lines[i][0])
    return _parse_map(lines, i, lines[i][0])

path = sys.argv[1]
try:
    with open(path, encoding='utf-8') as fh:
        text = fh.read()
    raw_lines = text.split('\n')
    start = None
    for idx, l in enumerate(raw_lines):
        if l.strip() == '---':
            start = idx; break
    obj = {}
    if start is not None:
        end = None
        for idx in range(start + 1, len(raw_lines)):
            if raw_lines[idx].strip() == '---':
                end = idx; break
        if end is not None:
            fm = raw_lines[start + 1:end]
            plines = []
            for l in fm:
                if not l.strip():
                    continue
                if l.lstrip().startswith('#'):
                    continue
                stripped = _strip_comment(l)
                if not stripped.strip():
                    continue
                indent = len(stripped) - len(stripped.lstrip(' '))
                plines.append((indent, stripped.strip()))
            if plines:
                obj, _ = _parse_map(plines, 0, plines[0][0])
    print(json.dumps(obj, ensure_ascii=False))
except Exception as exc:
    sys.stderr.write("frontmatter parse error: %s\n" % exc)
    print(json.dumps({}))
    sys.exit(0)
PY
}

_record_body() {
  local -r body_file="$1"
  awk '
    BEGIN { state = 0 }
    state == 0 && /^---[[:space:]]*$/ { state = 1; next }
    state == 1 && /^---[[:space:]]*$/ { state = 2; next }
    state == 2 { print }
  ' "$body_file"
}

_has_frontmatter() {
  local -r hf_file="$1"
  local first
  first="$(head -n 1 "$hf_file" 2>/dev/null || true)"
  [[ "$first" =~ ^---[[:space:]]*$ ]]
}
