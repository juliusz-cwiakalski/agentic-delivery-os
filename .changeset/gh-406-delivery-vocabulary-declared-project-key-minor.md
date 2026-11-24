---
"@delivery-os/core": minor
"@delivery-os/adapters": minor
"@delivery-os/cli": minor
"@delivery-os/mcp": minor
"@delivery-os/opencode": minor
---

Establish the owner's delivery vocabulary — project, project repository, main
checkout, worktree, lane, work item, clone identity, declared project key — in
the ubiquitous-language overview and the glossary with lifetimes, correct the
two reversed sentences, and link the projects and project-groups feature specs
to the table. Add the declared-project-key contract purely additively
(`DECLARED_PROJECT_KEY_PATTERN`, grammar `^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$`,
with the predicate refusing the reserved state segments `unbound` and
`projects` exact-match), name the clone-identity pattern `CLONE_KEY_PATTERN`
beside the delivered `PROJECT_KEY_PATTERN` export kept as the same-value alias,
and serve `cloneKey` on the resolved project scope as a read of the marker's
identity. Correct the user-facing nouns: `projects list` prints PROJECT and
PROJECT REPOSITORY, `repos list` prints CLONE, board help states it takes a
clone identity, and reference text speaks the table — the `projects list
--flat` alias payload and text stay byte-identical, nothing is renamed, and
existing configuration including out-of-grammar group keys keeps loading. A
narrowed vocabulary conformance test enforces the delivered surfaces under the
four named exceptions, a new-code naming rule with a committed reason-bearing
baseline keeps the two concepts distinct in new source files, three fixtures
prove worktree identity sharing, per-clone state roots, and unchanged legacy
loading, and decision record ODR-0006 lands as `Proposed` for owner acceptance
at the pull request.
