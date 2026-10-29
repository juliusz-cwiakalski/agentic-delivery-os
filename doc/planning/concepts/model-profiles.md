---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/model-profiles.md
---
# Concept: model profiles and AI provider routing

Status: Draft (2026-10-25). Feeds the M0-S17 naming lock (provider name,
profile class names) and a future profile-evaluation specification.

## Summary

The AI provider family owns agent-to-model routing. Profiles map agents to
models; profile classes (working names: lite, regular, powerful) group
profiles by task difficulty; delivery difficulty selects the class. The
coordinating agent proposes the difficulty, the lifecycle agent
cross-validates, and the running delivery selects the best matching profile
from the class group under quota and subscription constraints.

## Motivation

- Cost and quality should match per task: a small refactor does not need the
  same model tier as an architecture decision, and routing everything
  through one model either wastes budget or under-delivers.
- Agent-to-model mapping exists today as configuration and heuristics
  maintained by hand; it belongs in the provider family as typed, testable
  policy.
- Subscription-first routing means model choice is also a quota decision:
  the profile selection runs against quota windows and parks, not in
  isolation.

## Design

- Scope: this family manages AI model providers only. Tracker, VCS, and CI
  providers are adapters (agent-primitive-surface.md), not part of this
  family. The command help and docs make that distinction explicit; the
  naming lock (M0-S17) confirms the `provider` name or renames it now that
  the scope is explicit.
- Profiles: named agent-to-model mappings (which model each agent role uses
  for which activity), versioned as configuration, evaluated by the layered
  config chain.
- Profile classes (tiers): working names lite, regular, powerful. Each class
  maps the same agent set to different models by capability and price. A
  class is a group of profiles from which a delivery selects.
- Difficulty classification: the coordinating agent proposes the difficulty
  class for a change (with reasoning); the lifecycle agent cross-validates
  at intake; the running delivery selects the profile from the validated
  class group. Disagreement is surfaced, not silently resolved.
- Selection heuristics: best model for the job under quota, subscription
  state, and peak windows; hysteresis and fail-open come from the provider
  engine; every selection is recorded as a telemetry event with the
  profile, class, and reason.
- Tie-in: this concept is the user-facing shape of the ModelPolicy
  primitive (ModelPolicy, typed at M2, primitive-catalogue.md); spend records
  (the SpendRecord primitive) join selections to cost.

## Guardrails

- Profiles are data, never prompts: an agent never hand-picks a model
  outside the profile group; the escape hatch rules of the primitive
  surface apply.
- Class names are locked with the command names (M0-S17); lite, regular,
  powerful are working names.
- Selection heuristics are deterministic and replayable; experiments need a
  decision record.

## Story mapping

- M0-S13: the provider engine ships first (chain resolution, quota, peak
  windows, parks, fail-loud announcements).
- New story candidate: model profiles v1 (M2, with the ModelPolicy typed
  contract): profile schema, classes, difficulty classification flow,
  selection heuristics, telemetry join.
- M2-S6: metrics and spend consume the selection events.

## Open questions

- Final tier names (lite, regular, powerful are working names; alternatives
  at the naming lock).
- Who owns the cross-validation veto: coordinator proposal versus lifecycle
  validation precedence on disagreement.
- How difficulty is measured for the classification heuristics (change
  size, surface count, risk flags) and how it is re-scored mid-delivery.
