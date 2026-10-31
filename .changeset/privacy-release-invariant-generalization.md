---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Generalize the release-shape invariant (TC-RELEASE-001) so it validates any
delivery's changeset instead of pinning the file name of the delivery that
introduced it: the single added changeset is derived from the diff against the
base branch, the pre-existing byte-identity check skips that derived file, and
the five-package/body validation plus the mutation probes run against it. The
pre-existing-count assertion becomes a non-vacuity bound. The delivery-specific
wording pins ("privacy", "content policy") are dropped because they asserted
one historical delivery, not the invariant.
