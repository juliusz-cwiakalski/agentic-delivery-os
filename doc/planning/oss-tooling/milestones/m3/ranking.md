# M3 — suggested delivery order

Stories from [backlog.md](backlog.md) top to bottom in the suggested order.

| # | Story | Depends on | Why here |
|---|---|---|---|
| 1 | M3-S4 GitHub adapter completion | M0-S19 | Reference code host + backlog first; parity targets need a reference |
| 2 | M3-S1 opencode v2.x harness and telemetry — delivered (GH-335) | M1-S11, M2-S14 | The harness is the only delivery surface; integration-mode spike first |
| 3 | M3-S5 Adapter conformance and parity suite | M0-S20 | The gate the remaining adapters are built against |
| 4 | M3-S2 Jira backlog adapter | M0-S19, M3-S5 | Needs the parity harness; workflow mapping per project |
| 5 | M3-S3 GitLab code-host adapter | M0-S19, M3-S5 | Needs the parity harness; can run parallel with S2 |
| 6 | M3-S6 Multi-tracker per project | M3-S2, M3-S4 | Migration scenarios need both trackers present |
| 7 | EC-5 evidence deliveries | all | One real delivery per adapter combination |
