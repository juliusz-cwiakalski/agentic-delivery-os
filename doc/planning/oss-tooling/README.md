# OSS tooling planning

Planning documents for the open-source tooling: a TypeScript CLI plus MCP
server plus opencode-native surface over one shared typed core. The accepted
structure decision is [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md)
(six packages, pnpm + Bun, layered configuration, wrapper-based strangler
migration). The working name is `ados` until the naming freeze; everything
name-derived comes from the single branding constant.

## Documents

| Document | Content |
|---|---|
| [roadmap.md](roadmap.md) | Milestones M0-M4, principles, exit criteria (OSS track only) |
| [backlog.md](backlog.md) | The story backlog per milestone; the unit of delivery |
| [cli-command-registry.md](cli-command-registry.md) | The `ados(1)` man page v0 and the command registry with delivery and extension stories |
| [user-journeys.md](user-journeys.md) | How the CEO agent and other agents use the commands: the change lifecycle and multi-repository coordination |

## Status

Draft under review. Feedback happens on the open pull request; the docs are
iterated there until approved, then maintained as living planning documents
and reconciled by the delivery process as milestones land.

## Constraints honored by everything here

- Open source only in committed files; local telemetry is cloud-shippable by
  design, but no cloud capability gates local function.
- Working name `ados` protected by the branding seam; publication stays
  blocked until the naming freeze.
- The bash delivery stack keeps running until each replacement passes
  parity; removal happens at the very last stage with deprecation notices.
- Delivery of this repo itself flows through the 11-phase lifecycle on the
  `main-tools` branch.
