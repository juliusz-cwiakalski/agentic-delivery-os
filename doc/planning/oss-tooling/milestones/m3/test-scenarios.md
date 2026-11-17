# M3 test scenarios (planned)

## TC-M3-HARNESS-001 opencode v2.x dispatch with profile propagation
Given a resolved model profile and an installed opencode v2.x,
When the harness port spawns an agent session in standalone mode,
Then the session reports the resolved per-seat models and emits versioned
telemetry rows with tokens and cost.

## TC-M3-HARNESS-002 unsupported harness version
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
