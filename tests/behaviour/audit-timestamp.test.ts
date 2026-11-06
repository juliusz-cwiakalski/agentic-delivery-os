/**
 * TC-GH223-035 (startedAt from the injected clock, exactly once) and
 * TC-GH223-036 (re-run records a distinct startedAt and advanced auditSeq).
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { invocationPayloadsOf, makeAuditStore, removeRoot } from "../fixtures/state/harness";
import { programFor, runAudited } from "./audit-run-support";

const ROOT = process.cwd();
const AMBIENT_CLOCK = ["Date.now(", "new Date(", "performance.now("];

const ambientClockReads = (text: string): string[] =>
  AMBIENT_CLOCK.filter((marker) => text.includes(marker));

const recordFor = (
  store: Parameters<typeof invocationPayloadsOf>[0],
  runId: string,
): Record<string, unknown> => {
  const record = invocationPayloadsOf(store).find((payload) => payload.runId === runId);
  if (record === undefined) throw new Error(`record missing for ${runId}`);
  return record;
};

describe("TC-GH223-035 startedAt is the injected clock start", () => {
  test("startedAt is the integer start tick and timing uses both ticks", async () => {
    const fixture = makeAuditStore("timestamp");
    try {
      const run = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-timestamp-1",
        ticks: [1000, 1013],
      });
      expect(run.exitCode).toBe(0);
      const record = recordFor(fixture.store, "run-timestamp-1");
      expect(record.startedAt).toBe(1000);
      expect(Number.isInteger(record.startedAt)).toBe(true);
      expect(typeof record.startedAt).toBe("number");
      expect(record.timing).toEqual({ totalMs: 13 });
      expect(record.startedAt).not.toBe(1013);

      // Re-reading the ledger returns the same startedAt.
      const again = invocationPayloadsOf(fixture.store).find(
        (payload) => payload.runId === "run-timestamp-1",
      );
      expect(again?.startedAt).toBe(1000);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("no ambient clock read exists in the audit assembly/write modules", () => {
    const files = [
      "packages/core/src/state/audit.ts",
      "packages/core/src/contracts/audit.ts",
      "packages/cli/src/index.ts",
    ];
    for (const file of files) {
      expect(ambientClockReads(readFileSync(join(ROOT, file), "utf8")), file).toEqual([]);
    }
  });

  test("a temp-copy module using Date.now is detected by the scan", () => {
    const root = mkdtempSync(join(tmpdir(), "ambient-clock-"));
    mkdirSync(join(root, "probe"), { recursive: true });
    writeFileSync(join(root, "probe/module.ts"), "export const now = () => Date.now();\n");
    const text = readFileSync(join(root, "probe/module.ts"), "utf8");
    expect(ambientClockReads(text)).toEqual(["Date.now("]);
  });
});

describe("TC-GH223-036 re-run timestamp and ordinal", () => {
  test("a re-run records its own distinct startedAt and the next auditSeq", async () => {
    const fixture = makeAuditStore("timestamp-rerun");
    try {
      await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-gh223-0201",
        ticks: [1000, 1007],
      });
      await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-gh223-0202",
        ticks: [2000, 2007],
      });
      const first = recordFor(fixture.store, "run-gh223-0201");
      const second = recordFor(fixture.store, "run-gh223-0202");
      expect(first.startedAt).toBe(1000);
      expect(second.startedAt).toBe(2000);
      expect(first.startedAt).not.toBe(second.startedAt);
      expect(first.auditSeq).toBe(1);
      expect(second.auditSeq).toBe(2);
      expect(first.runId).not.toBe(second.runId);
      expect(invocationPayloadsOf(fixture.store)).toHaveLength(2);
    } finally {
      removeRoot(fixture.root);
    }
  });
});
