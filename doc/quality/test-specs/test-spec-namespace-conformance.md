---
ados_distribution: internal
id: TEST-SPEC-NAMESPACE-CONFORMANCE
status: Current
created: 2026-11-21
last_updated: 2026-11-21
owners: ["engineering"]
service: delivery-os
links:
  related_changes: ["GH-365"]
  feature_spec: doc/spec/features/feature-branding-seam.md
---

# Test Specification: Namespace Conformance

## Overview

The namespace-conformance battery protects one property: the product presents one
identity, and every prior-identity compatibility input is declared, bounded,
scanned and visible. It has two arms — a content arm over the scanned corpora and
a repository-tree arm over the tracked set — plus the migration battery that moves
the prior roots and a structural reconciliation of the shim registry. The two arms
read only repository content and git metadata; the migration battery runs over
scratch homes and checkouts. Every case is offline and deterministic.

## Test Scope

- **In scope:** the seven scope classes and the prior-namespace content class;
  the tracked-set arm and its two negative controls; the shim registry's shape,
  window, site presence and both-directions reconciliation; the `install migrate`
  domain and verb with its dry-run, backup, precedence, idempotence and recovery;
  the loaded-path and notice guarantees; the proof boundary constant.
- **Out of scope:** a real operator home, a second physical machine, a CI runner's
  home, other checkouts, third-party alias consumers, the real shim-removal
  release, the prose residual, and the shell fallback's behaviour after a
  migration. Those are the not-proven list below.

## The content arm

`bun run scripts/checks/forbidden-literals.ts` scans seven scope classes:
`packageTree`, `rootManifests`, `rootWorkspaceFiles`, `ignoreRules`,
`promptSurface`, `scriptSurface`, and `userFacingDocs`. Six carry the
`priorNamespace` class; `rootWorkspaceFiles` carries only the delivered DEC-8
seed class. The prior-namespace seeds are the prior configuration directory, the
prior state root, the prior home configuration path, the prior environment prefix,
and the prior executable token; the executable seed excludes the `@` scope sigil
and the repository name.

Every match must lie inside a declared shim site, a declared corpus, or a neutral
site. presence is validated for every declared shim site; a match and its
occurrence budget are validated only for a site inside a scanned corpus. A
declaration-only site — an unregistered document or a `tests/**` fixture — is
present and may record zero matches. A match resolves to the shim whose literal is
the longest match at that position, so the working-name override resolves to
`prior-working-name-override` while a bare prefix occurrence resolves to
`prior-environment-prefix`.

Declared corpora: the historical change artifacts, the decision records, the M1
snapshot command pages, and one dated inception analysis record. Neutral sites:
the private root manifest name, the generated lockfile, and the resolver's
scope-org derivation input. The frozen ADR-0003 DEC-8 path allowlist does not
filter this class; the shim registry is its only site authority.

The real-tree run must report seven classes and zero undeclared occurrences. The
per-class mutations plant one occurrence in each carrying class and must fail by
name; the non-carrying class stays green for the prior seed and fails for its
delivered seed. The neutral-scope controls keep the `@` sigil, the repository
name and the scope-org neutral site green while a product-identifier use and an
unscoped package name fail by name.

## The tree arm

`bun run scripts/checks/namespace-tree.ts` reads the tracked set and asserts:
zero tracked paths under a declared prior-namespace root, zero tracked symlinks
whose target resolves into one, the committed project layer present, the
runtime-written project files ignored by the repository's own rules in a
rule-world, and no tracked runtime-written project file. The prior-root prefix set
is read from the declaration — the shim registry's prior config-directory and
state-root literals cross-checked with the forbidden-literal registry's home-form
seed — never a hardcoded list, and the arm reports the set it used.

Two negative controls fail by name: a tracked `current-layer` symlink into the
prior configuration root, and a tracked file under either declared prior prefix.
The declared-prefix property is distinguished from the real-tree checks: a
narrowed prefix set fails the reported-set equality while the real-tree
assertions stay green (per-assertion attribution).

## The shim registry

`scripts/checks/namespace-shims.registry.json` (`namespace.shims.v1`) declares one
entry per shim with its id, kind, literal, direction, lineage, notice id and text,
window, owner, and sites. Every delivery lineage entry has a removal release
strictly after its declared-in release; every pre-freeze lineage entry declares
`removalRelease: null` and its owner. A declared site is a file path or a path
prefix ending in `/`; a wildcard is refused. Every declared site is present in the
tree. The two lineages' content sites are disjoint; the two registry documents
self-declare both lineages.

The delivery window pair derives from the change's single minor changeset: the
release that ships this change is `declaredIn`, and the next minor is
`removalRelease`. A missing or duplicated changeset fails by name.

## The migration battery

`tests/behaviour/install-migrate.test.ts` drives the `install migrate` verb over
scratch homes and checkouts with an injected filesystem, clock, daemon port and
failure ordinal. Cases cover the admission refusals and grammar, the daemon guard
and stop-before-first-move ordering, the bounded dry-run plan with zero writes,
the verified backup and `install.migration.manifest.v1` manifest written before the first move, and the bounded `install.migration.plan.v1` payload, the per-entry
disposition matrix and verdict composition, the derived entry outside the move
set with its source-side residual, idempotence and the never-existent root, the
injected partial failure and recovery, byte preservation with no re-versioning,
and the post-move state locations. Every mode asserts zero records of any kind
with the command-audit dependency composed and recording.

## Fixtures and seams

- `tests/fixtures/namespace/{shim-registry,seeds,evidence,pre-freeze-env,tree}.ts`
  and `tests/fixtures/namespace/golden/notices.ts`: the registry loader and
  mutants, the per-class seed corpus, the proof-boundary constant and rows, the
  pre-freeze environment data, the synthetic tracked tree and rule-world probe,
  and the committed notice lines.
- `tests/fixtures/entrypoint/prior-identity/harness.ts`: the scratch checkout and
  home, the counting and recording filesystem facts, and the composed run.
- `tests/fixtures/migration/{roots,filesystem,manifest,plan,guards}.ts`: the three
  seeded roots and per-row destination states, the recording filesystem and the
  failure ordinal, the manifest reader and digest comparator, the double-run
  canonicaliser, and the ordering recorder.
- Every migration case runs over a scratch root under the repository's approved
  temporary directory; no fixture reads or writes the operator's real home.

## Proof boundary

The machine-checked source is `NAMESPACE_PROOF_BOUNDARY` in
`tests/fixtures/namespace/evidence.ts`. **Proven (8, in order):**
`committed-layer`, `clean-clone`, `authoritative-root`, `prior-notice`,
`migration-plan`, `migration-move`, `shim-reconciliation`,
`conformance-negative-controls`. **Not proven (8, in order):**
`real-operator-home`, `second-machine-clone`, `ci-runner-home`,
`other-checkouts`, `third-party-alias-consumers`, `shim-removal-release`,
`prose-residual`, `shell-fallback-post-migration`.

A page/constant mismatch is a documentation-phase defect, never a delivery-case
failure: the boundary case asserts the machine-checked constant, and the
documentation reconciliation republishes the same two lists in the declared order.
