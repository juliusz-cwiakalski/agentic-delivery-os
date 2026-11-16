/**
 * TC-BOARD-003 — `stateSource` is one declared identity on the board, status,
 * and brief payloads (AC-F2-1, F-2, DM-1, DEC-3, SC-M2-S4-01).
 *
 * The equality is taken from three payloads produced in one process, never from
 * code reading; the structural half proves the identity literal has exactly one
 * home in the source tree and that all three surfaces import it.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { STATUS_FACTS_SCHEMA_VERSION } from "../../packages/core/src/contracts/index";
import { boardData, createBoardHarness } from "../fixtures/board/harness";
import { ownerReviewGate, waiverGate } from "../fixtures/board/matrix";
import { briefRuntime, capSizedFacts, runBriefCli } from "../fixtures/brief/harness";
import { runStatusCli, statusRuntime } from "../fixtures/status/harness";

const ROOT = process.cwd();
const IDENTITY = "delivery.status-facts.v1";

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const sourceFiles = (directory: string): string[] => {
  const entries = readdirSync(join(ROOT, directory), { withFileTypes: true });
  return entries.flatMap((entry) => {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === "dist" ? [] : sourceFiles(relative);
    return entry.isFile() && entry.name.endsWith(".ts") ? [relative] : [];
  });
};

const payloadOf = (run: { readonly stdout: string }) => {
  const parsed = JSON.parse(run.stdout) as Record<string, unknown>;
  const data = parsed.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("expected a produced payload");
  }
  return data as Record<string, unknown>;
};

describe("TC-BOARD-003 shared state-source identity", () => {
  test("board, status, and brief carry one identical declared identity", async () => {
    const board = createBoardHarness({
      gates: [ownerReviewGate("GH-2601", 26 * 3_600_000), waiverGate("GH-2602", 73 * 3_600_000)],
    });
    try {
      const boardRun = await board.run([], { json: true });
      const statusRun = await runStatusCli(["--json", "status"], statusRuntime(capSizedFacts()));
      const briefRun = await runBriefCli(["--json", "brief"], briefRuntime(capSizedFacts()));
      expect(boardRun.exitCode).toBe(0);
      expect(statusRun.exitCode).toBe(0);
      expect(briefRun.exitCode).toBe(0);
      const boardSource = boardData(boardRun)?.stateSource;
      const statusSource = payloadOf(statusRun).stateSource;
      const briefSource = payloadOf(briefRun).stateSource;
      expect(boardSource).toBe(IDENTITY);
      expect(statusSource).toBe(boardSource);
      expect(briefSource).toBe(boardSource);
      expect(STATUS_FACTS_SCHEMA_VERSION).toBe(IDENTITY);
    } finally {
      board.cleanup();
    }
  });

  test("status and brief data key sets gain exactly stateSource", async () => {
    const statusRun = await runStatusCli(["--json", "status"], statusRuntime(capSizedFacts()));
    const briefRun = await runBriefCli(["--json", "brief"], briefRuntime(capSizedFacts()));
    const statusKeys = Object.keys(payloadOf(statusRun)).sort();
    const briefKeys = Object.keys(payloadOf(briefRun)).sort();
    for (const key of ["schemaVersion", "generatedAt", "repository", "summary", "sections"]) {
      expect(statusKeys).toContain(key);
    }
    expect(statusKeys).toEqual([
      "generatedAt",
      "repository",
      "schemaVersion",
      "sections",
      "stateSource",
      "summary",
    ]);
    for (const key of [
      "schemaVersion",
      "generatedAt",
      "repository",
      "surfaces",
      "anchors",
      "placeholders",
      "truncation",
    ]) {
      expect(briefKeys).toContain(key);
    }
    expect(briefKeys.filter((key) => key === "stateSource")).toHaveLength(1);
  });

  test("the group-scoped status form does not carry the identity", async () => {
    const runtime = {
      ...statusRuntime(capSizedFacts()),
      readProjectGroup: () => ({ ok: true as const, data: { groupKey: "delivery", members: [] } }),
    };
    const run = await runStatusCli(["--json", "status", "--project", "delivery"], runtime as never);
    expect(run.exitCode).toBe(0);
    expect(payloadOf(run)).not.toHaveProperty("stateSource");
  });

  test("the identity literal has exactly one home in the source tree", () => {
    const occurrences = sourceFiles("packages")
      .map((file) => ({ file, text: read(file) }))
      .filter((entry) => entry.text.includes(`"${IDENTITY}"`));
    expect(occurrences.map((entry) => entry.file)).toEqual([
      "packages/core/src/contracts/status.ts",
    ]);
    for (const consumer of [
      "packages/core/src/domain/status.ts",
      "packages/core/src/domain/brief.ts",
      "packages/core/src/domain/owner-gate-sla.ts",
    ]) {
      expect(read(consumer)).toContain("STATUS_FACTS_SCHEMA_VERSION");
    }
  });
});
