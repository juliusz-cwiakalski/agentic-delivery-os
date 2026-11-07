/**
 * TC-HARN-020 — Claude Code extraction: read-only file parsing, bounded,
 * metadata only, no content leakage.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  createClaudeTelemetryExtractor,
  createNodeFileReader,
  type HarnessFileReader,
} from "../../packages/adapters/src/harness/index";
import {
  HARNESS_WARNING_REASONS,
  type HarnessTelemetryCapture,
} from "../../packages/core/src/contracts/index";
import {
  CLAUDE_FIXTURE_DIRECTORY,
  CLAUDE_FIXTURE_FILES,
} from "../fixtures/harness/claude-code/load";
import { createFakeFileReader } from "../fixtures/harness/claude-code/reader";
import { PRIVACY_CANARY, WORK_ITEM_REF } from "../fixtures/harness/opencode-store/build";

const NOW = "2026-11-06T00:00:00Z";
const RUN_ID = "run-020";

const extract = (
  files: Readonly<Record<string, string>>,
  options: {
    readonly maxFileLines?: number;
    readonly pinnedVersion?: string;
    readonly reader?: HarnessFileReader;
  } = {},
): {
  readonly result: ReturnType<ReturnType<typeof createClaudeTelemetryExtractor>["extract"]>;
  readonly reads: readonly { readonly path: string }[];
} => {
  const fake = createFakeFileReader(files);
  const extractor = createClaudeTelemetryExtractor({
    directory: "fixtures/claude-code",
    reader: options.reader ?? fake.reader,
    now: () => NOW,
    ...(options.maxFileLines === undefined ? {} : { maxFileLines: options.maxFileLines }),
    ...(options.pinnedVersion === undefined ? {} : { pinnedVersion: options.pinnedVersion }),
  });
  return {
    result: extractor.extract({ workItemRef: WORK_ITEM_REF, runId: RUN_ID }),
    reads: fake.reads,
  };
};

describe("TC-HARN-020 Claude Code read-only extraction", () => {
  test("the committed fixture extracts one record per session with no content canary", () => {
    const { result, reads } = extract(CLAUDE_FIXTURE_FILES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.records.map((record) => record.sessionId).sort()).toEqual([
      "cc_child_a",
      "cc_child_b",
      "cc_root",
    ]);
    expect(reads.length).toBeGreaterThan(0);
    expect(JSON.stringify(result.value)).not.toContain(PRIVACY_CANARY);
    for (const warning of result.value.warnings) {
      expect(HARNESS_WARNING_REASONS).toContain(warning.reason);
    }
  });

  test("production reads leave files and directory unchanged", () => {
    const directory = join(process.cwd(), "tests/fixtures/harness/claude-code");
    const before = readdirSync(directory)
      .sort()
      .map(
        (entry) =>
          `${entry}:${statSync(join(directory, entry)).size}:${statSync(join(directory, entry)).mtimeMs}`,
      )
      .join("|");
    const extractor = createClaudeTelemetryExtractor({
      directory,
      reader: createNodeFileReader(),
      now: () => NOW,
    });
    const result = extractor.extract({ workItemRef: WORK_ITEM_REF, runId: RUN_ID });
    expect(result.ok).toBe(true);
    const after = readdirSync(directory)
      .sort()
      .map(
        (entry) =>
          `${entry}:${statSync(join(directory, entry)).size}:${statSync(join(directory, entry)).mtimeMs}`,
      )
      .join("|");
    expect(after).toBe(before);
  });

  test("the reader is bounded by the declared line cap with an omitted count", () => {
    const oversized = `${Object.values(CLAUDE_FIXTURE_FILES)[0] as string}${Array.from(
      { length: 40 },
      (_, index) =>
        `{"type":"usage","sessionId":"cc_root","tool":"edit","cost":0.01,"input_tokens":1,"output_tokens":1,"reasoning_tokens":0,"cache_read_input_tokens":0,"cache_creation_input_tokens":0,"content":"${PRIVACY_CANARY}"}`,
    ).join("\n")}\n`;
    const { result } = extract(
      { "fixtures/claude-code/oversized.jsonl": oversized },
      {
        maxFileLines: 10,
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const truncation = result.value.warnings.find((warning) => warning.reason === "truncated");
    expect(truncation?.field ?? "").toContain("omitted-lines=");
  });

  test("a malformed line degrades with a warning and capture continues", () => {
    const text = `${Object.values(CLAUDE_FIXTURE_FILES)[0] as string}\nnot-json\n`;
    const { result } = extract({ "fixtures/claude-code/malformed.jsonl": text });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.records.length).toBeGreaterThan(0);
    expect(result.value.warnings.some((warning) => warning.reason === "malformed-line")).toBe(true);
  });

  test("a missing directory or file is a classified outcome, never a crash", () => {
    const missingDirectory: HarnessFileReader = {
      list: () => ({ ok: false }),
      read: () => ({ ok: false, code: "missing" }),
    };
    const { result } = extract({}, { reader: missingDirectory });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("harness.telemetry.extraction-failed");

    const missingFile: HarnessFileReader = {
      list: () => ({ ok: true, paths: ["fixtures/claude-code/gone.jsonl"] }),
      read: () => ({ ok: false, code: "missing" }),
    };
    const degraded = extract({}, { reader: missingFile });
    expect(degraded.result.ok).toBe(true);
    if (degraded.result.ok) {
      const capture: HarnessTelemetryCapture = degraded.result.value;
      expect(capture.failedSessions.length).toBeGreaterThan(0);
      expect(capture.warnings.some((warning) => warning.reason === "session-capture-failed")).toBe(
        true,
      );
    }
  });
});

describe("TC-HARN-020 metadata-only output", () => {
  test("no record carries a free-form content field", () => {
    const { result } = extract(CLAUDE_FIXTURE_FILES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const record of result.value.records) {
      expect(Object.hasOwn(record, "content")).toBe(false);
      expect(Object.hasOwn(record, "transcript")).toBe(false);
      expect(Object.hasOwn(record, "message")).toBe(false);
    }
  });
});
