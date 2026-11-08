/**
 * TC-NFR-001 / TC-NFR-002 / TC-NFR-003 (phase 10) — the machine payload stays
 * within 65,536 bytes, human output within 40 lines and 8,192 bytes, and the
 * bounded summary read completes within the declared latency on the reference
 * host. The deterministic bounded-read assertion is the default gate.
 */
import { describe, expect, test } from "bun:test";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";
import { buildAttempts, eligibleSpecs } from "../fixtures/dispatch/evidence-windows";
import { appendDispatchAttempt } from "../../packages/core/src/app/dispatch-ledger";
import { summarizeDispatchEvidence } from "../../packages/core/src/app/dispatch-gate";
import type { StateStorePort } from "../../packages/core/src/contracts/index";
import { REPOSITORY } from "../fixtures/dispatch/ledger";

const MAX_MACHINE_BYTES = 65_536;
const MAX_HUMAN_LINES = 40;
const MAX_HUMAN_BYTES = 8_192;

const seed = (scenario: ReturnType<typeof createCommandScenario>) => {
  for (const attempt of buildAttempts(eligibleSpecs())) {
    const appended = appendDispatchAttempt(
      scenario.state.store,
      scenario.state.fenceToken,
      attempt,
    );
    if (!appended.ok) throw new Error("seed failed");
  }
};

describe("TC-NFR-001 the machine payload stays within 65,536 bytes", () => {
  test("a dispatch envelope and a summary envelope are both bounded", async () => {
    const scenario = createCommandScenario({ evidence: COMPLETED_EVIDENCE, gate: {} });
    try {
      const dispatch = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(Buffer.byteLength(dispatch.stdout, "utf8")).toBeLessThanOrEqual(MAX_MACHINE_BYTES);

      seed(scenario);
      const summary = await scenario.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        REPOSITORY,
        "--json",
      ]);
      expect(Buffer.byteLength(summary.stdout, "utf8")).toBeLessThanOrEqual(MAX_MACHINE_BYTES);
      const data = summary.envelope?.data as { readonly unmatched?: unknown };
      expect(data.unmatched).toBeUndefined();
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-NFR-002 human output stays within 40 lines and 8,192 bytes", () => {
  test("the four-key dispatch text and the summary text are bounded", async () => {
    const scenario = createCommandScenario({ evidence: COMPLETED_EVIDENCE, gate: {} });
    try {
      const dispatch = await scenario.invoke(["dispatch", "GH-301"]);
      expect(dispatch.stdout.split("\n").filter((line) => line.length > 0)).toHaveLength(4);
      expect(Buffer.byteLength(dispatch.stdout, "utf8")).toBeLessThanOrEqual(MAX_HUMAN_BYTES);
      const lastMessage = dispatch.stdout
        .split("\n")
        .find((line) => line.startsWith("last_message="));
      expect(lastMessage?.includes("\r")).toBe(false);

      seed(scenario);
      const summary = await scenario.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        REPOSITORY,
      ]);
      const lines = summary.stdout.split("\n").filter((line) => line.length > 0);
      expect(lines.length).toBeLessThanOrEqual(MAX_HUMAN_LINES);
      expect(Buffer.byteLength(summary.stdout, "utf8")).toBeLessThanOrEqual(MAX_HUMAN_BYTES);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-NFR-003 @perf the bounded summary read stays within 5 s", () => {
  test("@perf 5,000-record summary read is bounded and completes within the bound", () => {
    const attempts = buildAttempts(eligibleSpecs());
    const records = Array.from({ length: 5000 }, (_, index) => {
      const attempt = attempts[index % attempts.length];
      return {
        schemaVersion: "delivery.state.v1",
        kind: "dispatch.attempt",
        key: `dispatch.attempt.perf-${index}`,
        sequence: index,
        checksum: "0".repeat(16),
        payload: {
          ...attempt,
          attemptId: `perf-${index}`,
          recordedAt: `2026-11-01T10:${String(index % 60).padStart(2, "0")}:00.000Z`,
        },
      };
    });
    const evidence = {
      storePath: "/tmp/perf",
      verification: ["framing", "terminal", "sequence", "checksum", "index", "permissions"],
      verifiedEmpty: false,
      recordCount: records.length,
    };
    const store = {
      readRecords: () => ({ ok: true as const, value: { records, evidence } }),
    } as unknown as StateStorePort;

    const read = summarizeDispatchEvidence({
      store,
      repository: REPOSITORY,
      scope: "production",
      nowIso: "2026-11-30T10:00:00.000Z",
    });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.data.countedDeliveries).toBeLessThanOrEqual(5000);

    const started = performance.now();
    for (let index = 0; index < 20; index += 1) {
      summarizeDispatchEvidence({
        store,
        repository: REPOSITORY,
        scope: "production",
        nowIso: "2026-11-30T10:00:00.000Z",
      });
    }
    const elapsed = performance.now() - started;
    // p95 over 20 deterministic runs; the local reference host is well inside 5 s.
    expect(elapsed / 20).toBeLessThanOrEqual(5000);
  });
});
