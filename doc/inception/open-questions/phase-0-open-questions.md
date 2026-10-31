# Phase 0 open questions (GH-200 run)

Stable IDs, monotonic per phase. Status: OPEN | ANSWED | DEFERRED.

## OPEN-Q1: multi_user characteristic set to false

The tooling is single-operator today (local-first state, solo use); shared or
team state is future work behind the state abstraction. Setting
`multi_user: false` skips personas/JTBD artifacts for this run.

**Status:** ANSWERED (gate 0, 2026-10-31)

### Answer

Correct, for now we build for single user operating locally.

## OPEN-Q2: ubiquitous-language artifact scope

The glossary already has a "Related UL term" column and ~70 tooling terms;
the domain language otherwise lives across the concepts corpus. Default
plan: produce a thin `doc/overview/ubiquitous-language.md` that maps
bounded-context vocabulary (delivery, adapters, state, config, branding,
harness) to their concept and glossary homes, rather than redefining terms.

**Status:** ANSWERED (gate 0, 2026-10-31) - build the artifact; resolve overlap with the primitive catalogue during phase 4

### Answer

yes, let's start building it, also see [primitive-catalogue.md](../../planning/concepts/primitive-catalogue.md) - we
also need to figure out how to avoid overlap between ubiquitous and primitives catalogue

## OPEN-Q3: reconciliation stance for in-flight stories

GH-177, GH-182, GH-184 are mid-delivery and will merge during this run,
adding feature specs and classification content. Proposed stance: the gap
map tracks them as in-flight; each phase gate re-verifies affected inventory
rows; phase 6 runs the full consistency check against whatever is merged by
then. No phase blocks on their PRs.

**Status:** ANSWERED (gate 0, 2026-10-31) - track in-flight; merge main-tools into the inception branch after each delivery merge; worktrees readable for in-progress state

### Answer

Let's keep track of waht is in progress/delivered and if change is finalized and merged to main-tools then let's merge
main-tools into the inception branch so we have most recent state at the inception branch. Additionally you can peek
into worktrees where delivery in progress happens in case you need to see what is delivered.

Pull requests already created so close to be finalized:
- https://github.com/juliusz-cwiakalski/agentic-delivery-os/pull/203
- https://github.com/juliusz-cwiakalski/agentic-delivery-os/pull/202
- https://github.com/juliusz-cwiakalski/agentic-delivery-os/pull/201
