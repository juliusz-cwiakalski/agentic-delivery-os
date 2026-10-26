---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/policy-as-code.md
---
# Concept: policy as code

Status: Draft (2026-10-25). Feeds the policy engine story (M3-S5) and the
M0-S17 decision records. Grounded in what the production pilot already
enforces with bash-era tooling.

## Summary

A policy is a declared, checkable rule. The policy engine covers three
layers:

1. Repository policy: platform settings (branch protection, merge rules,
   required checks) declared once, checked across the fleet, applied on
   drift with a rollback snapshot.
2. Delivery-action policy: rules enforced at the point of action (merge,
   dispatch, phase transitions).
3. The rules register: every written rule mapped to its mechanical check,
   or flagged as prose-only advisory.

The register is the honesty layer: a rule that lives only in a guide is
visibly advisory instead of being silently believed to be enforced. The
gap between prose and enforcement is where the documented near-miss
incidents came from.

## Policy object model

A policy has: id, declaration (desired state or rule), check mechanism,
enforcement point (check-time, apply-time, or point-of-action), exceptions
(profiled, with reason and expiry), and provenance (snapshot before apply,
audit trail of changes). Policies are data; engines and commands consult
them.

## A. Enforced today (machine-enforced in the pilot and this repository)

| Policy | Enforced by |
|---|---|
| Merge governance standard: squash always; fast-forward-only default branch; squash message template; pipeline green before merge (skipped pipeline acceptable); all threads resolved; delete source branch; protected default branch (push: no one, merge: maintainers) | The fleet merge-policy script: check mode reports drift, apply mode enforces idempotently, machine-readable output for collectors |
| Exception profiles for repositories that intentionally differ (workspace and docs repos allow direct commits; the exception is declared with reason, not drift) | The same policy script, exceptions encoded with owner rationale |
| Timestamped settings snapshots before policy changes, for rollback and incident forensics | The settings snapshot script |
| Test battery as an explicit pre-push gate: fail-fast phases, fast subset first | The pre-push gate script |
| Test isolation: fixtures must not mutate repository state; violations fail loudly with a diff and a dedicated exit code | The isolation guard in the pre-push gate |
| Branch protection on this repository: required pull request, required checks, enforce admins, linear history, no force pushes or deletions, conversation resolution | Platform settings, verified in CI |
| Distributable docs must declare their distribution marker | CI drift guard |
| Generated harness plugin must match the canonical source | CI sync verification |
| One delivery per repository at a time | The delivery ownership lock (single-flight) |
| Test runs are offline-hermetic: no live credentials read or set | Hermetic test battery with environment scrubbing |
| License headers managed exclusively by the header script | Script is the only writer; hand headers are policy violations |

## B. Prose today (the first scope for the policy engine)

Written rules followed by discipline, without a machine check. Each one
becomes policy-engine scope by gaining a check.

| Policy (prose today) | Planned check |
|---|---|
| Never merge over an open owner gate (owner-review-first classes) | Owner-gate scan in the gate battery |
| DO-NOT-MERGE markers block merges | Marker scan in the gate battery |
| Gates must be fresh at merge time (stale green is not green) | Transactional re-fetch with a bounded verification window |
| Producers merge before consumers across repositories | Dependency-aware merge sequencing |
| Owner gates age into escalation, never silence (SLA) | Owner-gate SLA mechanics (M1-S5) |
| Closing beats opening (merge-ready work ranks above new starts) | Ready-set ranking (M0-S7) |
| Agent-authored comments are classified by provenance (agent under the owner account is distinct) | Embedded metadata provenance (concepts/embedded-metadata.md) |
| No client identifiers or private content in committed files | Privacy-literal guard (M0-S15) |
| Peak windows mean pause, never substitute peak-priced work | Quota-window policy in the provider engine (M0-S13) |
| Subscription quota before pay-per-token | Provider routing policy data (M0-S13) |
| Deprecation notices precede tool retirement | Retirement checks (M3-S7, M4-S5) |
| Stable installs from pinned tagged releases only | Release-job publish guard (M4-S2) |
| Secrets live in the environment only, never in repository-scoped config | Config layer hard error (DEC-4, M0-S4) |
| Briefs and ceremonies render from source, never carry stale text | Render-from-source verification (M1-S6, M2-S3) |
| Owner-only decision classes (pricing, legal, destructive operations, new cost patterns) are never delegated | Decision-class scan in the policy engine |

## C. Future policy ideas (not used yet)

| Idea | Notes |
|---|---|
| Rules register with prose-only flagging | The policy engine itself (M3-S5): a rule without a check is flagged by name |
| Dependency license policy: registry with allow and deny lists, unknown fails closed | Planned with the license registry (M0-S18) |
| No hosted-product content in committed files | Planned guard (M0-S15) |
| Merge freeze windows | FreezeFlag primitive (M1) |
| Local gate breadth must equal CI breadth | Suite-to-job mapping (M2-S7) |
| Build-weight class constraints (no two heavy builds per runner) | Lane plan (M2-S1) |
| Agents use only models from their assigned profile class | Model profiles (concepts/model-profiles.md) |
| Exceptions expire quarterly unless renewed | Exception lifecycle in the policy engine |
| Policy changes carry an audit trail (who, what, snapshot diff) | Provenance of policy mutations |
| Phase reopen requires a reason; transitions only through the phase command | Enforced by construction from M0-S10; the policy aspect is reopen reason quality |
| Event retention policy (configurable windows) | After usage data justifies it |

## Story mapping

- M3-S5: the policy engine (declaration, fleet check/apply, exception
  profiles, snapshots, rules register, point-of-action enforcement).
- M0-S4, M0-S15, M0-S18: config-layer enforcement, privacy guard, license
  gate (early policy checks).
- M1-S5: owner-gate SLA (a prose rule gaining its check).
- M2-S1, M2-S7: build-weight and suite-breadth policies.
- Blueprint grounding: the bash-era merge-policy, settings-snapshot, and
  pre-push-gate scripts (see the private blueprint inventory, section 6).

## Open questions

- Policy declaration format (config layer file versus a dedicated policy
  document per fleet).
- Where point-of-action checks live: in each command, or one policy
  consulted by all (leaning: one policy engine, commands consult).
- Exception approval flow (owner-only, or coordinator may grant scoped
  exceptions).
