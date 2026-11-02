---
id: TOOLING-INCEPTION-PHASE-3-QUESTIONS
status: Draft
created: 2026-11-01
last_updated: 2026-11-02
owners: [bootstrapper]
document_classification: working-analysis
links:
  related_changes: [GH-200]
summary: "Architecture review questions distinct from the carried Phase 2 questions and technical delivery gaps."
---

# Phase 3 open questions

## Reopening exit, 2026-11-02

OPEN-Q20 authorizes bounded integrated-source reconciliation, now written in
architecture, stack, NFR and decision-audit homes against `main-tools` `5330809`.
Thirteen records remain Proposed; Q12..16 stay DEFERRED at their original homes.
No new question, decision acceptance, validation threshold or discovery interview
is needed. Shared-root/bin/typed-host, live-write and pilot limits remain explicit.

Stable IDs continue at OPEN-Q12. OPEN-Q7..Q11 remain DEFERRED, not answered.
Gate 3 was explicitly approved on 2026-11-02 with these questions carried
forward. Phase 4 is authorized; substantive answers, repair routes and decision
acceptances are not inferred from that approval.

## OPEN-Q12: acceptance review scope and existing decision homes

**Status:** DEFERRED (owner approved Gate 3 with questions carried forward)

The [decision reconciliation](../analysis/phase-3-decision-reconciliation.md)
identifies twelve Proposed tooling records with null decision dates. No new
foundational seed appears necessary; retain the existing homes without
reselection. Should
the twelve-record acceptance review occur at the inception PR or through a
separate acceptance change? Framework-scoped Proposed records
are not implicitly in the batch. Session-admin C-11 privacy sign-off and license
determination are distinct approvals, not implied by this route choice.

The reconciliation also lists missing decision-index/register links. Choose a
bounded maintenance route with OPEN-Q11; this draft does not change those homes.

### Evidence reconciliation

- **Documented direction:** [ADR-0003](../../decisions/ADR-0003-oss-monorepo-structure.md)
  is Accepted; the twelve records in the reconciliation remain Proposed, not
  accepted by merge or this gate. Existing homes avoid redundant seed creation.
- **Engineering verification or repair routing:** verify metadata and missing
  navigation links; maintenance writes still need bounded authority.
- **Human decision:** record-specific acceptance/review route, C-11 privacy
  sign-offs and license determination remain separate acts.

### Answer

Pending owner review.

## OPEN-Q13: shared composition and executable integration follow-up

**Status:** DEFERRED (owner approved Gate 3 with questions carried forward)

`createRuntime` is declaration-only, CLI compositions are command-specific,
the CLI manifest has no `bin`, and the typed MCP/OpenCode packages are
placeholders. This is not a new stack choice. Reconcile shared production
composition with the existing M0-S1 task and route executable mounting through
normal delivery; identify the owning story/follow-up and artifact-backed smoke
for the first complete host path.
Recommended minimum: resolve config/brand, mount actual declared ports, run a
supported command, and inspect the classified result and persisted evidence.

GH-178 runnable verification and GH-183 closeout remain delivery concerns carried
under OPEN-Q7, not duplicated here. PR #215 is open for closeout at observation;
its code is not included in the architecture baseline.

### Evidence reconciliation

- **Documented direction:** Accepted ADR-0003 and [M0-S1](../../planning/oss-tooling/backlog.md#m0-s1-monorepo-scaffold-and-toolchain)
  already require one `createRuntime`; this is not an unowned design choice.
- **Engineering verification or repair routing:** [core](../../../packages/core/src/index.ts)
  still declares rather than implements it. Reconcile scaffold scope and prove
  production composition/host mounting; closure alone is not that evidence.
- **Human decision:** only a genuine scope/sequencing change needs a new choice;
  no owner reselection of shared-core composition is requested.

### Answer

Pending owner review.

## OPEN-Q14: platform and performance evidence boundaries

**Status:** DEFERRED (owner approved Gate 3 with questions carried forward)

The [NFR index](../../spec/nonfunctional.md) preserves per-feature budgets rather
than inventing a global SLO. What OS/runtime combinations are supported now versus
design targets? In particular, which reference environment and real Windows ACL
evidence should validate the current storage/session paths? Growing-ledger/fence
contention workloads and full-command latency remain unverified, distinct from
pure evaluator microbenchmarks. Assign a validation route before claiming those
operational guarantees; no threshold or platform certification is proposed as
already accepted.

### Evidence reconciliation

- **Documented direction:** ADR-0003 C-9/C-11 requires runtime neutrality and
  platform-qualified permissions, not a blanket platform certification.
- **Engineering verification or repair routing:** real Windows ACL, contention,
  growing-ledger and full-command evidence remains separate from microbenchmarks.
- **Human decision:** supported OS/runtime commitments and reference environment
  remain; no global performance threshold is invented.

### Answer

Pending owner review.

## OPEN-Q15: input-limit units and configured privacy coverage

**Status:** DEFERRED (owner approved Gate 3 with questions carried forward)

The FSE/NFR audit found a byte-named YAML source limit compared with string
length, not UTF-8 bytes. Route a targeted contract/implementation reconciliation
with multibyte negative controls rather than assuming the name proves the bound.
No parser source has been modified during bootstrap.

Separately, both hashed-literal classes in the privacy registry are empty and
reported as vacuous. Should the owner arrange private-side population and a
public-safe activation check, or explicitly accept that configured coverage gap?
Do not paste secret or private literal values into answers; only describe the
approved procedure. Generic rules and fixtures do not establish coverage for
unregistered project-specific literals. Registry writes remain subject to their
separate authorization route under OPEN-Q11.

### Evidence reconciliation

- **Documented direction:** [privacy authoring](../../spec/features/feature-privacy-guard.md#authoring-mode)
  already specifies local stdin-only input, no echo, digest-only records, no
  repository writes and CI refusal. No new authoring-method decision is needed;
  TDR-0006 itself remains Proposed.
- **Engineering verification or repair routing:** both [YAML](../../../packages/adapters/src/file/yaml-parser.ts)
  and [pm-notes](../../../packages/adapters/src/file/pm-notes-parser.ts) parsers
  compare `text.length` with a byte-named limit. Reconcile UTF-8 enforcement and
  multibyte controls rather than silently redefining units.
- **Human decision:** configured private-side coverage ownership/population or
  explicit gap disposition remains; activation evidence must be public-safe and
  registry writes separately authorized. Never supply raw literals here.

### Answer

Pending owner review.

## OPEN-Q16: scope of proposed NFR validation targets

**Status:** DEFERRED (owner approved Gate 3 with questions carried forward)

NFR-TOOL-009..013 describe proposed interrupted-mutation, caller accessibility,
local-operability, direct-attention, and evidence-integrity validations. They do
not replace owning feature contracts. Approve them as validation proposals for
later routing, narrow them, or carry them forward? Pilot ownership, direct
attention collection and early local completeness already sit under OPEN-Q7..Q9;
this question adds no duplicate ticket or implicit scope expansion.

### Evidence reconciliation

- **Documented direction:** existing feature contracts and [M4-S6](../../planning/oss-tooling/backlog.md#m4-s6-extension-hooks-open-source-side)
  already establish local completeness; Proposed validation targets do not amend them.
- **Engineering verification or repair routing:** map checks to those homes,
  distinguishing missing evidence from missing product direction.
- **Human decision:** approve/narrow/defer additional validation scope and any
  earlier check sequencing; pilot/outcome choices remain Q7..9. See the
  [four residual groups](../analysis/open-question-reconciliation.md#four-residual-human-review-groups).

### Answer

Pending owner review.
