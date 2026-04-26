---
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
