---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/spec/features/feature-license-header-script.md

id: SPEC-LICENSE-HEADER-SCRIPT
status: Current
created: 2026-03-07
last_updated: 2026-03-16
owners: [Juliusz Ćwiąkalski]
service: scripts
links:
  related_changes: ["GH-26"]
summary: "Script that adds or updates Apache-2.0 license headers to both Markdown and Bash files in the repository."
---

# Feature: License Header Script (`scripts/add-header-location.sh`)

## Overview

`scripts/add-header-location.sh` adds the standard ADOS three-line Apache-2.0 license header to files in the repository. It supports two file types:

- **Markdown files** (`.md` extension) — header added as YAML frontmatter
- **Bash scripts** (`.sh` extension or shebang-detected) — header added as bash comments after the shebang line

## Supported File Types

### Markdown Files

Files with `.md` extension receive the license header as YAML frontmatter with a `source:` attribute:

```yaml
---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (...)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/<path>
---
```

The `source:` line is a real YAML attribute (not a comment) to ensure Markdown renderers treat the block as valid frontmatter.

### Bash Scripts

Files detected as bash scripts receive the license header as bash comments. Detection methods:

1. **Extension-based**: Files with `.sh` extension
2. **Shebang-based**: Files whose first line matches `#!/usr/bin/env bash` or `#!/bin/bash` (regardless of extension)

For shebang-detected files, the header is inserted after the shebang line:

```bash
#!/usr/bin/env bash
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (...)
# Apache-2.0 License - see LICENSE file for full terms
# Latest version: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/<path>
```

## Behavior

- **Idempotent**: Running the script multiple times on the same file produces the same result — no duplicate headers.
- **Directory processing**: When given a directory, discovers both `.md` files and bash scripts recursively.
- **Dry-run mode**: Supports previewing changes without modifying files.
- **Canonical URL**: The `source` URL always points to the `main` branch on GitHub.
- **Format-aware**: Markdown files use `source:` YAML attribute; Bash files use `# Latest version:` comment. The script detects and migrates the old `# Latest version:` comment format in Markdown files to the new `source:` attribute format.

## Usage

```bash
# Single file
scripts/add-header-location.sh path/to/file.md

# Directory (processes both .md and bash files)
scripts/add-header-location.sh doc/

# Dry run
scripts/add-header-location.sh --dry-run path/to/file.sh
```

## Related Documentation

- **Tests**: `scripts/.tests/test-add-header-location.sh` — 19 automated tests
