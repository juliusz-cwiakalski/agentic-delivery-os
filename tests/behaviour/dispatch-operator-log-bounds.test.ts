/**
 * GH-354 F-2 — the log output bounds and the tear rule
 * (TC-LOG-007, TC-LOG-008, TC-LOG-009).
 *
 * The byte/line arithmetic is the production export (`boundDispatchLogLines`,
 * `stitchDispatchLogLines`); the command projection is observed through the real
 * composed program over the same materialized family.
 */
import { describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import {
  DISPATCH_LOG_MAX_HUMAN_BYTES,
  DISPATCH_LOG_MAX_HUMAN_LINES,
  DISPATCH_MAX_MACHINE_BYTES,
} from "../../packages/core/src/contracts/index";
import {
  boundDispatchLogLines,
  dispatchLogByteLength,
  stitchDispatchLogLines,
} from "../../packages/core/src/domain/dispatch-log";
import { createOperatorHarness, OPERATOR_REF } from "../fixtures/dispatch/operator/harness";
import { materializeFamily, numberedLines, segmentName } from "../fixtures/dispatch/operator/logs";

const firstSegment = segmentName({
  recordedAt: "2026-11-19T00:00:00.000Z",
  attemptId: "attempt-bounds",
  iterationOrdinal: 1,
  streamKind: "spawn",
  segmentOrdinal: 1,
});
const secondSegment = segmentName({
  recordedAt: "2026-11-19T00:00:00.000Z",
  attemptId: "attempt-bounds",
  iterationOrdinal: 1,
  streamKind: "spawn",
  segmentOrdinal: 2,
});

const dataOf = (data: unknown) => data as Record<string, unknown>;

describe("TC-LOG the output bounds and the tear rule", () => {
  test("TC-LOG-007 machine and human bounds bind with exactly one truncation fact naming its scope", async () => {
    // (a) The machine byte bound binds: 500 lines of 4 000 bytes.
    const familyRoot = join(process.cwd(), "tmp", "tmpdir", "gh354-log-007");
    rmSync(familyRoot, { recursive: true, force: true });
    const h = createOperatorHarness({ label: "log-007", artifactRoot: familyRoot });
    try {
      const heavyLines = Array.from(
        { length: 500 },
        (_, index) => `M-${index}-${"x".repeat(4_000)}`,
      );
      const heavy = (): string => `${heavyLines.join("\n")}\n`;
      materializeFamily({
        familyRoot,
        ref: OPERATOR_REF,
        files: [
          { name: firstSegment, text: heavy() },
          { name: secondSegment, text: numberedLines({ prefix: "M-END-", from: 1, count: 1 }) },
        ],
      });
      const machine = await h.run(["dispatch", "log", OPERATOR_REF, "--tail", "500", "--json"]);
      expect(machine.exit).toBe(0);
      expect(dispatchLogByteLength(machine.stdout)).toBeLessThanOrEqual(DISPATCH_MAX_MACHINE_BYTES);
      const machineData = dataOf(machine.data);
      const machineLines = machineData.lines as readonly string[];
      expect(machineLines.length).toBeGreaterThan(0);
      expect(machineLines.length).toBeLessThan(500);
      const machineFact = machineData.truncation as Record<string, unknown>;
      expect(machineFact.scope).toBe("bytes");
      expect(machineFact.bound).toBe(DISPATCH_MAX_MACHINE_BYTES);
      expect(machineFact.omittedLines).toBe(500 - machineLines.length);
      // Never a partial line: the answer is a suffix of the declared lines.
      const declared = [...heavyLines, "M-END-1"];
      expect(machineLines).toEqual(declared.slice(-machineLines.length));

      // (h1) The human 200-line bound binds: 220 short lines, --tail 500.
      materializeFamily({
        familyRoot,
        ref: OPERATOR_REF,
        files: [{ name: firstSegment, text: numberedLines({ prefix: "H-", from: 1, count: 220 }) }],
      });
      const lineBound = await h.run(["dispatch", "log", OPERATOR_REF, "--tail", "500"]);
      expect(lineBound.exit).toBe(0);
      const rendered = lineBound.stdout.trimEnd().split("\n");
      const factLine = rendered[rendered.length - 1] as string;
      expect(factLine).toBe(
        `truncation=scope:tail,bound:${DISPATCH_LOG_MAX_HUMAN_LINES},omitted:${500 - DISPATCH_LOG_MAX_HUMAN_LINES}`,
      );
      expect(rendered.length - 1).toBe(DISPATCH_LOG_MAX_HUMAN_LINES);

      // (h2) The 32 768-byte human bound binds before the line bound.
      const wide = (): string =>
        `${Array.from({ length: 40 }, (_, index) => `W-${index}-${"y".repeat(1_000)}`).join("\n")}\n`;
      materializeFamily({
        familyRoot,
        ref: OPERATOR_REF,
        files: [{ name: firstSegment, text: wide() }],
      });
      const byteBound = await h.run(["dispatch", "log", OPERATOR_REF, "--tail", "500"]);
      expect(byteBound.exit).toBe(0);
      const byteLines = byteBound.stdout.trimEnd().split("\n");
      const byteFact = byteLines[byteLines.length - 1] as string;
      expect(
        byteFact.startsWith(`truncation=scope:bytes,bound:${DISPATCH_LOG_MAX_HUMAN_BYTES}`),
      ).toBe(true);
      // The rendered body respects both human bounds.
      const body = byteLines.slice(0, -1);
      expect(body.length).toBeLessThan(DISPATCH_LOG_MAX_HUMAN_LINES);
      expect(
        body.reduce((total, line) => total + dispatchLogByteLength(line) + 1, 0),
      ).toBeLessThanOrEqual(DISPATCH_LOG_MAX_HUMAN_BYTES);
    } finally {
      h.dispose();
      rmSync(familyRoot, { recursive: true, force: true });
    }

    // The pure arithmetic: a byte-bound candidate reports `bytes`, and a
    // line-bound candidate reports `tail` — the scope is the binding bound.
    const lines = Array.from({ length: 10 }, (_, index) => `${index}-${"z".repeat(20)}`);
    const byteScoped = boundDispatchLogLines({
      lines,
      requested: 10,
      maxBytes: 100,
      measureBytes: (candidate) =>
        candidate.reduce((total, line) => total + dispatchLogByteLength(line), 0),
    });
    expect(byteScoped.truncation?.scope).toBe("bytes");
    expect(byteScoped.truncation?.bound).toBe(100);
    const tailScoped = boundDispatchLogLines({ lines, requested: 10, maxLines: 4 });
    expect(tailScoped.truncation).toEqual({ scope: "tail", bound: 4, omittedLines: 6 });
  });

  test("TC-LOG-008 a short retained window answers with exactly one tail-scope truncation fact", async () => {
    const lines = Array.from({ length: 20 }, (_, index) => `S-${index}`);
    const short = boundDispatchLogLines({ lines, requested: 200 });
    expect(short.lines).toHaveLength(20);
    expect(short.truncation).toEqual({ scope: "tail", bound: 20, omittedLines: 180 });

    // The command answer over a short single-retained-file window.
    const familyRoot = join(process.cwd(), "tmp", "tmpdir", "gh354-log-008");
    rmSync(familyRoot, { recursive: true, force: true });
    const h = createOperatorHarness({ label: "log-008", artifactRoot: familyRoot });
    try {
      materializeFamily({
        familyRoot,
        ref: OPERATOR_REF,
        files: [
          { name: secondSegment, text: numberedLines({ prefix: "ONLY-", from: 1, count: 5 }) },
        ],
      });
      const result = await h.run(["dispatch", "log", OPERATOR_REF, "--tail", "200", "--json"]);
      expect(result.exit).toBe(0);
      const data = dataOf(result.data);
      expect((data.lines as readonly string[]).length).toBe(5);
      expect(data.truncation).toEqual({ scope: "tail", bound: 5, omittedLines: 195 });
    } finally {
      h.dispose();
      rmSync(familyRoot, { recursive: true, force: true });
    }
  });

  test("TC-LOG-009 a torn tail is dropped, never returned as content", () => {
    // (a) An unterminated last value, preceded by three complete lines.
    const torn = stitchDispatchLogLines([
      { name: firstSegment, text: "KEEP-1\nKEEP-2\nKEEP-3\nTORN-WRITE-PARTIAL" },
    ]);
    expect(torn).toEqual(["KEEP-1", "KEEP-2", "KEEP-3"]);
    expect(torn.join("\n")).not.toContain("TORN-WRITE-PARTIAL");

    // (b) A complete file's final line is never dropped (the false-positive
    // direction of the tear rule).
    const complete = stitchDispatchLogLines([{ name: firstSegment, text: "ONE\nTWO\nTHREE\n" }]);
    expect(complete).toEqual(["ONE", "TWO", "THREE"]);

    // (c) An older complete file plus a newer file ending mid-line: only the
    // newer file's unterminated tail is dropped.
    const mixed = stitchDispatchLogLines([
      { name: firstSegment, text: "OLD-1\nOLD-2\n" },
      { name: secondSegment, text: "NEW-1\nNEW-PARTIAL" },
    ]);
    expect(mixed).toEqual(["OLD-1", "OLD-2", "NEW-1"]);
    expect(mixed.join("\n")).not.toContain("NEW-PARTIAL");
  });
});
