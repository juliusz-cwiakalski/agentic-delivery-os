/**
 * TC-HARN-021 — the harness-neutral statistics shape shared by both extractors.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import {
  createBunSqliteStoreOpener,
  createClaudeTelemetryExtractor,
  createOpencodeTelemetryExtractor,
} from "../../packages/adapters/src/harness/index";
import {
  CLOSEOUT_SCHEMA_ID,
  HARNESS_TELEMETRY_SCHEMA_ID,
  type HarnessTelemetryCapture,
  STATE_SCHEMA_VERSION,
} from "../../packages/core/src/contracts/index";
import { canonicalHarnessJson } from "../../packages/core/src/domain/index";
import { CLAUDE_FIXTURE_FILES } from "../fixtures/harness/claude-code/load";
import { createFakeFileReader } from "../fixtures/harness/claude-code/reader";
import {
  buildOpencodeStore,
  FULL_FIXTURE_TOTALS,
  PRIVACY_CANARY,
  type StoreVariant,
  WORK_ITEM_REF,
} from "../fixtures/harness/opencode-store/build";

const NOW = "2026-11-06T00:00:00Z";
const RUN_ID = "run-021";
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const opencode = (variant: StoreVariant = "full"): HarnessTelemetryCapture => {
  const store = buildOpencodeStore({ variant });
  roots.push(store.directory);
  const result = createOpencodeTelemetryExtractor({
    opener: (path) => createBunSqliteStoreOpener()(path),
    storePath: store.path,
    now: () => NOW,
  }).extract({ workItemRef: WORK_ITEM_REF, runId: RUN_ID });
  if (!result.ok) throw new Error(result.error.summary ?? "opencode extraction failed");
  return result.value;
};

const claude = (): HarnessTelemetryCapture => {
  const result = createClaudeTelemetryExtractor({
    directory: "fixtures/claude-code",
    reader: createFakeFileReader(CLAUDE_FIXTURE_FILES).reader,
    now: () => NOW,
  }).extract({ workItemRef: WORK_ITEM_REF, runId: RUN_ID });
  if (!result.ok) throw new Error(result.error.summary ?? "claude extraction failed");
  return result.value;
};

const shapeOf = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.length === 0 ? ["empty"] : [shapeOf(value[0])];
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : 1))
        .map(([key, child]) => [key, shapeOf(child)]),
    );
  }
  if (value === null) return "null";
  return typeof value;
};

describe("TC-HARN-021 neutral statistics shape", () => {
  test("both extractors produce the identical artificial shape; only values differ", () => {
    const left = opencode();
    const right = claude();
    expect(left.records).toHaveLength(FULL_FIXTURE_TOTALS.sessions);
    expect(right.records).toHaveLength(FULL_FIXTURE_TOTALS.sessions);
    expect(shapeOf(left.records[0])).toEqual(shapeOf(right.records[0]));
    expect(Object.keys(left).sort()).toEqual(Object.keys(right).sort());
  });

  test("every record carries exactly the five token classes, calls, and bounded tool counts", () => {
    for (const capture of [opencode(), claude()]) {
      for (const record of capture.records) {
        expect(Object.keys(record.tokens).sort()).toEqual([
          "cacheRead",
          "cacheWrite",
          "input",
          "output",
          "reasoning",
        ]);
        expect(record.calls).toBeGreaterThanOrEqual(1);
        expect(record.toolCounts.length).toBeGreaterThan(0);
        expect(record.toolCounts.length).toBeLessThanOrEqual(24);
      }
    }
  });

  test("per-session agent and model identity is not collapsed", () => {
    for (const capture of [opencode(), claude()]) {
      const agents = new Set(capture.records.map((record) => record.agent));
      const models = new Set(capture.records.map((record) => record.model));
      expect(agents.size).toBe(2);
      expect(models.size).toBe(2);
      expect(capture.agents.map((entry) => entry.agent).sort()).toEqual([...agents].sort());
      expect(capture.models.map((entry) => entry.model).sort()).toEqual([...models].sort());
    }
  });

  test("one record per (session, agent, model) group with tree attribution", () => {
    for (const capture of [opencode(), claude()]) {
      expect(
        new Set(
          capture.records.map((record) => `${record.sessionId}|${record.agent}|${record.model}`),
        ).size,
      ).toBe(capture.records.length);
      for (const record of capture.records) {
        expect(record.workItemRef).toBe(WORK_ITEM_REF);
        expect(record.treeRoot.length).toBeGreaterThan(0);
        expect(record.runId).toBe(RUN_ID);
        if (record.sessionId !== record.treeRoot)
          expect(record.parentChain.length).toBeGreaterThan(0);
      }
    }
  });

  test("intra-session (agent, model) group diversity is preserved, not collapsed", () => {
    const capture = opencode("multi-group");
    const root = capture.records.filter((record) => record.sessionId === "ses_root");
    expect(root).toHaveLength(2);
    expect(new Set(root.map((record) => `${record.agent}|${record.model}`)).size).toBe(2);
    for (const record of root) {
      expect(record.treeRoot).toBe("ses_root");
      expect(record.workItemRef).toBe(WORK_ITEM_REF);
    }
    expect(
      new Set(
        capture.records.map((record) => `${record.sessionId}|${record.agent}|${record.model}`),
      ).size,
    ).toBe(capture.records.length);
  });

  test("harness kind and observed version travel with every record", () => {
    const left = opencode();
    const right = claude();
    expect(left.records.every((record) => record.harnessKind === "opencode")).toBe(true);
    expect(right.records.every((record) => record.harnessKind === "claude-code")).toBe(true);
    expect(left.records.every((record) => record.harnessVersion === "1.0.0")).toBe(true);
    expect(right.records.every((record) => record.harnessVersion === "1.0.0")).toBe(true);
  });

  test("no prompt, message body, transcript, diff, or tool output enters the payload", () => {
    for (const capture of [opencode(), claude()]) {
      expect(JSON.stringify(capture)).not.toContain(PRIVACY_CANARY);
    }
  });

  test("the telemetry schema id is distinct and replay is byte-identical", () => {
    expect(HARNESS_TELEMETRY_SCHEMA_ID).not.toBe(STATE_SCHEMA_VERSION);
    expect(HARNESS_TELEMETRY_SCHEMA_ID).not.toBe(CLOSEOUT_SCHEMA_ID);
    const first = opencode();
    const second = opencode();
    expect(canonicalHarnessJson(first)).toBe(canonicalHarnessJson(second));
    expect(canonicalHarnessJson(claude())).toBe(canonicalHarnessJson(claude()));
  });
});
