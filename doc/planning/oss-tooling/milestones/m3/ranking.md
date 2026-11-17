# M3 — suggested delivery order

| # | Story | Depends on | Why here |
|---|---|---|---|
| 1 | M3-S4 GitHub adapter completion | M0-S19 | Reference implementation first; parity targets need a reference |
| 2 | M3-S1 opencode v2.x harness and telemetry | M1-S11, M2-S14 | The harness is the execution surface for every delivery |
| 3 | M3-S5 Adapter conformance and parity suite | M0-S20 | The gate the other adapters are built against |
| 4 | M3-S2 Jira tracker adapter | M0-S19, M3-S5 | Needs the parity harness |
| 5 | M3-S3 GitLab tracker adapter | M0-S19, M3-S5 | Needs the parity harness; can run parallel with S2 |
| 6 | EC-5 evidence deliveries | all | Record one real delivery per adapter combination |
