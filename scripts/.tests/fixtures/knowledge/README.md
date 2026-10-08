# Knowledge behavior fixtures

These sanitized fixture descriptions are copied into isolated Git repositories for
live and deterministic tests. They contain no credentials, private content, expected
model answers, or production integration claims.

- `source-snapshot.md`: maintained and executable evidence examples.
- `scenario-inputs.md`: query intents for outcome, deduplication, routing, disclosure,
  recurrence, and Contributor Orientation cases.

Assemble each case in a fresh repository, copy only the sources named by that case,
initialize its own Git history, and use `doc/knowledge/gaps/` only inside the fixture.
Fixture IDs never enter the real repository registry.
