# GH-240 measured latency evidence (NFR-8)

Measured on the reference fixtures in `tests/checks/capsule-latency.test.ts`
with the repository's Bun runtime. Values are wall-clock measurements from one
run on the delivery workstation; they are evidence, not a synthetic green.

| Operation | Reference fixture | Measured | Spec budget | Verdict |
|---|---|---|---|---|
| Capsule validation (2,000 events) | in-memory `events.jsonl` built from the declared envelope | 13.0 ms | ≤ 2 s | met |
| Merged-diff scan (≈1 MiB added lines) | synth diff, four-kind marker scan | 26.3 ms | ≤ 5 s | met |
| Session attribution | full synthetic opencode store, read-only extractor | 2.7 ms | ≤ 5 s | met |
| Retro-registry read | temp JSONL state store seeded with the six levels | 2.0 ms | ≤ 2 s | met |
| Closeout apply p95 (10 runs) | in-process composition, fake provider/git/state, real capsule + memory tree | 12.6 ms | ≤ 120 s | met |

Notes:

- The apply fixture is the in-process closeout composition (fake provider and
  git, real capsule file runtime and memory tree). It measures the transaction
  and capsule overhead, not live provider latency; the spec's reference-fixture
  budget is the same shape.
- Values were produced by the committed test; re-run
  `bun test tests/checks/capsule-latency.test.ts` to reproduce. A budget miss
  must be reported here rather than tuned away.
