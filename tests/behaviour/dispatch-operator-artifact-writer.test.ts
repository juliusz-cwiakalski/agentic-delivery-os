/**
 * GH-354 F-7/F-2 — the artifact writer's boundary arithmetic
 * (TC-PERSIST-005, TC-PERSIST-006 write halves).
 *
 * The arithmetic is the production export (`planDispatchLogWrites`), asserted on
 * its own plan (the exact inputs the boundary needs: a file of exactly the cap, a
 * value that leaves room for its bytes but not its LF, and a value longer than
 * the cap), and then observed on disk through the real sink and the real
 * filesystem so the reconstruction is measured, not inferred.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createNodeDispatchLogFileSystem } from "../../packages/adapters/src/file/dispatch-logs";
import { createDispatchLogSink } from "../../packages/core/src/app/dispatch-log-sink";
import { DISPATCH_LOG_FILE_CAP_BYTES } from "../../packages/core/src/contracts/index";
import { planDispatchLogWrites } from "../../packages/core/src/domain/dispatch-log";

describe("TC-PERSIST the writer's boundary arithmetic", () => {
  test("TC-PERSIST-005 the per-file cap is enforced by segmentation with nothing dropped at a boundary", () => {
    const capBytes = 10;

    // The file holds 7 bytes, so 3 remain: a 3-byte VALUE needs 4 with its LF,
    // so it does not fit and starts the next segment whole.
    expect(planDispatchLogWrites({ value: "bbb", currentSizeBytes: 7, capBytes })).toEqual([
      { text: "bbb\n", startsSegment: true },
    ]);

    // The file holds 2 bytes, so 8 remain and a 7-character value fills them
    // exactly including its LF: no overflow by an LF and no lost LF.
    expect(planDispatchLogWrites({ value: "bbbbbbb", currentSizeBytes: 2, capBytes })).toEqual([
      { text: "bbbbbbb\n", startsSegment: false },
    ]);

    // A value longer than the cap fills the file to exactly the cap and
    // continues at the start of the next one; nothing is dropped.
    const oversized = planDispatchLogWrites({
      value: "z".repeat(25),
      currentSizeBytes: 0,
      capBytes,
    });
    expect(oversized).toEqual([
      { text: "z".repeat(10), startsSegment: false },
      { text: "z".repeat(10), startsSegment: true },
      { text: "zzzzz\n", startsSegment: true },
    ]);
    expect(oversized.map((write) => write.text).join("")).toBe(`${"z".repeat(25)}\n`);
  });

  test("TC-PERSIST-006 a value longer than the cap is split and reconstructed byte-identically", () => {
    const capBytes = 16;
    const writes = planDispatchLogWrites({ value: "Q".repeat(40), currentSizeBytes: 0, capBytes });
    expect(writes[0]?.text).toHaveLength(16);
    expect(writes.every((write) => write.text.length <= capBytes)).toBe(true);
    expect(writes.map((write) => write.text).join("")).toBe(`${"Q".repeat(40)}\n`);
  });

  test("TC-PERSIST-006 the real sink splits an oversized value at the declared cap on disk", () => {
    const base = join(process.cwd(), "tmp", "tmpdir");
    mkdirSync(base, { recursive: true });
    const root = join(base, "gh354-writer-oversized");
    rmSync(root, { recursive: true, force: true });
    mkdirSync(root, { recursive: true });
    const familyRoot = join(root, "dispatch-logs.default");
    try {
      const fs = createNodeDispatchLogFileSystem();
      const sink = createDispatchLogSink({
        context: {
          ref: "GH-354",
          familyRoot,
          recordedAt: "2026-11-19T00:00:00.000Z",
          streamKind: "spawn",
          attemptId: "attempt-oversized",
          iterationOrdinal: 1,
        },
        fs,
      });
      const lead = "L".repeat(100);
      const oversized = "O".repeat(1_200_000);
      sink.write(lead);
      sink.write(oversized);
      sink.close();

      const directory = join(familyRoot, "GH-354");
      const names = readdirSync(directory).sort((left, right) => left.localeCompare(right, "en"));
      expect(names).toHaveLength(2);
      const first = readFileSync(join(directory, names[0] as string));
      const second = readFileSync(join(directory, names[1] as string));
      expect(first.byteLength).toBe(DISPATCH_LOG_FILE_CAP_BYTES);
      // The concatenation reproduces the value stream exactly.
      expect(Buffer.concat([first, second]).toString("utf8")).toBe(`${lead}\n${oversized}\n`);
      // Every file is 0600.
      for (const name of names) expect(fs.mode(join(directory, name))).toBe(0o600);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
