/**
 * TC-HARN-026 — telemetry output bounds: session, tool, agent, and model caps
 * with explicit marks, machine 65 536 bytes, human 4 096 bytes / 24 lines.
 */
import { describe, expect, test } from "bun:test";
import {
  HARNESS_MAX_AGENTS,
  HARNESS_MAX_MODELS,
  HARNESS_MAX_SESSIONS,
  HARNESS_MAX_TOOLS_PER_AGENT,
  HARNESS_TELEMETRY_MAX_HUMAN_BYTES,
  HARNESS_TELEMETRY_MAX_HUMAN_LINES,
  HARNESS_TELEMETRY_MAX_MACHINE_BYTES,
  HARNESS_TELEMETRY_SCHEMA_ID,
  type HarnessTelemetryCapture,
  type HarnessTelemetryRecord,
} from "../../packages/core/src/contracts/index";
import {
  boundHarnessTelemetryCapture,
  canonicalHarnessJson,
  renderHarnessTelemetryHuman,
} from "../../packages/core/src/domain/index";

const NOW = "2026-11-06T00:00:00Z";

const record = (index: number, toolCount = 2, warnings = 0): HarnessTelemetryRecord => ({
  schemaId: HARNESS_TELEMETRY_SCHEMA_ID,
  workItemRef: "GH-233",
  runId: "run-bounds",
  sessionId: `ses_${index}`,
  harnessKind: "opencode",
  harnessVersion: "1.0.0",
  agent: `agent-${index % 20}`,
  model: `model-${index % 30}`,
  treeRoot: `ses_${index}`,
  parentChain: [],
  tokens: { input: 1, output: 1, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
  calls: 1,
  toolCounts: Array.from({ length: toolCount }, (_, tool) => ({
    tool: `tool-${tool}`,
    calls: 1,
  })),
  cost: 0.01,
  capturedAt: NOW,
  warnings: Array.from({ length: warnings }, (_, warning) => ({
    reason: "non-numeric-value" as const,
    field: `field-${warning}-${"x".repeat(120)}`,
  })),
});

const capture = (records: readonly HarnessTelemetryRecord[]): HarnessTelemetryCapture => ({
  workItemRef: "GH-233",
  runId: "run-bounds",
  capturedAt: NOW,
  records,
  agents: Array.from({ length: 20 }, (_, index) => ({
    agent: `agent-${index}`,
    calls: 1,
  })),
  models: Array.from({ length: 20 }, (_, index) => ({
    model: `model-${index}`,
    calls: 1,
  })),
  failedSessions: [],
  warnings: [],
});

describe("TC-HARN-026 output bounds", () => {
  test("session, tool, agent, and model caps carry explicit marks", () => {
    const bounded = boundHarnessTelemetryCapture(
      capture(Array.from({ length: HARNESS_MAX_SESSIONS + 3 }, (_, index) => record(index, 2))),
    );
    expect(bounded.records).toHaveLength(HARNESS_MAX_SESSIONS);
    expect(bounded.sessionTruncation).toEqual({
      truncated: true,
      omitted: 3,
      cap: HARNESS_MAX_SESSIONS,
    });
    const toolCapped = boundHarnessTelemetryCapture(capture([record(0, 30)]));
    expect(toolCapped.records[0]?.toolCounts).toHaveLength(HARNESS_MAX_TOOLS_PER_AGENT);
    expect(toolCapped.records[0]?.toolTruncation).toEqual({
      truncated: true,
      omitted: 30 - HARNESS_MAX_TOOLS_PER_AGENT,
      cap: HARNESS_MAX_TOOLS_PER_AGENT,
    });
    expect(bounded.agentTruncation).toEqual({
      truncated: true,
      omitted: 20 - HARNESS_MAX_AGENTS,
      cap: HARNESS_MAX_AGENTS,
    });
    expect(bounded.modelTruncation).toEqual({
      truncated: true,
      omitted: 20 - HARNESS_MAX_MODELS,
      cap: HARNESS_MAX_MODELS,
    });
  });

  test("the machine payload stays within 65 536 bytes with the measured value", () => {
    const bounded = boundHarnessTelemetryCapture(
      capture(Array.from({ length: HARNESS_MAX_SESSIONS }, (_, index) => record(index, 2, 8))),
    );
    const bytes = Buffer.byteLength(JSON.stringify(bounded), "utf8");
    expect(bytes).toBeLessThanOrEqual(HARNESS_TELEMETRY_MAX_MACHINE_BYTES);
    expect(canonicalHarnessJson(bounded)).toBe(canonicalHarnessJson(bounded));
  });

  test("an oversized payload truncates deterministically with a mark", () => {
    const oversized = capture(
      Array.from({ length: HARNESS_MAX_SESSIONS }, (_, index) => record(index, 24, 40)),
    );
    const bounded = boundHarnessTelemetryCapture(oversized);
    expect(Buffer.byteLength(JSON.stringify(bounded), "utf8")).toBeLessThanOrEqual(
      HARNESS_TELEMETRY_MAX_MACHINE_BYTES,
    );
    expect(bounded.sessionTruncation?.omitted ?? 0).toBeGreaterThan(0);
    expect(bounded.records.length).toBeLessThan(HARNESS_MAX_SESSIONS);
    expect(canonicalHarnessJson(bounded)).toBe(
      canonicalHarnessJson(boundHarnessTelemetryCapture(oversized)),
    );
  });

  test("the human disclosure fits 4 096 bytes and 24 lines with the counts line", () => {
    const human = renderHarnessTelemetryHuman(
      capture(Array.from({ length: HARNESS_MAX_SESSIONS }, (_, index) => record(index))),
    );
    expect(Buffer.byteLength(human, "utf8")).toBeLessThanOrEqual(HARNESS_TELEMETRY_MAX_HUMAN_BYTES);
    expect(human.split("\n").filter((line) => line.length > 0).length).toBeLessThanOrEqual(
      HARNESS_TELEMETRY_MAX_HUMAN_LINES,
    );
    expect(human.split("\n")[0]).toContain("sessions=");
    expect(human).toContain("run=run-bounds");
  });
});
