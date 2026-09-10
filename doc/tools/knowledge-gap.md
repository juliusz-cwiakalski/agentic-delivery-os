---
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/tools/knowledge-gap.md
ados_distribution: internal
---

# `knowledge-gap`

`tools/knowledge-gap` validates and inspects Git-native Knowledge Gap records. It
never creates a gap, changes tracker state, or fetches dependencies.

## Requirements

- Bash 4 or newer
- Python 3
- PyYAML
- `jsonschema`
- Git when using baseline validation or allocation checks

Install Python dependencies through the project or CI environment, for example:

```bash
python3 -m pip install PyYAML jsonschema
```

## Commands

```bash
tools/knowledge-gap validate --root .
tools/knowledge-gap validate --root . --base-ref origin/main
tools/knowledge-gap next-id --root .
tools/knowledge-gap index --root . > doc/knowledge/00-index.md
```

`validate` checks the shipped YAML-serialized JSON Schema, record frontmatter,
filename/identity agreement, duplicate IDs, and—with `--base-ref`—retained identity
and append-only lifecycle history. Errors identify the file and field to repair.

`next-id` scans records across all statuses and returns the highest allocated ID
plus one, starting at `KG-0001`. It never fills holes and fails when `KG-9999` is
already allocated. Commit and revalidate one
allocation before requesting another; reconcile provisional branch collisions before
merge without renumbering published records.

`index` writes a deterministic Markdown view to standard output. Redirect it to the
project-owned `doc/knowledge/00-index.md` only when its metadata is permitted for that
destination. Records—not the index—remain allocation and lifecycle authority.

See [Project Knowledge Management](../guides/project-knowledge-management.md) for
capture authorization, privacy, deduplication, routing, and closure rules.
