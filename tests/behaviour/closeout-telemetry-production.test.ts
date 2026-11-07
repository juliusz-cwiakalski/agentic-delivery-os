/** TC-CAP-045/046 — production wiring: state log receives, capsule does not, plan silent. */
import { describe, expect, test } from "bun:test";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import { WORK_ITEM_REF } from "../fixtures/closeout/harness";
import { makeChangeTree } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";
import type { HarnessTelemetryCapture } from "../../packages/core/src/contracts/index";

const capture = (): HarnessTelemetryCapture => ({
  workItemRef: WORK_ITEM_REF,
  runId: "run-closeout",
  capturedAt: "2026-11-01T00:00:00Z",
  records: [],
  agents: [],
  models: [],
  failedSessions: [],
  warnings: [],
});

describe("TC-CAP-045/046 production telemetry", () => {
  test("apply extracts and appends to the state log; the capsule stays statistics-free", async () => {
    const change = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
    });
    try {
      let extracted = 0;
      let appended = 0;
      const telemetry = {
        extract: async () => {
          extracted += 1;
          return { ok: true as const, value: capture() };
        },
        append: () => {
          appended += 1;
          return { ok: true as const, value: { sequence: 1, checksum: "0", path: "log" } };
        },
      };
      const capsule = makeCapsuleRuntime(change.changes);
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule,
        telemetry,
      });
      expect(run.exitCode).toBe(0);
      expect(extracted).toBe(1);
      expect(appended).toBe(1);
      expect(closeoutData(run.envelope).telemetryCapture).toBeDefined();
      const events = capsule.read(WORK_ITEM_REF);
      expect(events.ok).toBe(true);
      if (!events.ok) return;
      expect(JSON.stringify(events.events)).not.toContain("telemetry");
    } finally {
      change.cleanup();
    }
  });

  test("plan mode extracts nothing and a failed capture is non-gating", async () => {
    const change = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
    });
    try {
      let extracted = 0;
      const telemetry = {
        extract: async () => {
          extracted += 1;
          return {
            ok: false as const,
            error: { kind: "harness" as const, code: "harness.telemetry.extraction-failed" },
          };
        },
        append: () => ({ ok: true as const, value: { sequence: 1, checksum: "0", path: "log" } }),
      };
      const plan = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF], {
        capsule: makeCapsuleRuntime(change.changes),
        telemetry,
      });
      expect(plan.exitCode).toBe(0);
      expect(extracted).toBe(0);
      const applied = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(change.changes),
        telemetry,
      });
      expect(applied.exitCode).toBe(0);
      expect(extracted).toBeGreaterThan(0);
    } finally {
      change.cleanup();
    }
  });
});
