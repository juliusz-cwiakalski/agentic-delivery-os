# M3 test scenarios (planned)

## TC-M3-HARNESS-001 opencode v2.x dispatch with profile propagation — delivered (GH-335)
Given a resolved model profile and an installed opencode v2.x,
When a harness-port spawn is called with a caller-supplied agent identity in
standalone mode (the shipped generic `dispatch` supplies none — DEC-15),
Then the invocation carries exactly one `--agent` and one `--model` for the
resolved seat, the session reports that seat's resolved model where the harness
reports one, and versioned telemetry rows carry tokens and cost.

## TC-M3-HARNESS-002 unsupported harness version — delivered (GH-335)
Given an opencode version outside the supported window,
When a dispatch is attempted,
Then it refuses with `harness.version.unsupported` and no session is spawned.

## TC-M3-PARITY-001 same lifecycle across trackers
Given equivalent work items on GitHub, GitLab, and Jira,
When the same lifecycle runs through each adapter,
Then result classes, phase transitions, and typed errors are identical
(declared capability differences excluded).

## TC-M3-GITLAB-001 merge request lifecycle
Given a GitLab repository and a ready change,
When the review primitives create, update, and merge the MR,
Then pipeline checks map to check status, squash merge is used, and the
result envelope matches the GitHub reference.

## TC-M3-JIRA-001 work item lifecycle
Given a Jira work item and a configured workflow mapping,
When the lifecycle claims, progresses, and closes it,
Then transitions are applied per mapping and unsupported edits refuse with
typed errors.

## TC-M3-OFFLINE-001 simulated adapter parity
Given the simulated tracker,
When the parity suite runs without network,
Then every declared capability is exercised and undeclared differences fail.
