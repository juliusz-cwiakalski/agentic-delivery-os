/**
 * TC-CAP-047 — GH-233 review F-8: the Claude Code file-read budget governs the
 * read, not only the parse. No full-file load; bytes, never UTF-16 units.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, statSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createClaudeTelemetryExtractor,
  createNodeFileReader,
  type HarnessFileReader,
} from "../../packages/adapters/src/harness/index";
import { createFakeFileReader } from "../fixtures/harness/claude-code/reader";
import { WORK_ITEM_REF } from "../fixtures/harness/opencode-store/build";

const NOW = "2026-11-07T00:00:00Z";
const RUN_ID = "run-cap";
const CAP = 400;

const line = (sessionId: string, pad = ""): string =>
  `${JSON.stringify({
    type: "session",
    sessionId,
    parentId: null,
    workItemRef: WORK_ITEM_REF,
    agent: "agent-a",
    model: "model-a",
    pad,
  })}\n`;

const extract = (files: Readonly<Record<string, string>>, reader?: HarnessFileReader) => {
  const fake = createFakeFileReader(files);
  const extractor = createClaudeTelemetryExtractor({
    directory: "fixtures/claude-code",
    reader: reader ?? fake.reader,
    now: () => NOW,
    maxFileBytes: CAP,
  });
  return { result: extractor.extract({ workItemRef: WORK_ITEM_REF, runId: RUN_ID }), fake };
};

const truncatedWarnings = (capture: {
  readonly warnings: readonly { readonly reason: string; readonly field: string }[];
}) => capture.warnings.filter((warning) => warning.reason === "truncated");

describe("TC-CAP-047 Claude file-read budget", () => {
  test("an under-cap file is read at most the cap with no truncation warning", () => {
    const { result, fake } = extract({ "a.jsonl": line("cc_a") });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(truncatedWarnings(result.value).length).toBe(0);
    for (const read of fake.reads) {
      expect(read.maxBytes).toBe(CAP);
      expect(read.maxBytes).toBeLessThanOrEqual(CAP);
    }
  });

  test("an over-cap file requests only the cap and warns with the cap", () => {
    const over = `${line("cc_a")}${"x".repeat(CAP + 1024)}\n`;
    const { result, fake } = extract({ "big.jsonl": over });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const warnings = truncatedWarnings(result.value);
    expect(warnings.length).toBe(1);
    expect(warnings[0]?.field).toContain("big.jsonl");
    expect(warnings[0]?.field).toContain("omitted-bytes=");
    expect(fake.reads.every((read) => read.bounded === true)).toBe(true);
    expect(fake.reads.every((read) => (read.maxBytes ?? 0) <= CAP)).toBe(true);
    expect(fake.reads.some((read) => read.bounded !== true)).toBe(false);
    expect(
      fake.reads.reduce((total, read) => total + (read.readBytes ?? 0), 0),
    ).toBeLessThanOrEqual(CAP);
  });

  test("the byte cap is measured in bytes, not UTF-16 code units", () => {
    const template = (pad: string): string =>
      `${JSON.stringify({
        type: "session",
        sessionId: "cc_multi",
        parentId: null,
        workItemRef: WORK_ITEM_REF,
        agent: "agent-a",
        model: "model-a",
        pad,
      })}\n`;
    let units = 0;
    while (Buffer.byteLength(template("é".repeat(units + 1)), "utf8") <= CAP) units += 1;
    const atCap = template("é".repeat(units));
    const oneOver = template("é".repeat(units + 1));
    expect(Buffer.byteLength(atCap, "utf8")).toBeLessThanOrEqual(CAP);
    expect(Buffer.byteLength(oneOver, "utf8")).toBeGreaterThan(CAP);
    const under = extract({ "multi.jsonl": atCap });
    expect(under.result.ok).toBe(true);
    if (under.result.ok) expect(truncatedWarnings(under.result.value).length).toBe(0);
    const over = extract({ "multi-over.jsonl": oneOver });
    expect(over.result.ok).toBe(true);
    if (over.result.ok) expect(truncatedWarnings(over.result.value).length).toBeGreaterThan(0);
  });

  test("capture completes with the truncated file and other files still parse", () => {
    const over = `${line("cc_a")}${"x".repeat(CAP + 512)}\n`;
    const { result } = extract({ "a.jsonl": line("cc_b"), "big.jsonl": over });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.records.some((record) => record.sessionId === "cc_b")).toBe(true);
    expect(truncatedWarnings(result.value).length).toBe(1);
  });

  test("the production reader is read-only and leaves the file unchanged", () => {
    const root = mkdtempSync(join(tmpdir(), "gh240-budget-"));
    try {
      const path = join(root, "big.jsonl");
      writeFileSync(path, `${line("cc_a")}${"x".repeat(CAP + 4096)}\n`);
      const before = {
        hash: createHash("sha256").update(readFileSync(path)).digest("hex"),
        mtimeMs: statSync(path).mtimeMs,
        size: statSync(path).size,
      };
      const extractor = createClaudeTelemetryExtractor({
        directory: root,
        reader: createNodeFileReader(),
        now: () => NOW,
        maxFileBytes: CAP,
      });
      const result = extractor.extract({ workItemRef: WORK_ITEM_REF, runId: RUN_ID });
      expect(result.ok).toBe(true);
      expect({
        hash: createHash("sha256").update(readFileSync(path)).digest("hex"),
        mtimeMs: statSync(path).mtimeMs,
        size: statSync(path).size,
      }).toEqual(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a whole-read-only reader still refuses to treat UTF-16 units as bytes", () => {
    const over = `${line("cc_a")}${"é".repeat(CAP)}\n`;
    const wholeOnly: HarnessFileReader = {
      list: () => ({ ok: true, paths: ["whole.jsonl"] }),
      read: () => ({ ok: true, bytes: Buffer.byteLength(over, "utf8"), text: over }),
    };
    const { result } = extract({ "whole.jsonl": over }, wholeOnly);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(truncatedWarnings(result.value).length).toBe(1);
  });
});
