---
ados_distribution: redistributable
id: GUIDE-PROVIDER-CONDITIONS-AND-PARKS
status: Draft
created: 2026-10-31
owners: ["engineering"]
summary: "Provider condition and park contract: the declared-zone basis, causes, resume times, budget ceilings, watch freshness, fail-loud announcements, and the configuration pointer."
links:
  related_changes: ["GH-182", "GH-350"]
---
# Provider Conditions and Parks

This guide is the operator-facing contract for the provider engine's pauses. It
describes what a provider condition is, why a park exists, when it resumes, and
why the engine never treats an indeterminate verdict as clear.

## Condition kinds

A provider entry is evaluated for these closed condition kinds:

- `peak-window` — the declared peak interval on its declared zone's clock,
  extended by its buffer. A window with no declared zone is evaluated in `UTC`;
  a declared IANA zone is evaluated in local seconds-of-day, so a policy never
  depends on the host's zone or on a shell profile.
- `quota-exhausted` — a subscription token limit is at or above its threshold.
- `budget-exhausted` — a declared spend ceiling is measured at or above its
  limit; a trailing-window ceiling parks, a ticket-scope ceiling fails.
- `provider-outage` — transport, HTTP, envelope, or parse failure.
- `credential-missing` — the declared credential reference cannot resolve.
- `credential-rejected` — the provider rejected the credential (HTTP 401/403).

Conditions are combined by the MAX rule: the later expiry wins, both kinds stay
visible, and the single park cause is the condition that determines the expiry.
The fixed tie order is `peak-window`, `quota-exhausted`, `budget-exhausted`,
`provider-outage`, `credential-missing`, `credential-rejected`.

Every peak park and its announcement carry the `timezone` evidence field with
the effective declared zone, including `UTC`.

## Park causes

Every park carries exactly one cause from the closed set:

- `peak-window`
- `quota-exhausted`
- `budget-exhausted`
- `provider-outage`
- `credential-missing`
- `credential-rejected`
- `chain-exhausted`
- `reevaluation-cap`

Provider parks are named `provider:<name>`; chain parks are named
`chain:<name>`. A park is never a blocked lane: it always describes provider
availability and always carries a resume time.

## Budget conditions

A declared `provider.budgets` ceiling turns spend into a pre-spawn gate. One
verified spend read per evaluation serves every declared ceiling, whatever the
count, and the measured figure is the figure `spend --ref` reports for the same
selection and instant. A measurement below the ceiling is clear. At or above it,
the outcome depends on the declared scope:

- `window` — the entry parks with cause and kind `budget-exhausted` and an
  expiry of `newestAtMs + windowSeconds × 1000`, which is strictly future by
  construction. `provider.budget.parked` is raised at `info`, once per park
  generation, with the five budget evidence fields.
- `ticket` — the entry fails and is skipped with reason `budget-exhausted`,
  with no park and no expiry. `provider.budget.crossed` is raised at `warning`
  with the same five fields. When nothing else can supply an honest resume, the
  run refuses `provider.budget.exceeded` at exit `1`, and the remedy is to raise or clear the ceiling, or to start a new ticket. A ceiling cannot reopen by itself.

The five budget evidence fields state the crossing: `budgetName` names the
ceiling, `budgetScope` records `ticket` or `window`, `budgetBasis` records
`cost` or `tokens`, `budgetMeasured` carries the measured figure, and
`budgetCeiling` carries the declared limit. The work-item ref appears in the
announcement or refusal message and is never a sixth field.

A budget park blocks paid substitution exactly as a peak park does, so no chain
makes a paid entry selectable while a subscription entry is budget-parked. A
ticket-scope crossing fails that one entry and leaves a later paid entry
selectable when the chain allows paid fallback: the failure names the entry
instead of inventing a ceiling-wide pause.

The gate needs one work-item ref, resolved from an explicitly supplied
ref-bearing fact (today the `simulate` fixture's `workItemRef`), otherwise from
the local delivery context at `.ai/local/pm-context.yaml` through the same seam
an omitted `spend --ref` uses. When a required ref cannot resolve, the run
refuses once with `input.value.rejected` before resolution, naming the enabled
budgets, the context path, and the remedy; it never measures zero, never reports
a clear skip, and never downgrades to a window-only evaluation. The read-only
members (`quota`, `parks list`, `profile resolve`, and `watch status`) need no
ref, and `simulate` reads its ref only from the fixture.

The stated limit is the one-spawn-increment pre-spawn bound: at most one spawn increment may land above a ceiling before the next evaluation observes the new records. A ceiling is therefore a pre-spawn gate and never a real-time spend stop. It is also not an alarm: the `metrics` burn-rate alarm reports a crossing over its declared trailing window and blocks nothing.

## Watch conditions

A watch reading carries exactly one condition from the closed six-value set
`clear`, `quota-exhausted`, `watch-stale`, `provider-outage`,
`credential-missing`, and `credential-rejected`.

`watch-stale` is the watch-only freshness condition and adds no park cause,
error identity, command, timer, cache, or state write. Each target declares
`maxAgeSeconds`, a positive integer with the policy default `900`; the age is
`floor((nowMs − observedAtMs) / 1000)` and a reading is stale exactly when
`ageSeconds >= maxAgeSeconds`. A park whose natural expiry is past the bound is
clamped to `observedAtMs + maxAgeSeconds × 1000`, and when that instant is not
strictly in the future no park is created and the observation reports
`watch-stale`. A live read observes at the read instant, so its age is `0` and
it never reports `watch-stale`; staleness is demonstrated only by
composition-supplied observations and by the clamp.

## Offline verification and migration

`provider simulate --fixture <path>` replays one bounded fixture through the
delivered engine: zero state writes, zero credential reads, zero network calls,
zero child spawns, and no local-context read. It takes its work-item ref from the
fixture only, so a declared budget can be exercised offline, and its resolve keys
match `provider resolve` for the same facts.

`provider migrate legacy` reads the legacy profile directory and the
pre-iteration hook as compatibility input under an assignment-only grammar,
prints a reviewable proposal, and discloses every name it could not map. It
refuses the whole run as `provider.migrate.refused` rather than emitting a
partial artifact, and `--write` creates the project-committed document only when
it does not already exist. It never executes, sources, or imports the hook.

## Resume and expiry semantics

A park has an absolute expiry strictly in the future at creation. Expiry is
derived at read time: a park is active while `expiresAt > now` and inactive at
`expiresAt <= now`. No timer, daemon, delete, or expiry write exists. An early
clear — a park observed gone before its expiry — appends one `cleared` record; a
park observed after expiry stays `expired` in `--all` views with no `cleared`
record. The next mutating resolve emits one informational `provider.resumed`
announcement in either case. Re-evaluating an unchanged park generation appends
nothing; a changed cause or expiry appends one new record.

## Fail-loud rule

An indeterminate availability verdict is never treated as clear. Every
transport, HTTP, envelope, parse, auth, or credential failure produces a
structured announcement plus a park or a classified error. The re-evaluation
loop cap parks instead of proceeding. An exhausted quota entry with no honest
reset is skipped as `quota-exhausted` and keeps its `provider.quota.reset_missing`
announcement while a later eligible entry may serve; when no later entry is
eligible and no honest park can supply an expiry, the resolve fails loud as
`provider.quota.exceeded` rather than fabricating a resume time. A skipped
entry's outage stays announced and parked so it remains visible when another
entry serves the chain.

## Announcement vocabulary

Announcements use a closed code set: `provider.peak.parked`,
`provider.quota.parked`, `provider.quota.reset_missing`,
`provider.quota.unreachable`, `provider.quota.http_error`,
`provider.quota.auth_rejected`, `provider.quota.malformed`,
`provider.credential.missing`, `provider.chain.exhausted`,
`provider.reevaluation.cap`, `provider.resumed`, `provider.budget.parked`, and
`provider.budget.crossed`. The first two, `provider.resumed`, and
`provider.budget.parked` are informational; the rest are warnings. Evidence is
closed to the fourteen park fields (the delivered eight plus `timezone` and the
five budget fields) plus `parkName`, `parkExpiresAt`, and `announcementCode`;
announcement evidence is projected at runtime through that closed
seventeen-field allowlist, so non-allowlisted keys are dropped. No raw body,
authorization header, credential value, or endpoint userinfo is retained.

## Configuration

Provider descriptors, credential references, and chains are declared under the
`provider` configuration branch; spend ceilings are declared under
`provider.budgets` and a watch target's freshness bound under
`provider.profiles.watch.<name>.maxAgeSeconds`. The field-level contract, shipped
defaults, and evaluation semantics are documented in the provider engine
specification (`doc/spec/features/feature-provider-engine.md`) and the provider
profiles specification (`doc/spec/features/feature-provider-profiles.md`); this
guide does not duplicate them. The shipped descriptor is overridable, and a
fresh installation ships no enabled chain, so a resolve fails closed until an
operator declares one.
