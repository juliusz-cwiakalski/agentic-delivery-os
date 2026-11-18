/**
 * TC-PARITY-010 / TC-CHECK-001/002 type probes (DM-2, AC-F4-1, AC-F8-6).
 *
 * `PipelineJob` gains two additive optional provider-asserted timestamps:
 * existing literals keep compiling, an absent timestamp is absent rather than
 * defaulted, and no derived duration is representable.
 *
 * Not named `*.test.ts`, so Bun test discovery ignores it;
 * `tests/types/tsconfig.json` compiles it through the root `typecheck` script.
 */
import type { PipelineJob, PipelineRun } from "../../packages/core/src/contracts/index";

/** An existing literal without timings keeps compiling (additive change). */
export const unchanged: PipelineJob = { jobName: "build", jobState: "succeeded" };

export const withTimings: PipelineJob = {
  ...unchanged,
  startedAt: "2026-11-17T10:00:00Z",
  completedAt: "2026-11-17T10:04:12Z",
};

export const startedOnly: PipelineJob = {
  ...unchanged,
  startedAt: "2026-11-17T10:00:00Z",
};

export const run: PipelineRun = {
  identity: { systemName: "github", entityId: "1111:9002" },
  pipelineName: "test",
  jobs: [withTimings, startedOnly],
  traceEvidence: [],
};

// @ts-expect-error a derived duration is not part of the contract
export const withDuration: PipelineJob = { ...unchanged, durationMs: 252000 };

// @ts-expect-error the timestamps are provider-native strings, never epochs
export const withEpoch: PipelineJob = { ...unchanged, startedAt: 1_700_000_000 };

export type Probes = [PipelineJob, PipelineRun];
