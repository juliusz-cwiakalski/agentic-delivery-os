# M3 architecture: harness and tracker integrations (planned)

## Context

Jaiship's core owns the lifecycle; harnesses execute agent sessions, trackers
own work items and code review. M3 makes both pluggable behind ports without
changing lifecycle contracts.

```
            +----------------------------+
            |        Jaiship core        |
            |  lifecycle, queue, state   |
            +------+--------------+------+
                   |              |
          HarnessPort           TrackerPort (primitives)
                   |              |
      +------------+----+   +-----+------+------+
      | opencode v2.x   |   | GitHub     | GitLab | Jira |
      |  standalone/svc  |   | gh / API   | glab/API| MCP  |
      +-----------------+   +------------+--------+------+
                   |              |
            telemetry rows   work items, PR/MR, checks
```

## Boundary invariants

1. The core never branches on a concrete harness or tracker kind; behavior
   differences are declared in the adapter capability matrix.
2. Every primitive has one contract: inputs, outputs (text digest + machine
   envelope), typed error taxonomy, exit codes. Adapters may degrade an
   unsupported capability, but only through a declared typed refusal.
3. Credentials stay environment-only and resolve through the credential port;
   adapters never store secrets.
4. Telemetry rows are versioned and additive; per-seat model identity is
   mandatory.
5. CLI-first, API-fallback: each adapter declares its preferred transport per
   primitive; the fallback is explicit and tested.

## Components

- **Harness adapter (opencode v2.x)**: spawn/attach/resume, model profile env
  propagation, session liveness signals, telemetry extraction.
- **Tracker adapters**: GitHub (`gh`/API), GitLab (`glab`/API), Jira (MCP).
- **Adapter conformance suite**: parity tests, trap catalogs, simulated
  adapter for offline runs.
- **Capability matrix**: per adapter × primitive, with declared degradations.
