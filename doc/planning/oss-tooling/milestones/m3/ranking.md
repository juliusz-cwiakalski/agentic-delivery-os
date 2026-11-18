# M3 — suggested delivery order

Stories from [backlog.md](backlog.md) top to bottom in the suggested order.

Sequencing amendment (2026-11-18): the jaiship-only flip
(`../m4/flip-plan.md`, tickets GH-346..GH-352) takes precedence over the
remaining adapter stories. S2, S3, and S6 start only after the flip gate
(F1-F4) is green, or when a lane is free and no flip work is ready. S5 stays in
flight because the flip's parity work builds on it.

| # | Story | Depends on | Why here |
|---|---|---|---|
| 1 | M3-S4 GitHub adapter completion | M0-S19 | Reference code host + backlog first; parity targets need a reference |
| 2 | M3-S1 opencode v2.x harness and telemetry | M1-S11, M2-S14 | The harness is the only delivery surface; integration-mode spike first |
| 3 | M3-S5 Adapter conformance and parity suite | M0-S20 | The gate the remaining adapters are built against |
| 4 | M3-S2 Jira backlog adapter | M0-S19, M3-S5 | Needs the parity harness; workflow mapping per project |
| 5 | M3-S3 GitLab code-host adapter | M0-S19, M3-S5 | Needs the parity harness; can run parallel with S2 |
| 6 | M3-S6 Multi-tracker per project | M3-S2, M3-S4 | Migration scenarios need both trackers present |
| 7 | EC-5 evidence deliveries | all | One real delivery per adapter combination |
