/**
 * GH-354 F-2 — the bounded, reference-scoped `log` (TC-LOG-001..006, 010..012
 * plus the command-projection halves of 007..009).
 *
 * Every case drives the composed production program (D1) over a family the
 * fixture materialized on disk, with the real filesystem edge unless the case
 * needs a recording one.
 */
import { describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { DISPATCH_LOG_MAX_HUMAN_LINES } from "../../../packages/core/src/contracts/index";
import { stitchDispatchLogLines } from "../../../packages/core/src/domain/dispatch-log";
import {
  createOperatorHarness,
  createRecordingLogFs,
  OPERATOR_REF,
} from "../../fixtures/dispatch/operator/harness";
import {
  familySnapshot,
  materializeFamily,
  materializeUnreadable,
  numberedLines,
  segmentName,
} from "../../fixtures/dispatch/operator/logs";

const dataOf = (data: unknown) => data as Record<string, unknown>;

const twoSegments = (): {
  readonly a: string;
  readonly b: string;
} => ({
  a: segmentName({
    recordedAt: "2026-11-19T00:00:00.000Z",
    attemptId: "attempt-a",
    iterationOrdinal: 1,
    streamKind: "spawn",
    segmentOrdinal: 1,
  }),
  b: segmentName({
    recordedAt: "2026-11-19T00:00:00.000Z",
    attemptId: "attempt-a",
    iterationOrdinal: 1,
    streamKind: "spawn",
    segmentOrdinal: 2,
  }),
});

describe("TC-LOG the bounded reference-scoped tail", () => {
  test("TC-LOG-001 default tail 50 over the newest file then the preceding one, oldest-to-newest", async () => {
    const { a, b } = twoSegments();
    const familyRoot = join(process.cwd(), "tmp", "tmpdir", "gh354-log-001");
    rmSync(familyRoot, { recursive: true, force: true });
    const h = createOperatorHarness({ label: "log-001", artifactRoot: familyRoot });
    try {
      materializeFamily({
        familyRoot,
        ref: OPERATOR_REF,
        files: [
          { name: a, text: numberedLines({ prefix: "A-", from: 1, count: 40 }) },
          { name: b, text: numberedLines({ prefix: "B-", from: 41, count: 40 }) },
        ],
      });
      // A sibling ref's directory with distinctive content.
      materializeFamily({
        familyRoot,
        ref: "GH-999",
        files: [{ name: a, text: numberedLines({ prefix: "GH999-ONLY-", from: 1, count: 5 }) }],
      });

      const json = await h.run(["dispatch", "log", OPERATOR_REF, "--json"]);
      expect(json.exit).toBe(0);
      const data = dataOf(json.data);
      expect(data.query).toBe("log");
      expect(data.available).toBe(true);
      expect(data.tail).toBe(50);
      expect(data.truncation).toBeUndefined();
      const lines = data.lines as readonly string[];
      expect(lines).toHaveLength(50);
      expect(lines[0]).toBe("A-31");
      expect(lines[49]).toBe("B-80");
      expect(lines.every((line) => !line.startsWith("GH999-ONLY-"))).toBe(true);

      const human = await h.run(["dispatch", "log", OPERATOR_REF]);
      expect(human.exit).toBe(0);
      // The human form is the raw tail, not a key=value wrapper.
      expect(human.stdout.startsWith("A-31\n")).toBe(true);
      expect(human.stdout).not.toContain("query=");
    } finally {
      h.dispose();
      rmSync(familyRoot, { recursive: true, force: true });
    }
  });

  test("TC-LOG-002 a value continued across a segment boundary is reconstructed", async () => {
    const { a, b } = twoSegments();
    const familyRoot = join(process.cwd(), "tmp", "tmpdir", "gh354-log-002");
    rmSync(familyRoot, { recursive: true, force: true });
    const h = createOperatorHarness({ label: "log-002", artifactRoot: familyRoot });
    try {
      // A value spanning the boundary of the two retained files, whole.
      const head = "HEAD-1\nHEAD-2\n";
      const continued = "C".repeat(900);
      const splitAt = 400;
      materializeFamily({
        familyRoot,
        ref: OPERATOR_REF,
        files: [
          { name: a, text: `${head}${continued.slice(0, splitAt)}` },
          { name: b, text: `${continued.slice(splitAt)}\nAFTER-CONTINUATION\n` },
        ],
      });
      const json = await h.run(["dispatch", "log", OPERATOR_REF, "--tail", "2", "--json"]);
      expect(json.exit).toBe(0);
      const data = dataOf(json.data);
      const lines = data.lines as readonly string[];
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe(continued);
      expect(lines[1]).toBe("AFTER-CONTINUATION");
      expect(data.truncation).toBeUndefined();

      // The reader's arithmetic reconstructs a value larger than any output
      // bound when the value is read without the renderer's byte budget.
      const huge = "H".repeat(1_200_000);
      const stitched = stitchDispatchLogLines([
        { name: a, text: `X-1\n${huge.slice(0, 900_000)}` },
        { name: b, text: `${huge.slice(900_000)}\nAFTER\n` },
      ]);
      expect(stitched).toEqual(["X-1", huge, "AFTER"]);
    } finally {
      h.dispose();
      rmSync(familyRoot, { recursive: true, force: true });
    }
  });

  test("TC-LOG-003 every invalid --tail and every undeclared flag is refused before any artifact read", async () => {
    const { a } = twoSegments();
    const familyRoot = join(process.cwd(), "tmp", "tmpdir", "gh354-log-003");
    rmSync(familyRoot, { recursive: true, force: true });
    const logFs = createRecordingLogFs({ familyRoot });
    const h = createOperatorHarness({
      label: "log-003",
      artifactRoot: familyRoot,
      artifactFs: logFs.fs,
    });
    try {
      materializeFamily({
        familyRoot,
        ref: OPERATOR_REF,
        files: [{ name: a, text: numberedLines({ prefix: "L-", from: 1, count: 5 }) }],
      });
      for (const tail of ["0", "501", "1.5", "-1", "01", "abc"]) {
        const before = logFs.records.length;
        const result = await h.run(["dispatch", "log", OPERATOR_REF, "--tail", tail, "--json"]);
        expect(result.exit, tail).toBe(1);
        expect(result.errorCode, tail).toBe("input.value.rejected");
        // Refused before any artifact read.
        expect(logFs.records.length - before, tail).toBe(0);
      }
      // `--tail` with no value is the shared parser's refusal.
      const missing = await h.run(["dispatch", "log", OPERATOR_REF, "--tail", "--json"]);
      expect(missing.exit).toBe(1);
      expect(missing.errorCode).toBe("fallback.invocation");
      // An undeclared flag is the delivered guard's identity.
      const undeclared = await h.run(["dispatch", "log", OPERATOR_REF, "--verbose-log", "--json"]);
      expect(undeclared.exit).toBe(1);
      expect(undeclared.errorCode).toBe("fallback.invocation");
      expect(logFs.records.length).toBe(0);
    } finally {
      h.dispose();
      rmSync(familyRoot, { recursive: true, force: true });
    }
  });

  test("TC-LOG-004 no artifact directory is no-log at exit 0, never a fabricated tail", async () => {
    const familyRoot = join(process.cwd(), "tmp", "tmpdir", "gh354-log-004");
    rmSync(familyRoot, { recursive: true, force: true });
    const h = createOperatorHarness({ label: "log-004", artifactRoot: familyRoot });
    try {
      for (const argv of [
        ["dispatch", "log", OPERATOR_REF],
        ["dispatch", "log", OPERATOR_REF, "--json"],
      ]) {
        const result = await h.run(argv);
        expect(result.exit).toBe(0);
        if (argv.includes("--json")) {
          const data = dataOf(result.data);
          expect(data.available).toBe(false);
          expect(data.reason).toBe("no-log");
          expect(data.lines).toEqual([]);
          expect(data.truncation).toBeUndefined();
        } else {
          expect(result.stdout).toContain("reason=no-log");
        }
      }
      // Nothing was created anywhere in the family.
      expect(familySnapshot(familyRoot, OPERATOR_REF)).toEqual([]);
    } finally {
      h.dispose();
      rmSync(familyRoot, { recursive: true, force: true });
    }
  });

  test("TC-LOG-005 a retained file with no complete line is an available, empty answer", async () => {
    const { a } = twoSegments();
    const familyRoot = join(process.cwd(), "tmp", "tmpdir", "gh354-log-005");
    rmSync(familyRoot, { recursive: true, force: true });
    const h = createOperatorHarness({ label: "log-005", artifactRoot: familyRoot });
    try {
      materializeFamily({
        familyRoot,
        ref: OPERATOR_REF,
        files: [{ name: a, text: "TORN-ONLY" }],
      });
      const only = await h.run(["dispatch", "log", OPERATOR_REF, "--json"]);
      const data = dataOf(only.data);
      expect(only.exit).toBe(0);
      expect(data.available).toBe(true);
      expect(data.lines).toEqual([]);

      materializeFamily({
        familyRoot,
        ref: OPERATOR_REF,
        files: [{ name: a, text: "COMPLETE-1\nTORN-ONLY" }],
      });
      const mixed = await h.run(["dispatch", "log", OPERATOR_REF, "--json"]);
      const mixedData = dataOf(mixed.data);
      expect(mixedData.available).toBe(true);
      expect(mixedData.lines).toEqual(["COMPLETE-1"]);
      expect(mixed.stdout).not.toContain("TORN-ONLY");
      // The file's bytes are unchanged after the read.
      expect(familySnapshot(familyRoot, OPERATOR_REF)[0]?.bytes).toBe(
        Buffer.byteLength("COMPLETE-1\nTORN-ONLY"),
      );
    } finally {
      h.dispose();
      rmSync(familyRoot, { recursive: true, force: true });
    }
  });

  test("TC-LOG-006 an unreadable file is unreadable at exit 1 with no content", async () => {
    const { a } = twoSegments();
    const familyRoot = join(process.cwd(), "tmp", "tmpdir", "gh354-log-006");
    rmSync(familyRoot, { recursive: true, force: true });
    const h = createOperatorHarness({
      label: "log-006",
      artifactRoot: familyRoot,
      artifactFs: createRecordingLogFs({
        familyRoot,
        fail: { op: "read", path: "p0001" },
      }).fs,
    });
    try {
      materializeUnreadable({
        familyRoot,
        ref: OPERATOR_REF,
        name: a,
        text: "MUST-NOT-LEAK\n",
      });
      for (const argv of [
        ["dispatch", "log", OPERATOR_REF],
        ["dispatch", "log", OPERATOR_REF, "--json"],
      ]) {
        const result = await h.run(argv);
        expect(result.exit).toBe(1);
        expect(result.stdout).not.toContain("MUST-NOT-LEAK");
        if (argv.includes("--json")) {
          const data = dataOf(result.data);
          expect(data.available).toBe(false);
          expect(data.reason).toBe("unreadable");
          expect(data.lines).toEqual([]);
          expect(result.envelope?.error).toBeUndefined();
        }
      }
    } finally {
      h.dispose();
      rmSync(familyRoot, { recursive: true, force: true });
    }
  });

  test("TC-LOG-010 only the addressed ref's directory is listed and only its files are read", async () => {
    const { a } = twoSegments();
    const familyRoot = join(process.cwd(), "tmp", "tmpdir", "gh354-log-010");
    rmSync(familyRoot, { recursive: true, force: true });
    const logFs = createRecordingLogFs({ familyRoot });
    const h = createOperatorHarness({
      label: "log-010",
      artifactRoot: familyRoot,
      artifactFs: logFs.fs,
    });
    try {
      for (const ref of ["GH-354", "GH-355", "GH-999"]) {
        materializeFamily({
          familyRoot,
          ref,
          files: [{ name: a, text: numberedLines({ prefix: `${ref}-`, from: 1, count: 3 }) }],
        });
      }
      const result = await h.run(["dispatch", "log", OPERATOR_REF, "--tail", "500", "--json"]);
      expect(result.exit).toBe(0);
      const listings = logFs.records.filter((record) => record.op === "list");
      expect(listings).toHaveLength(1);
      expect(listings[0]?.path).toBe(join(familyRoot, OPERATOR_REF));
      const touched = logFs.records
        .filter((record) => ["read", "exists", "list", "mode", "size"].includes(record.op))
        .map((record) => record.path);
      for (const path of touched) {
        expect(
          path === join(familyRoot, OPERATOR_REF) ||
            path.startsWith(`${familyRoot}/${OPERATOR_REF}/`),
        ).toBe(true);
      }
      expect(logFs.violations).toEqual([]);
      const data = dataOf(result.data);
      expect((data.lines as readonly string[]).every((line) => line.startsWith("GH-354-"))).toBe(
        true,
      );
    } finally {
      h.dispose();
      rmSync(familyRoot, { recursive: true, force: true });
    }
  });

  test("TC-LOG-011 a read is a snapshot of what was durable, with no lock or flush", async () => {
    const { a } = twoSegments();
    const familyRoot = join(process.cwd(), "tmp", "tmpdir", "gh354-log-011");
    rmSync(familyRoot, { recursive: true, force: true });
    const durable = `${numberedLines({ prefix: "D-", from: 1, count: 3 })}IN-FLIGHT`;
    const logFs = createRecordingLogFs({
      familyRoot,
      readOverride: (path) => (path.endsWith(a) ? durable : undefined),
    });
    const h = createOperatorHarness({
      label: "log-011",
      artifactRoot: familyRoot,
      artifactFs: logFs.fs,
    });
    try {
      materializeFamily({
        familyRoot,
        ref: OPERATOR_REF,
        files: [{ name: a, text: numberedLines({ prefix: "D-", from: 1, count: 3 }) }],
      });
      const before = familySnapshot(familyRoot, OPERATOR_REF);
      // The request matches what is durable, so no truncation fact is emitted.
      const result = await h.run(["dispatch", "log", OPERATOR_REF, "--tail", "3", "--json"]);
      expect(result.exit).toBe(0);
      const data = dataOf(result.data);
      // The in-flight bytes are absent: the answer states what was durable.
      expect(data.lines).toEqual(["D-1", "D-2", "D-3"]);
      expect(result.stdout).not.toContain("IN-FLIGHT");
      expect(data.truncation).toBeUndefined();
      // No lock file, no write, no deletion.
      expect(logFs.records.every((record) => record.op !== "remove")).toBe(true);
      expect(familySnapshot(familyRoot, OPERATOR_REF)).toEqual(before);
    } finally {
      h.dispose();
      rmSync(familyRoot, { recursive: true, force: true });
    }
  });

  test("TC-LOG-012 the machine window is byte-bounded only and names the retained window, never the human line bound", async () => {
    const { a } = twoSegments();
    const familyRoot = join(process.cwd(), "tmp", "tmpdir", "gh354-log-012");
    rmSync(familyRoot, { recursive: true, force: true });
    const h = createOperatorHarness({ label: "log-012", artifactRoot: familyRoot });
    try {
      materializeFamily({
        familyRoot,
        ref: OPERATOR_REF,
        files: [{ name: a, text: numberedLines({ prefix: "W-", from: 1, count: 220 }) }],
      });

      // The machine `data` is bounded by bytes only: a 220-line window under
      // 65 536 bytes is returned WHOLE, with one `tail` fact naming 220 — the
      // retained window — and never the human 200-line bound.
      const machine = await h.run(["dispatch", "log", OPERATOR_REF, "--tail", "500", "--json"]);
      expect(machine.exit).toBe(0);
      const data = dataOf(machine.data);
      const lines = data.lines as readonly string[];
      expect(lines).toHaveLength(220);
      expect(lines[0]).toBe("W-1");
      expect(lines[219]).toBe("W-220");
      expect(data.truncation).toEqual({ scope: "tail", bound: 220, omittedLines: 280 });
      expect((data.truncation as Record<string, unknown>).bound).not.toBe(
        DISPATCH_LOG_MAX_HUMAN_LINES,
      );

      // The human form still caps at 200 lines, keeps the NEWEST 200, and says
      // so with its own `tail` fact over the total omission.
      const human = await h.run(["dispatch", "log", OPERATOR_REF, "--tail", "500"]);
      expect(human.exit).toBe(0);
      const rendered = human.stdout.trimEnd().split("\n");
      expect(rendered[rendered.length - 1]).toBe(
        `truncation=scope:tail,bound:${DISPATCH_LOG_MAX_HUMAN_LINES},omitted:${500 - DISPATCH_LOG_MAX_HUMAN_LINES}`,
      );
      expect(rendered.length - 1).toBe(DISPATCH_LOG_MAX_HUMAN_LINES);
      expect(rendered[0]).toBe("W-21");
      expect(rendered[DISPATCH_LOG_MAX_HUMAN_LINES - 1]).toBe("W-220");
    } finally {
      h.dispose();
      rmSync(familyRoot, { recursive: true, force: true });
    }
  });
});
