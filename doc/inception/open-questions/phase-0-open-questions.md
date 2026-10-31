# Phase 0 open questions (GH-200 run)

Stable IDs, monotonic per phase. Status: OPEN | ANSWED | DEFERRED.

## OPEN-Q1: multi_user characteristic set to false

The tooling is single-operator today (local-first state, solo use); shared or
team state is future work behind the state abstraction. Setting
`multi_user: false` skips personas/JTBD artifacts for this run.

**Status:** OPEN (confirm at gate 0)

### Answer

_(pending owner)_

## OPEN-Q2: ubiquitous-language artifact scope

The glossary already has a "Related UL term" column and ~70 tooling terms;
the domain language otherwise lives across the concepts corpus. Default
plan: produce a thin `doc/overview/ubiquitous-language.md` that maps
bounded-context vocabulary (delivery, adapters, state, config, branding,
harness) to their concept and glossary homes, rather than redefining terms.

**Status:** OPEN (confirm default at gate 0 or defer to phase 4)

### Answer

_(pending owner)_

## OPEN-Q3: reconciliation stance for in-flight stories

GH-177, GH-182, GH-184 are mid-delivery and will merge during this run,
adding feature specs and classification content. Proposed stance: the gap
map tracks them as in-flight; each phase gate re-verifies affected inventory
rows; phase 6 runs the full consistency check against whatever is merged by
then. No phase blocks on their PRs.

**Status:** OPEN (confirm at gate 0)

### Answer

_(pending owner)_
