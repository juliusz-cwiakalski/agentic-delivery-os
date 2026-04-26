---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# MIT License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/documentation-profile-template.md
id: DOC-PROFILE-<repo-slug>
status: Accepted
profile: engineering-repo # engineering-repo | central-product-docs-repo | business-strategy-repo | mixed-product-engineering-repo
business_docs_enabled: false
business_docs_root: null # e.g. "doc/business" when enabled
canonical_strategy_repo: null # e.g. "github.com/org/product-docs"
allowed_write_roots:
  - doc/changes
  - doc/spec
  - doc/decisions
forbidden_write_roots:
  - doc/business
owners:
  - <owner-or-team>
last_updated: <YYYY-MM-DD>
---

# Documentation Profile

Use this file as the write-safety contract for humans and agents.

## Notes

- If this file is missing, default behavior is `engineering-repo` and business docs remain disabled.
- Keep `allowed_write_roots` and `forbidden_write_roots` deterministic and explicit.
- Set `business_docs_root` only when `business_docs_enabled: true`.
