---
id: TOOLING-INCEPTION-PHASE-4-QUALITY
status: Draft
created: 2026-11-02
last_updated: 2026-11-06
owners: [bootstrapper]
document_classification: working-analysis
ados_distribution: internal
links:
  related_changes: [GH-200, GH-251]
summary: "Actual conventions, CI, security and development-environment audit with bounded Phase 4 findings."
---

# Phase 4 quality baseline

## Authorized reopening disposition, 2026-11-02

OPEN-Q20 bounds this remediation against integrated `main-tools` `5330809`.
The original audit below is dated evidence, superseded for READY-B1/B3/B4 by:

- **B1:** exactly the 37 membership failures enumerated by the readiness
  assessment are registered in `forbidden-literals.registry.json`. Only the
  `registered` array changes; rules, caps, seeds, baseline and exclusions do not.
  Rerun `bun run scripts/checks/forbidden-literals.ts`: **exit 1**, zero missing
  memberships, **11 literal violations across six existing files**. Registration
  exposed content previously not scanned; it did not introduce those literals.
  No literal repair or exemption beyond the 37 memberships was authorized at
  that point, so READY-B1 remained blocking; exact findings were in the Phase 6
  report. HISTORICAL: superseded by commit `dde826a`, which registered the
  remaining post-baseline inception records and reworded the eleven literal
  sites to seam-derived descriptions (guard pins untouched); the guard and the
  full battery are green and READY-B1 is cleared in the Phase 6 rerun.
- **B3:** seven exact glossary rows applied. The integrated GH-178 recovery had
  already removed the identical Acronyms duplicate; exactly one Terms row remains
  with closeout and verify-gates content preserved. See [graduation](phase-4-glossary-graduation.md).
- **B4/profile exemption:** no explicit profile file is produced in this bounded
  subproject run. The existing [handbook fallback](../../documentation-handbook.md#missing-profile-fallback-required)
  plus state `project.profile: engineering-repo` is the equivalent home for
  classification and write boundaries. Business documentation stays disabled.
  This is an explicit catalog exemption under OPEN-Q20, not framework regeneration
  or a general exemption for other projects.
- **B4/setup equivalent home:** the contributor path and value-free environment
  reference immediately below are the bounded development-environment artifact.
  No dedicated shared guide, dotenv loader or mandatory `.env.example` is created.

### Contributor setup and value-free environment reference

1. Use git and a shell for existing automation, the Bun version in
   [`.bun-version`](../../../.bun-version), and pnpm from root
   [`packageManager`](../../../package.json). Node compatibility probes are scoped
   by the state/export contracts, not a promise of full Node application support.
2. From the repository root, run `pnpm install --frozen-lockfile` after reviewing
   dependency installation, then `pnpm build`. No install was executed in this audit.
3. Use `pnpm typecheck`, `pnpm test`, and `pnpm check:boundaries`; lifecycle scripts
   build where declared. `pnpm check` is the aggregate described below, not all CI.
   Privacy/branding and shell suites are separate. Packed export parity requires
   the declared tooling; do not bypass failing checks or assume network independence
   for installation, audits or provider-backed work.
4. Ordinary deterministic tests use injected/offline facts and mocked providers;
   no provider credential is a prerequisite for that tier. Live checks require
   separately configured services and explicit opt-ins from the
   [live workflow](../../../.github/workflows/conformance-live.yml). A not-configured
   result is not live success. No broad test or install success is asserted here.
5. This is an in-process typed CLI library, not an installed executable: no CLI
   `bin`, shared callable `createRuntime`, typed MCP server or typed host execution.
   Existing [framework installation](../../../README.md#installation) is separate.
   Production closeout composition and `verify change | gates` now exist; this
   does not establish those missing shared/distribution surfaces.

Environment facts are supplied by the actual process/caller and credential
references. The audited variable-name inventory below and config/live feature
homes are the reference; do not invent universal credential keys or copy values.
`CI` controls workstation-layer defaults, XDG/Windows directory facts participate
in platform path selection, and config/catalog selectors derive from branding.
Optional `CONFORMANCE_LIVE_` names belong to the workflow, not required local-test
settings. `LOG_TOKENS`/`LOG_STREAM` are rejected logging switches, not setup advice.
No automatic dotenv loading is demonstrated, so `.env.example` is **not applicable
as a mandatory artifact**. Never paste tokens or credentials; confirm only which
services are configured. Platform support remains qualified by actual Linux CI
and recorded Bun/Node probes; Windows/macOS outcomes are not certified.

## Evidence and scope

Draft for Gate 4 only, inspected at HEAD `35565b9` on 2026-11-02, integrating
`main-tools` `3ebc61f`. Gate 3 is approved with OPEN-Q12..Q16 carried forward.
No runtime suite, installation, destructive command, tracker edit or decision
acceptance is part of this audit. `existing` means inspected mechanism/contract;
`not-reverified` means execution/effectiveness was not checked; `gap` means missing
evidence or a concrete mismatch. Labels can coexist. File presence is not PASS.

Shared framework is verify-only: [AGENTS](../../../AGENTS.md), rules, handbook,
templates, agents/commands and workflows remain untouched. Missing documentation
profile invokes engineering-repo behavior; no business artifacts are activated.
The [Phase 3 audit](fse-audit.md), [architecture](../../overview/architecture-overview.md),
[stack](../../overview/tech-stack.md) and [NFR index](../../spec/nonfunctional.md)
retain their evidence limitations and Proposed targets.

## Actual conventions and ten-attribute trace

Each row extends the corresponding FSE-01..10 finding, not a replacement verdict.

| Attribute / Phase 3 trace | Phase 4 deeper inspection | Evidence status / remaining boundary |
|---|---|---|
| Explicit typing / [FSE-01](fse-audit.md#fse-01-explicit-typing) | [TS rules](../../../.ai/rules/typescript.md) require narrowing unknown input, absent optional fields and reasoned escapes; [compiler config](../../../tsconfig.base.json) enforces strict flags. | existing; typecheck not-reverified; third-party declarations excluded by skipLibCheck. |
| SRP modules / [FSE-02](fse-audit.md#fse-02-single-responsibility-modules) | Six [package manifests](../../../packages/cli/package.json), pure policy/injected edges and [boundary config](../../../.dependency-cruiser.cjs) encode separation. | existing; shared composition remains declaration-only, not an operational root. Cohesion concerns remain review candidates, not proven violations. |
| Conventions over configuration / [FSE-03](fse-audit.md#fse-03-conventions-over-configuration) | One lockfile/pinned tools, common package scripts, `bun:test`, separate tools/scripts naming; [installer rules](../../../.ai/rules/installer.md) complement [Bash rules](../../../.ai/rules/bash.md). | existing; TS prose omits delivered provider runtime exceptions and testing prose omits parts of the current script chain. Follow checker truth, route prose repair separately. |
| Semantic naming / [FSE-04](fse-audit.md#fse-04-semantic-names) | [UL draft](../../overview/ubiquitous-language.md) separates primitives, commands, engines, model classes, leases and readiness meanings. | draft, not completed graduation; the YAML byte-named source limit is now byte-enforced with boundary tests (GH-251). |
| Automated tests / [FSE-05](fse-audit.md#fse-05-automated-tests) | Test tiers and negative controls below are configured; shell CI now aggregates child statuses through `scripts/run-bash-suites.sh` and proves propagation with a committed negative control. | existing tests; GH-251 repaired the shell failure-propagation gap below and the full local runner set passed 24/24 on 2026-11-06. No live/pilot claim. |
| Linters/formatters / [FSE-06](fse-audit.md#fse-06-linters-and-formatters) | [Biome](../../../biome.json) owns workspace style, excludes dist/node_modules/tmp and selected fixtures; overview Markdown is outside includes. | existing; docs need separate checks. ShellCheck CI gates errors, not all warnings; shfmt is a rule, not an inspected CI gate. |
| Readable history / [FSE-07](fse-audit.md#fse-07-readable-git-history) | [CI](../../../.github/workflows/ci.yml) runs commitlint against PR and integration ranges. | existing configuration; historical audit not repeated. A subject/closed issue cannot prove behavior or approval. |
| Contextual comments / [FSE-08](fse-audit.md#fse-08-contextual-comments) | Config-source comments explain eligibility-before-read; CLI edge explains injected branding and acquisition ownership. | existing sampled rationale; whole-tree freshness not-reverified. CI's shell-suite comment now matches the runner aggregation contract (GH-251). |
| Supportable stack / [FSE-09](fse-audit.md#fse-09-popular-supportable-stack) | Bun/pnpm pins, Linux CI, packed export checks and dependency audits exist. No dedicated contributor setup or env template found. | existing mechanisms; setup, offline completeness, Windows/macOS and maintenance costs not-reverified. |
| AI rules / [FSE-10](fse-audit.md#fse-10-ai-instructions-and-rules) | Canonical `.opencode/` sources generate the plugin mirror; CI checks generated parity. Memory is advisory untrusted data. | existing ownership; no prompt regeneration here, no compliance inference from instruction presence. |

## Commands and testing tiers

These command names come from the actual [root scripts](../../../package.json),
not a proposed CLI installation recipe. Nothing in this table was executed here.

| Root command | Actual scope |
|---|---|
| `pnpm build` | Recursive package builds; core also generates configuration artifacts. |
| `pnpm lint`, `pnpm format:check` | Biome lint and non-writing format check. |
| `pnpm typecheck` | Recursive checks plus test type fixtures; pretypecheck builds first. |
| `pnpm test` | Bun test discovery; pretest builds first. Direct Bun invocation does not supply that lifecycle build. |
| `pnpm check:boundaries` | dependency-cruiser, ambient-global AST guard, workspace entrypoints and secret-read boundary; build first because exports resolve dist. |
| `pnpm check` | lint, format, typecheck, tests, boundaries and packed exports parity, not every CI job. |
| `pnpm check:privacy-literals`, `pnpm check:forbidden-literals` | Separate privacy working-tree scan and branding/corpus-membership guard. |

The [testing strategy](../../../.ai/rules/testing-strategy.md) owns module-to-test
mapping. Current tiers: structure/export/type fixtures; forbidden-import and
ambient-global boundary fixtures; deterministic behavior/golden/performance tests;
repository-check mutation tests; capability-aware mocked conformance; scheduled
live read-only evidence. Shell/tool suites sit in adjacent `.tests/` directories.
No new runner/framework or duplicate testing strategy is generated.

Mandatory negative controls are part of the contracts, not optional polish:
each forbidden edge must have a named failing fixture plus clean allowed controls;
checker mutations must fail for the intended field; secret/output canaries,
privacy synthetic class activation, license deny/compound cases, broken-adapter
conformance and delivery result mutation controls must remain effective. See
[scaffold QA](../../spec/features/feature-monorepo-scaffold-toolchain.md#quality-assurance-strategy)
and [conformance](../../spec/features/feature-adapter-conformance.md). Presence of
these tests is not fresh success, provider mutation parity or complete coverage.

## CI baseline and concrete failure-propagation finding

[CI](../../../.github/workflows/ci.yml) runs on pushes to main, main-tools,
feat/** and fix/**, and PRs targeting main/main-tools. It does not run on every
branch push: this docs branch needs an eligible PR event for that workflow.
Separate jobs cover TS, exports, pins, invariants, license/vulnerabilities,
branding/privacy, commitlint, shell tests and shared generated-doc/plugin guards.
Linux jobs do not establish a cross-platform support matrix. TS actions are
SHA-pinned; some legacy action references remain mutable. All job results are
not-reverified here.

**Concrete gap (repaired by GH-251):** `bash-tests` previously invoked each
suite through `find ... -exec bash {} \;`. A nonzero child made that predicate
false but did not make a successful traversal fail, so outer `set -e` did not
reliably fail this job on a failed suite, despite its comment. The read-only
control on the existing root manifest, `find package.json -exec false {} \;`,
returned **0**, verifying the command semantics. GH-251 replaced this path with
`scripts/run-bash-suites.sh`: the runner discovers the same suite scope, executes
every discovered suite once, aggregates each child's exit status, names every
failing suite, and fails the job if and only if suite discovery fails or a
discovered suite fails or cannot run. A
committed self-verifying negative control plants a deliberately failing
synthetic suite and asserts the runner exits non-zero, so every green run
demonstrates propagation. The `bash-tests` comment now states this contract. The
repair is covered by the runner contract suite, the negative control, and the
DEC-7 non-vacuity fixtures; the original
[OPEN-Q19](../open-questions/phase-4-open-questions.md#open-q19-shell-suite-ci-failure-propagation)
record remains as the historical finding and is reconciled during the
system-spec update phase. Separately invoked guard jobs are not thereby proven
broken.

## Development, installation and environment baseline

- **Existing:** [README installation](../../../README.md#installation) and
  [onboarding](../../guides/onboarding-existing-project.md) describe installing
  the delivery framework, not a typed binary. The root pins pnpm `10.18.3` and
  Bun `1.4.4`; CI demonstrates frozen-lockfile installation configuration.
  No installation was run. Installer guidance requires consent for dependencies,
  no automatic sudo, secure downloads and explicit platform/PATH handling.
- **Missing:** `doc/guides/dev-setup.md` and `.env.example` are absent; no
  alternative dedicated dev-setup-named guide was found. Existing harness setup
  guides are not a complete monorepo contributor path. A proposed setup guide
  would link pins, script order, external prerequisites, local-only versus
  network-backed checks, and the actual executable/composition limits.
- **Not delivered:** all six package manifests remain private; CLI has no `bin`.
  In-process `runCli` and command-specific edge composition are not an installed
  executable. Shared `createRuntime`, typed MCP and typed host entry remain
  placeholders. Existing shell/plugin installation is a separate path.
- **Platform evidence:** CI is Ubuntu. Config supports Linux/macOS/Windows path
  mappings; state has POSIX mode and Windows ACL code. Real Windows/macOS success
  and complete offline operation are not established (OPEN-Q13/14/16).

Environment-only credentials do **not** establish dotenv-file loading. Inspected
[config acquisition](../../../packages/adapters/src/file/config-source.ts),
[CLI edge](../../../packages/cli/src/edge.ts) and [credential adapter](../../../packages/adapters/src/credentials/index.ts)
use injected environment facts and credential references; no dotenv loader was
found in the inspected package dependencies/acquisition path. Fixed safe variable
names observed include `DELIVERY_OS_WORKING_NAME`, `CI`, `XDG_CONFIG_HOME`,
`XDG_CONFIG_DIRS`, `PROGRAMDATA`, `APPDATA`, `LOG_TOKENS`, `LOG_STREAM`.
The last two are parser logging switches rejected when active, not setup advice.
Config selector and catalog environment names derive from the resolved branding
prefix; credential source keys come from declared references, not invented keys.

[Live conformance workflow](../../../.github/workflows/conformance-live.yml)
declares optional provider-specific `CONFORMANCE_LIVE_` settings and credential
sources, for example `CONFORMANCE_LIVE_GITHUB_BASE_URL`,
`CONFORMANCE_LIVE_GITHUB_TOKEN`, `CONFORMANCE_LIVE_GITLAB_TOKEN` and
`CONFORMANCE_LIVE_JIRA_TOKEN`. These are variable names only, not credential
values or mandatory local-test configuration. Missing settings yield explicit
not-configured evidence, not a successful configured live run. Optional live
settings remain canonical in that workflow and its feature contract.

**Template applicability is proposed, not settled:** a value-free environment
reference may suffice without `.env.example`; if the owner requires a template,
document that it is a reference rather than claim automatic loading. Do not
invent keys, copy credentials/values or dump environment contents.
[OPEN-Q17](../open-questions/phase-4-open-questions.md#open-q17-dev-setup-and-environment-reference-applicability)
owns this choice. Shared guides are verify-only under this run's scope guard;
the general bootstrap write allowlist alone does not authorize regenerating them.

## Security, dependency, license and privacy baseline

Existing controls: credential-port-only secret resolution; config layer source
restrictions; edge-registered value redaction; metadata content policy; verified
local JSONL with fenced writes and restrictive permissions. Limits remain:
redaction covers registered values, checksums are not adversarial authentication,
only local state is implemented, and session administration is separately owned.
See [NFR-TOOL-004..008](../../spec/nonfunctional.md) for evidence and qualifications.

[License audit](../../../scripts/checks/license-audit.ts) enforces the
[registry](../../legal/dependency-licenses.yaml), deny precedence and exact-version
closure evidence; mechanical verdicts do not establish human license determination.
[Vulnerability gate](../../../scripts/checks/vulnerability-gate.ts) invokes pnpm
audit at high/critical severity and fails closed on unusable results; it is not
an offline or all-severity security certification. [Release](../../../.github/workflows/release.yml)
is manual/publish-guarded, not proof of a shipped signed standalone binary.

Privacy rejects credential-shaped material rather than reproducing it. No
private-side context or environment values were needed for these drafts.
The working-tree guard does not scan history; both project-specific hashed
classes remain empty with declared reasons. Generic rules and synthetic tests
do not prove detection of unregistered private terms (OPEN-Q15).
Branding had **25 document-membership failures before these five drafts**;
registry remediation remains OPEN-Q11. A failed membership guard is not clean
certification. Existing framework/generated-plugin files remain verify-only:
canonical prompt sources live in `.opencode/`, the generated plugin mirror must
never be hand-edited. No generator ran during this phase.

## Unknown-unknowns challenge and pre-mortem

What artifacts or guarantees are still missing? A contributor could follow
framework installation instructions and wrongly expect an executable, omit
optional credentials yet read exit zero as live success, or trust a shell CI
job whose failed child status was discarded. Months later, nominal green gates
could hide regressions while maintenance consumes the expected attention relief.
This is a hypothetical pre-mortem, not a claim that a suite actually failed.

- **Value:** setup and evidence chores may increase attention rather than reduce
  it (RSK-001/008); direct measurement remains OPEN-Q8, not proxy relabeling.
- **Usability:** no GUI is present (`ui_bearing=false`); screen inventory, graphical
  UX guidance and UI rules stay inactive. Terminal/plain-text readability remains
  proposed NFR-TOOL-010, distinct from a completed accessibility assessment
  (RSK-002/009, OPEN-Q16).
- **Feasibility:** prove fail propagation with negative controls, then separately
  verify production composition and actual gate/mutation behavior (RSK-003/004/005).
- **Viability:** keep security/license approval, private coverage and maintenance
  cost explicit instead of equating file presence with effectiveness (RSK-006/007/008).

All risks link to the existing [register](risks.md#register); no new assignment,
backlog item or acceptance criterion is silently adopted. Deferred OPEN-Q7..Q16
remain deferred; Gate 4 questions supplement rather than reopen those choices.
This baseline is not Phase 5 integration or Phase 6 readiness approval.

## Draft verification

Strict recursive duplicate-key frontmatter parsing, local links/anchors and
new-file whitespace/dash checks cover all five drafts. The privacy scan reports
1490 files, seven rules and zero violations, with both hashed classes vacuous.
Branding fails on 30 document memberships: 25 existing plus these five drafts;
no literal violations were reported. No green suite or clean membership claim
is made. The shared registries remain untouched.
