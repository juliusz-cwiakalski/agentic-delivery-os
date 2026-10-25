# Concept: naming and branding seam

Status: Draft (2026-10-25). Consolidates the branding decisions recorded
around ADR-0003 and the working-name decision (2026-10-24).

## Summary

Every name-derived value (binary, package scope, environment prefix, config
directory, state directory, MCP prefix, telemetry namespace, docs URL)
derives from a single branding constant behind one module. The working name
is `ados` until the final public name is decided. Command names are locked
before M0 ends because renames after the public release are API churn.

## Motivation

- The final public name is an owner decision that has not been made; the
  tooling cannot wait for it, and nothing may couple to a temporary name.
- A rename after release is public API churn across packages, docs, and
  user muscle memory. Renaming before release is a constant swap plus a
  migration drill.
- Scattered name literals are a correctness risk: one missed literal breaks
  the rename and leaks the internal working name.

## Design

- The branding module exposes the constant and every derived value. Nothing
  else in the codebase may hardcode a name literal.
- The environment override swaps the name at the freeze; packages stay
  private and a release-job publish guard blocks publication until the
  freeze (ADR-0003).
- The forbidden-literal test fails CI on any name literal outside the
  allowlist (the branding module plus the legacy adapter, per ADR-0003
  DEC-8); the scan covers new code, and the pre-existing corpus migrates
  separately. The seed legacy set (`ADOS_`, `~/.ados`) remains readable
  through the legacy adapter with a one-time warning.
- Command names: locked before M0 ends via a decision record or the
  man-page v1 acceptance. The registry groups commands into families so the
  daily loop reads in order; names follow the one-glance distinguishability
  and guessability rules.
- Command naming rules: each name has exactly one meaning in the delivery
  domain; near-synonym pairs are rejected (verify is evidence against
  reality, lint is document conformance; status is now, state is stores);
  domain nouns are not command names when the command does something
  narrower (phase bookkeeping is `phase`, not `change`; repository hygiene
  is `repos`, not `workspace`, which is the per-change artifact set).
- The rename drill is documented and rehearsed before the freeze: constant
  swap, legacy config migration once, docs and package scope update,
  forbidden-literal gate green.

## Guardrails

- New code and docs never hardcode names; reviews and CI both enforce it.
- The legacy set stays readable until the migration window closes (M4-S1).
- Command renames are frozen after M0; new commands follow the families.

## Story mapping

- M0-S2: branding seam, forbidden-literal test, legacy adapter, rename
  drill.
- M0-S17: command-name lock (decision record or man-page v1 gate).
- M4-S1: naming freeze and rename execution.
- M4-S2: publish guard release.

## Open questions

- The final public name (owner decision, deferred to before the first
  public release).
- Whether the MCP server prefix and telemetry namespace share one constant
  or two derived values.
