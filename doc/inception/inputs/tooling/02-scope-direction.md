# Owner scope direction (tooling subproject inception)

Binding direction for the GH-200 inception run. Where anything else disagrees
with the accepted decision records, the decision records win.

## Scope

- Incept the OSS tooling subproject only: the `packages/` monorepo, its
  command surface, adapters, state, and the migration of the bash delivery
  stack onto it.
- Committed scope is roadmap M0-M4; the inception gap map targets the M0-M3
  end state (M4 is public-release readiness and depends on owner gates).
- Committed files are OSS only. No cloud names, designs, pricing, or code.
- The repository's delivery framework (AGENTS.md, `.ai/agent/*`,
  `.opencode/**`, `doc/guides/**`, delivery-system feature specs, bash
  scripts) is INPUT to this run. Verify consistency; never regenerate,
  rewrite, or overwrite. Framework deltas route to normal tickets.

## Flow and delivery mode

- `project.flow: legacy`. The subproject exists and has real history; the run
  reconstructs its knowledge base rather than authoring one from scratch.
- Single branch, single PR for the whole run (explicit owner instruction):
  `docs/GH-200/tooling-inception`, base `main-tools`. Phase commits land on
  that branch after each owner gate; one PR carries the run.
- Inception state lives at `doc/inception/inception-state.yaml` (this repo
  ships no live instance today; this run creates it).

## Verify-don't-regenerate (per phase)

- North star and roadmap: committed `doc/planning/oss-tooling/roadmap.md` is
  the living plan. The run extracts the subproject north star and overview
  material; it does not rewrite the roadmap.
- Architecture: ADR-0003 and ADR-0005 define structure. The run produces the
  missing architecture overview, component map, and FSE audit from the actual
  `packages/` tree.
- Quality baseline: `.ai/rules/*` and the root workspace config are in force.
  The run audits them against the full-stack checklist, documents ACTUAL
  state, and flags gaps; it does not restyle them.
- Glossary: `doc/overview/glossary.md` extends with tooling terms; existing
  entries stay.

## Coordination with open work

- M0 delivery continues during the run. In-flight stories (GH-177, GH-182,
  GH-184) add feature specs and decision content; the run reconciles against
  whatever is merged at each phase, and phase 6 re-checks consistency.
- M0-S17 (GH-186) delivers the decision-record batch and measurement
  baseline. This run SEEDS the undecided records (adapter contract, release
  model, command naming lock) as proposals with options; ratification stays
  with the M0-S17 delivery.
- Backlog changes flow through the committed backlog and the tracker; the run
  proposes refinements, it does not edit stories directly.

## Hard constraints

- No product name coupling: the branding constant owns every name-derived
  value; the forbidden-literal gate stays green.
- No private identifiers, private paths, or private repository references in
  any committed artifact.
- Apache-2.0. Dependency license policy: `doc/legal/` registry, fail closed.
- License headers are added only by `scripts/add-header-location.sh`; AI
  agents never add headers by hand.
- Distributable docs declare `ados_distribution` frontmatter; the CI drift
  guard must pass.
- No em or en dashes in anything the owner reads.
- Nothing is committed without the owner's explicit go-ahead; every phase
  ends at a human gate.
