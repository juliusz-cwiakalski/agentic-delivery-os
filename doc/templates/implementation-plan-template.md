---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main/doc/templates/implementation-plan-template.md
ados_distribution: redistributable
id: chg-<workItemRef>-<slug>             # e.g., chg-GH-456-units-display
status: Proposed                         # Proposed | Updated
created: <YYYY-MM-DD>T00:00:00Z
last_updated: <YYYY-MM-DD>T00:00:00Z
owners: [<from-spec>]
service: <from-spec>
labels: [<from-spec>]
links:
  change_spec: <relative-path>           # e.g., ./chg-GH-456-spec.md
summary: >
  <from-spec-summary>
version_impact: <from-spec>
---

<!-- TEMPLATE INSTRUCTIONS
1. Copy this file to the change folder as: doc/changes/YYYY-MM/YYYY-MM-DD--<workItemRef>--<slug>/chg-<workItemRef>-plan.yaml
   The body of that file is the YAML plan document below (drop this markdown wrapper and the front matter when authoring the YAML artifact).
2. Replace all <...> placeholders with actual values.
3. Remove these instructions before finalizing.
4. Derive all requirements from the change spec and test plan — do not invent.
-->

# IMPLEMENTATION PLAN — <workItemRef>: <Change Title>

The current plan artifact is a versioned YAML document named
`chg-<workItemRef>-plan.yaml`. A legacy `chg-<workItemRef>-plan.md` remains
readable during the transition and is answered with the classified
`plan.format.legacy-markdown` verdict; it is not schema-valid.

```yaml
schemaVersion: delivery.plan.v1
workItemRef: <workItemRef>
tier:
  name: <full | lite | declared tier>
  phases: [<phase ids this tier runs>]
  escalationTriggers:
    - <inert trigger declared by the tier>
defaultLeases:                    # optional plan-level default
  - <repo lease>
defaultWeightClass: <weight>      # optional plan-level default
phases:
  - id: 1
    title: <Planning phase title>
    kind: planning                # planning = lease-free
    summary: <one-line phase summary consumed by the commit path>
    scope:
      files:
        - <concrete repository path>
      folders:
        - <boundary-aware directory prefix>
      packages:
        - packages/<package>/**   # package-granularity glob
    interactions:
      - kind: contract-file       # contract-file | generated-code
        target: <path inside this phase's scope>
        role: producer            # producer | consumer
  - id: 2
    title: <Delivery phase title>
    kind: delivery                # delivery = lease-taking
    summary: <one-line phase summary consumed by the commit path>
    scope:
      files:
        - <concrete repository path>
    doneArtifacts:
      mergeRequestUrl: <URL the phase must produce>
      pipelineId: <pipeline id the phase must produce>
      deployedEnvironment: <environment the phase deploys>
      trackerTransition: <tracker state the phase moves to>
    leases:
      - <repo lease>
    weightClass: <standard | heavy | opaque declared class>
```

## Scope semantics

- `files` entries are concrete repository-relative paths and match exactly.
- `folders` entries are directory prefixes and match boundary-aware: `src/plan`
  matches `src/plan/a.ts`, never `src/planner/a.ts`.
- `packages` entries are package-granularity globs: `*` stays inside one path
  segment and `**` crosses segments.
- A phase must declare at least one non-empty scope key. Planning phases are
  lease-free; delivery phases are lease-taking. An optional `leaseClass` must
  agree with the phase kind.
- `tier` is required plan data. Per-tier phase sets and escalation triggers are
  inert declarations; unknown tiers are rejected with `plan.tier.unknown`.
- `doneArtifacts` are typed declaration slots echoed by `plan validate`; the
  verdict does not verify their reality.
- `summary` is optional, non-empty, and echoed by `plan validate`; the commit
  path consumes it for the plan-phase message context. Omission stays valid.
- The plan declares phases and scope only. It carries no `tasks` key and no
  progress log; progress belongs in pm-notes `notes:`.

## Validation

- `plan validate <workItemRef>` — schema verdict plus `readyForDevelopment`.
- `plan overlap <refA> <refB>` — `parallel` or `run-in-sequence` with named paths.
- `plan diff <workItemRef> [--against <base>]` — declared versus actual scope.
- `lint plan <workItemRef>` — write-time conformance with locations.

## Legacy markdown transition

`chg-<workItemRef>-plan.md` is read during the transition and answered with
`plan.format.legacy-markdown` (`readyForDevelopment=false`, exit 1). New plans
are authored as YAML; when both files exist, the YAML plan wins and the verdict
discloses the artifact it read.
