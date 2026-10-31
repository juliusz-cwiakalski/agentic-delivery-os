# Repo analysis (tooling subproject inception, phase 0, legacy flow)

Legacy ingestion of the repository as it stands at 2026-10-31, scoped to the
OSS tooling subproject. Facts only; assessment lives with the gap map and the
registers. Snapshot basis: `main-tools` at `e424423`.

## 1. Repository profile

One repository, two products:

1. **Delivery framework (product, out of run scope)**: agent and command
   definitions in `.opencode/` (canonical) with `.ados-claude/` (generated),
   the bash delivery stack in `scripts/` and `tools/`, the guides and
   templates under `doc/`, and the delivery-system feature specs. This is
   what makes the repository an operating delivery system today.
2. **OSS tooling subproject (run scope)**: the TypeScript monorepo under
   `packages/` that replaces the bash stack engine by engine (strangler),
   per ADR-0003, plus its planning corpus under `doc/planning/oss-tooling/`.

Documentation profile: engineering-repo (default; no business docs).

## 2. Branch and delivery model

- `main` is the frozen public default branch; `main-tools` is the integration
  branch every tooling PR targets; merging `main-tools` into `main` is an
  owner-gated publish step (roadmap M4).
- Branch protection on both branches; linear history on `main-tools`; squash
  merges with conventional subjects; a PR base guard enforces the base.
- Delivery is ticket-driven through the 11-phase lifecycle; parallel delivery
  runs in per-ticket worktrees for low-conflict stories; the dispatcher is
  never a lane; one delivery per repository at a time per repo.

## 3. As-is architecture (verified facts)

- Six packages per ADR-0003 DEC-1, all `private: true` until the naming
  freeze, one lockstep version line (changesets fixed group):
  - `packages/core`: runtime-neutral services and contracts; source areas
    `app/`, `branding/`, `config/`, `contracts/`, `domain/`, `state/`.
  - `packages/adapters`: per-provider and per-I/O subpath clients: azure, ci,
    credentials, file, github, gitlab, host, io, jira, legacy, registry,
    repo, session.
  - `packages/cli`: command surface (commands, output, classification,
    edge/projection helpers).
  - `packages/mcp`: MCP server surface.
  - `packages/opencode`: harness integration surface.
  - `packages/testkit`: private dev-only test harness.
- Toolchain: pnpm workspaces with pinned packageManager and one lockfile; Bun
  pinned with a four-copy pin-equality CI check; biome; dependency-cruiser
  package/subpath/tier/runtime boundary rules; strict shared tsconfig;
  publint/attw gates; aggregate gate `pnpm check`.
- Naming: single branding constant drives binary, env prefix, config dir,
  state dir; a forbidden-literal gate fails CI on name literals outside the
  branding module; working name `ados` until the naming freeze.
- Result model: CommandResult envelope with an internal error table; exit
  codes are a CLI-only projection of the table.
- Configuration: layered chain (built-in < system < user-global < project
  committed < project local < environment < CLI flags), fail-closed
  validation, per-key origin reporting, secrets environment-only.
- State: local-first durable storage behind an implementation-neutral
  abstraction; append-only JSONL plus indexes; torn-state detection;
  schema-versioned.
- Bash stack remains authoritative for delivery; wrappers keep commands
  working as typed engines replace them.

## 4. Delivery progress snapshot (M0, milestone-scoped tickets)

- Closed (9): S1 scaffold (GH-170), S2 branding seam (GH-171), S3 result
  contract (GH-172), S4 config layer (GH-173), S5 state layer (GH-174), S10
  pm-notes and registry lint (GH-179), S12 primitive ports (GH-181), S16
  interim mitigations (GH-185), S19 client seeds with trap catalogs (GH-188).
- In flight (3): S8 verify change and exit taxonomy (GH-177), S13 provider v1
  (GH-182), S15 privacy and no-cloud guards (GH-184).
- Open not started (8): S6 status v1 (GH-175), S7 queue ready (GH-176), S9
  verify gates v1 (GH-178), S11 db session-admin port (GH-180), S14 closeout
  v1 (GH-183), S17 decision records and baseline (GH-186), S18 license
  registry (GH-187), S20 adapter conformance suite v1 (GH-189).

## 5. Gap map: current state to M0-M3 end state

Target = committed roadmap exit criteria. "KB" rows are the inception run's
own deliverables; engine rows belong to the delivery backlog.

### 5.1 M0 trust substrate (target: status, verify change, provider, closeout, and validation running dual-run beside the bash stack; zero false-success incidents over two weeks on pilot paths)

| Capability | State | Evidence / owner |
|---|---|---|
| Monorepo scaffold and toolchain | delivered | GH-170, `32784af` |
| Branding seam, working name, literal gate | delivered | GH-171, `b3a00a9` |
| Result contract and error table | delivered | GH-172, `b2914fd` |
| Config layer (layered, fail-closed, provenance) | delivered | GH-173, `d306c20`, TDR-0003 |
| State layer (durable, torn-state detection) | delivered | GH-174, `fc218c1`, TDR-0004 |
| pm-notes/registry validation, phase transitions | delivered | GH-179, `6fdd808` |
| Primitive ports, credential port, embedded metadata | delivered | GH-181, `f6c8d18` |
| Client seeds with trap catalogs (GitLab, Jira, GitHub read) | delivered | GH-188, `2314e55` |
| Interim mitigations (docs/config only) | delivered | GH-185, `77119b9` |
| verify change and exit taxonomy | in flight | GH-177 |
| provider v1 (quota, parks, fail-loud) | in flight | GH-182 |
| Privacy and no-cloud guards | in flight | GH-184 |
| status v1 (six collectors) | gap | GH-175 (blocked on nothing open; Jira read slice done) |
| queue ready (read-only readiness) | gap | GH-176 |
| verify gates v1 | gap | GH-178 (pairs with GH-177) |
| db session-admin port | gap | GH-180 |
| closeout v1 with branch cleanup | gap | GH-183 |
| Decision records + measurement baseline | gap | GH-186; this run seeds, that story ratifies |
| License registry (doc/legal) | partial (registry file exists and is populated; CI gate enforcement and owner confirmation of verdicts remain) | GH-187; `doc/legal/dependency-licenses.yaml` |
| Adapter conformance suite v1 | gap | GH-189 |

### 5.2 Knowledge-base gaps (this run's deliverables)

| Artifact | State | Produced in |
|---|---|---|
| Inception state and record | gap -> drafted this phase | phase 0 |
| Tribal knowledge record | gap -> drafted this phase | phase 0, graduates in phase 2 |
| Subproject north star / overview material | gap (`doc/overview/` holds README + glossary only) | phase 1 |
| Assumption and risk registers (four-risk) | gap | phase 2 |
| Tribal-knowledge graduation (glossary, rules, decision pointers) | gap | phase 2 |
| Architecture overview, component map, dependency graph, FSE audit | gap (ADR-0003 is the decision, not the map) | phase 3 |
| Tech-stack overview | gap (toolchain facts live scattered in configs) | phase 3 |
| NFR set (conditional) | gap (none committed for the subproject) | phase 3 |
| Decision seeds: adapter contract, release model, command naming lock | gap (open M0-S17 batch) | phase 3 |
| Glossary extension (tooling domain terms) | gap | phase 4 |
| Conventions/quality baseline audit (actual vs checklist) | partial (`.ai/rules/*` exist; never audited against the subproject) | phase 4 |
| Framework integration verification | exists; verify only | phase 5 |

### 5.3 M1-M3 (target: per roadmap sections)

Story sets exist at outline level in the backlog (M1-S1..S12, M2-S1..S10,
M3-S1..S9) covering attention (watchdog, doctor, SLA, brief, minimal MCP,
retro pipeline, harness adapters, dual-run), orchestration (queue/lanes/
dispatch, supervise, ceremony, board, steer, metrics, memory), and surfaces
(adapters completion, validators, policy engine, v1.0 readiness). No tickets
yet; refinement happens at milestone start. This run contributes: registers
(phase 2), architecture coverage of their seams (phase 3), and the phase 6
consistency check; it does not refine M1-M3 story content.

## 6. Hotspots and risks for the run

- **Doc churn from parallel delivery**: in-flight stories add feature specs
  and possibly decisions while phases run; every phase gate re-verifies rows
  D1, C4, F1 of the material inventory. Reconciliation, not snapshot, is the
  run's posture.
- **Error-table and contracts hotspots**: GH-177 and GH-182 both touch
  classification surfaces; the run's architecture overview must describe the
  union, and phase 6 re-checks.
- **Naming firewall**: every artifact this run writes must pass the
  forbidden-literal gate and the doc-distribution guard where applicable.
- **M2-S9 dependency**: bootstrap templates gain memory conventions in a
  later story; this run must not foreclose those seams (parked-concepts
  rule).

## 7. Low-confidence areas (flagged for human confirmation)

- `packages/mcp` and `packages/opencode` contents were name-checked only;
  deep scan happens in phase 3 (architecture reconstruction).
- The multi-user characteristic is set false (single-operator design today;
  shared/team state is future work per ADR-0003 and the state abstraction);
  confirm at gate 0.
- Whether `ubiquitous-language.md` should exist as its own artifact (domain
  language currently lives across concepts and the registry) or the glossary
  extension suffices; default is a thin artifact pointing at concepts.
