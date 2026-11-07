/**
 * TC-TELEM-001..004 — exactly one metadata-only telemetry event per landed
 * commit, non-gating emission, and no event on any non-landed outcome.
 */
import { describe, expect, test } from "bun:test";
import { readCommitTelemetry } from "../../packages/core/src/state/index";
import { withCommitHarness } from "../fixtures/commit/harness";
import {
  COMMIT_REF,
  dataOf,
  errorCodeOf,
  head,
  seedDirtyTree,
  telemetryPayloads,
  validMessage,
} from "./commit-support";

const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;
const DM1_KEYS = new Set([
  "schemaId",
  "changeRef",
  "phaseId",
  "commitSha",
  "messageSource",
  "transport",
  "tokenSpend",
  "landedAt",
  "transitionId",
  "failover",
]);

describe("TC-TELEM-001 exactly one event per landed commit", () => {
  test("standalone, atomic, and converged commits each emit one full event", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        harness.coreTransport.push({
          kind: "success",
          message: validMessage(undefined, "body"),
          tokenSpend: { inputTokens: 11, outputTokens: 7 },
        });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        const events = telemetryPayloads(harness);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
          schemaId: "delivery.commit.telemetry.v1",
          changeRef: COMMIT_REF,
          commitSha: head(harness),
          messageSource: "model",
          transport: "core-inference",
          tokenSpend: { inputTokens: 11, outputTokens: 7 },
        });
        expect(events[0]?.phaseId).toBeUndefined();
        expect(events[0]?.transitionId).toBeUndefined();
      },
      { seedFiles: SEED },
    );

    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        const events = telemetryPayloads(harness);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
          changeRef: COMMIT_REF,
          phaseId: "delivery",
          commitSha: dataOf(run).commitSha,
        });
        expect(typeof events[0]?.transitionId).toBe("string");
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-TELEM-002 emission failure is disclosed without failing the commit", () => {
  test("the commit lands and the envelope discloses the failed append", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        harness.faults.telemetryAppend = true;
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).commitSha).toBe(head(harness));
        expect((dataOf(run).telemetry as { emitted: boolean }).emitted).toBe(false);
        expect(telemetryPayloads(harness)).toEqual([]);
        expect(harness.repo.statusPorcelain()).not.toContain("src/existing.ts");
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-TELEM-003 no event on any non-landed outcome", () => {
  test("STOP, staging-blocked, scan-unavailable, abort, no-pending", async () => {
    const cases: Array<{
      readonly label: string;
      readonly run: (
        harness: import("../fixtures/commit/harness").CommitHarness,
      ) => Promise<unknown>;
      readonly setup: (harness: import("../fixtures/commit/harness").CommitHarness) => void;
    }> = [
      {
        label: "secret-stop",
        setup: (harness) => {
          harness.safety.setFindings([{ class: "secret-content", path: "src/existing.ts" }]);
        },
        run: (harness) => harness.runCommit([COMMIT_REF]),
      },
      {
        label: "staging-blocked",
        setup: (harness) => {
          harness.repo.run(["checkout", "--", "src/existing.ts"]);
        },
        run: (harness) => harness.runCommit([COMMIT_REF]),
      },
      {
        label: "scan-unavailable",
        setup: (harness) => {
          harness.safety.setUnavailable();
        },
        run: (harness) => harness.runCommit([COMMIT_REF]),
      },
      {
        label: "atomic-abort",
        setup: (harness) => {
          harness.faults.commitObject = true;
        },
        run: (harness) => harness.runPhase(["complete", COMMIT_REF, "delivery"]),
      },
      {
        label: "no-pending-work",
        setup: (harness) => {
          harness.repo.run(["checkout", "--", "src/existing.ts"]);
        },
        run: (harness) => harness.runPhase(["complete", COMMIT_REF, "delivery"]),
      },
    ];
    for (const entry of cases) {
      await withCommitHarness(
        async (harness) => {
          harness.repo.write("src/existing.ts", "export const v = 2;\n");
          entry.setup(harness);
          await entry.run(harness);
          expect(telemetryPayloads(harness), entry.label).toEqual([]);
        },
        { seedFiles: SEED },
      );
    }
  });

  test("row-2 no-op emits nothing; a template commit is the positive control", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        const before = telemetryPayloads(harness).length;
        const noOp = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(dataOf(noOp).outcome).toBe("no-op");
        expect(telemetryPayloads(harness)).toHaveLength(before);
      },
      { seedFiles: SEED },
    );

    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(telemetryPayloads(harness)).toHaveLength(1);
      },
      {
        seedFiles: SEED,
        availability: {
          coreInference: { available: false },
          harnessOneShot: { available: false },
        },
      },
    );
  });
});

describe("TC-TELEM-004 telemetry payload is metadata-only and schema-valid", () => {
  test("the payload carries only metadata keys and no message or secret material", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        harness.coreTransport.push({
          kind: "success",
          message: validMessage(undefined, "distinctive-body-marker-999"),
        });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        const event = telemetryPayloads(harness)[0];
        if (event === undefined) throw new Error("expected one event");
        for (const key of Object.keys(event)) expect(DM1_KEYS.has(key), key).toBe(true);
        const serialized = JSON.stringify(event);
        expect(serialized).not.toContain("distinctive-body-marker-999");
        expect(serialized).not.toContain("export const");
        expect(serialized).not.toContain(harness.repo.root);
      },
      { seedFiles: SEED },
    );
  });

  test("an invalid payload is rejected by the verified read", async () => {
    await withCommitHarness(
      async (harness) => {
        const acquired = harness.store.acquireFence("invalid-telemetry");
        if (!acquired.ok) throw new Error("fence failed");
        const appended = harness.store.append(acquired.value.handle, {
          kind: "commit.telemetry",
          recordKey: `commit.telemetry:${COMMIT_REF}`,
          payload: { schemaId: "delivery.commit.telemetry.v1" },
        });
        expect(appended.ok).toBe(true);
        harness.store.releaseFence(acquired.value.handle);
        const read = readCommitTelemetry(harness.store, COMMIT_REF);
        expect(read.ok).toBe(false);
      },
      { seedFiles: SEED },
    );
  });
});
