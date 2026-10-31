---
ados_distribution: redistributable
id: GUIDE-PROVIDER-CONDITIONS-AND-PARKS
status: Draft
created: 2026-10-31
owners: ["engineering"]
summary: "Provider condition and park contract: causes, resume times, fail-loud announcements, and the configuration pointer."
links:
  related_changes: ["GH-182"]
---
# Provider Conditions and Parks

This guide is the operator-facing contract for the provider engine's pauses. It
describes what a provider condition is, why a park exists, when it resumes, and
why the engine never treats an indeterminate verdict as clear.

## Condition kinds

A provider entry is evaluated for these closed condition kinds:

- `peak-window` — the declared UTC peak interval, extended by its buffer.
- `quota-exhausted` — a subscription token limit is at or above its threshold.
- `provider-outage` — transport, HTTP, envelope, or parse failure.
- `credential-missing` — the declared credential reference cannot resolve.
- `credential-rejected` — the provider rejected the credential (HTTP 401/403).

Conditions are combined by the MAX rule: the later expiry wins, both kinds stay
visible, and the single park cause is the condition that determines the expiry.

## Park causes

Every park carries exactly one cause from the closed set:

- `peak-window`
- `quota-exhausted`
- `provider-outage`
- `credential-missing`
- `credential-rejected`
- `chain-exhausted`
- `reevaluation-cap`

Provider parks are named `provider:<name>`; chain parks are named
`chain:<name>`. A park is never a blocked lane: it always describes provider
availability and always carries a resume time.

## Resume and expiry semantics

A park has an absolute expiry strictly in the future at creation. Expiry is
derived at read time: a park is active while `expiresAt > now` and inactive at
`expiresAt <= now`. No timer, daemon, delete, or expiry write exists. An early
clear appends one `cleared` record, and the next mutating resolve emits one
informational `provider.resumed` announcement. Re-evaluating an unchanged park
generation appends nothing; a changed cause or expiry appends one new record.

## Fail-loud rule

An indeterminate availability verdict is never treated as clear. Every
transport, HTTP, envelope, parse, auth, or credential failure produces a
structured announcement plus a park or a classified error. The re-evaluation
loop cap parks instead of proceeding. An exhausted quota with no honest reset
fails loud as `provider.quota.exceeded` rather than fabricating a resume time. A
skipped entry's outage stays announced and parked so it remains visible when
another entry serves the chain.

## Announcement vocabulary

Announcements use a closed code set: `provider.peak.parked`,
`provider.quota.parked`, `provider.quota.reset_missing`,
`provider.quota.unreachable`, `provider.quota.http_error`,
`provider.quota.auth_rejected`, `provider.quota.malformed`,
`provider.credential.missing`, `provider.chain.exhausted`,
`provider.reevaluation.cap`, and `provider.resumed`. The first two and the last
are informational; the rest are warnings. Evidence is closed to the eight park
fields plus `parkName`, `parkExpiresAt`, and `announcementCode`; no raw body,
authorization header, credential value, or endpoint userinfo is retained.

## Configuration

Provider descriptors, credential references, and chains are declared under the
`provider` configuration branch. The field-level contract, shipped defaults, and
evaluation semantics are documented in the provider engine specification
(`doc/spec/features/feature-provider-engine.md`); this guide does not duplicate
them. The shipped descriptor is overridable, and a fresh installation ships no
enabled chain, so a resolve fails closed until an operator declares one.
