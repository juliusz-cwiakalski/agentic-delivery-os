/**
 * GH-301 budget caps at their published thresholds
 * (TC-MEMBUDGET-001, TC-MEMBUDGET-002).
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MEMORY_ARCHIVE_INDEX_MAX_LINES,
  MEMORY_ENTRY_MAX_LINES,
  MEMORY_INDEX_MAX_BYTES,
  MEMORY_INDEX_MAX_LINES,
  MEMORY_KERNEL_ERROR_LINES,
  MEMORY_KERNEL_WARN_LINES,
  type MemoryEvaluationResult,
  type MemoryScannedFile,
} from "../../packages/core/src/contracts/index";
import { evaluateMemory } from "../../packages/core/src/domain/memory-lint";
import {
  byteFiller,
  indexReadme,
  indexRow,
  lineFiller,
  memoryFile,
  scannedFile,
} from "../fixtures/memory/tree";

const ROOT = process.cwd();
const TODAY = "2026-11-15";
const EMPTY_VOCABULARY = { rules: [], suppressionClasses: [] } as const;

const evaluate = (files: readonly MemoryScannedFile[]): MemoryEvaluationResult =>
  evaluateMemory({ files, today: TODAY, privacy: EMPTY_VOCABULARY });

const indexTree = (text: string): readonly MemoryScannedFile[] => [memoryFile("README.md", text)];

const entryTree = (relative: string, lines: number): readonly MemoryScannedFile[] => [
  memoryFile("README.md", indexReadme([indexRow(relative, "read it")])),
  memoryFile(relative, lineFiller(lines)),
];

const archiveTree = (lines: number): readonly MemoryScannedFile[] => [
  memoryFile("README.md", indexReadme([indexRow("retro/INDEX.md", "read the archive")])),
  memoryFile("retro/INDEX.md", lineFiller(lines)),
];

const kernelText = (lines: number): string =>
  `## Agent memory\n${Array.from({ length: Math.max(lines - 1, 1) }, (_, index) => `rule ${index + 1}`).join("\n")}\n## Next\n`;

const kernelTree = (lines: number): readonly MemoryScannedFile[] => [
  scannedFile("AGENTS.md", kernelText(lines)),
];

const measuredKernelLines = (text: string): number => {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line === "## Agent memory");
  if (start === -1) throw new Error("AGENTS.md is missing the Agent memory anchor");
  const end = lines.findIndex((line, position) => position > start && /^## /.test(line));
  return (end === -1 ? lines.length : end) - start;
};

const ruleIds = (result: MemoryEvaluationResult): readonly string[] =>
  result.findings.map((finding) => finding.ruleId);

/** The delivered measure: a trailing newline terminates the last line. */
const measuredLines = (text: string): number => {
  const lines = text.split("\n");
  return text.endsWith("\n") ? lines.length - 1 : lines.length;
};

describe("TC-MEMBUDGET-001 caps and kernel bands", () => {
  const lineCases = [
    {
      surface: "index",
      cap: MEMORY_INDEX_MAX_LINES,
      rule: "memory.budget.index-lines",
      build: (lines: number) => indexTree(lineFiller(lines)),
    },
    {
      surface: "agent entry",
      cap: MEMORY_ENTRY_MAX_LINES,
      rule: "memory.budget.agent-entry-lines",
      build: (lines: number) => entryTree("agents/coder/README.md", lines),
    },
    {
      surface: "guild entry",
      cap: MEMORY_ENTRY_MAX_LINES,
      rule: "memory.budget.guild-entry-lines",
      build: (lines: number) => entryTree("guilds/ops/README.md", lines),
    },
    {
      surface: "archive index",
      cap: MEMORY_ARCHIVE_INDEX_MAX_LINES,
      rule: "memory.budget.archive-index-lines",
      build: (lines: number) => archiveTree(lines),
    },
  ] as const;

  for (const lineCase of lineCases) {
    test(`${lineCase.surface}: cap-1 and cap are silent, cap+1 names value and cap`, () => {
      expect(evaluate(lineCase.build(lineCase.cap - 1)).findings).toEqual([]);
      expect(evaluate(lineCase.build(lineCase.cap)).findings).toEqual([]);
      const over = evaluate(lineCase.build(lineCase.cap + 1));
      expect(ruleIds(over)).toEqual([lineCase.rule]);
      expect(over.findings[0]?.detail).toContain(String(lineCase.cap + 1));
      expect(over.findings[0]?.detail).toContain(String(lineCase.cap));
    });
  }

  test("a newline-terminated surface exactly at the cap is silent (F-6)", () => {
    const atCap = lineFiller(MEMORY_INDEX_MAX_LINES);
    expect(atCap.endsWith("\n")).toBe(true);
    // The old split-length measure would have counted the terminator as a line.
    expect(atCap.split("\n").length).toBe(MEMORY_INDEX_MAX_LINES + 1);
    expect(evaluate(indexTree(atCap)).findings).toEqual([]);
    const over = evaluate(indexTree(lineFiller(MEMORY_INDEX_MAX_LINES + 1)));
    expect(ruleIds(over)).toEqual(["memory.budget.index-lines"]);
    expect(over.findings[0]?.detail).toContain(String(MEMORY_INDEX_MAX_LINES + 1));
  });

  test("index bytes at cap are silent and one over is index-bytes", () => {
    expect(evaluate(indexTree(byteFiller(MEMORY_INDEX_MAX_BYTES - 1))).findings).toEqual([]);
    expect(evaluate(indexTree(byteFiller(MEMORY_INDEX_MAX_BYTES))).findings).toEqual([]);
    const over = evaluate(indexTree(byteFiller(MEMORY_INDEX_MAX_BYTES + 1)));
    expect(ruleIds(over)).toEqual(["memory.budget.index-bytes"]);
    expect(over.findings[0]?.detail).toContain(String(MEMORY_INDEX_MAX_BYTES + 1));
  });

  test("the kernel band warns above the advisory threshold and errors above the tolerance", () => {
    expect(evaluate(kernelTree(MEMORY_KERNEL_WARN_LINES - 1)).findings).toEqual([]);
    expect(evaluate(kernelTree(MEMORY_KERNEL_WARN_LINES)).findings).toEqual([]);
    const advisory = evaluate(kernelTree(MEMORY_KERNEL_WARN_LINES + 1));
    expect(ruleIds(advisory)).toEqual(["memory.budget.kernel-lines"]);
    expect(advisory.findings[0]?.severity).toBe("warn");
    expect(advisory.exitCode).toBe(0);
    const atBandEdge = evaluate(kernelTree(MEMORY_KERNEL_ERROR_LINES));
    expect(atBandEdge.findings[0]?.severity).toBe("warn");
    const error = evaluate(kernelTree(MEMORY_KERNEL_ERROR_LINES + 1));
    expect(error.findings[0]?.severity).toBe("error");
    expect(error.findings[0]?.detail).toContain(String(MEMORY_KERNEL_ERROR_LINES + 1));
  });
});

describe("TC-MEMBUDGET-002 the delivered tree measures within every cap", () => {
  test("index, entries, archive index, and kernel section are within budget", () => {
    const readme = readFileSync(join(ROOT, ".ai/memory/README.md"), "utf8");
    expect(measuredLines(readme)).toBeLessThanOrEqual(MEMORY_INDEX_MAX_LINES);
    expect(Buffer.byteLength(readme, "utf8")).toBeLessThanOrEqual(MEMORY_INDEX_MAX_BYTES);
    for (const agent of readdirSync(join(ROOT, ".ai/memory/agents"))) {
      const text = readFileSync(join(ROOT, ".ai/memory/agents", agent, "README.md"), "utf8");
      expect(measuredLines(text)).toBeLessThanOrEqual(MEMORY_ENTRY_MAX_LINES);
    }
    for (const guild of readdirSync(join(ROOT, ".ai/memory/guilds"), { withFileTypes: true })) {
      if (!guild.isDirectory()) continue;
      const text = readFileSync(join(ROOT, ".ai/memory/guilds", guild.name, "README.md"), "utf8");
      expect(measuredLines(text)).toBeLessThanOrEqual(MEMORY_ENTRY_MAX_LINES);
    }
    const archive = readFileSync(join(ROOT, ".ai/memory/retro/INDEX.md"), "utf8");
    expect(measuredLines(archive)).toBeLessThanOrEqual(MEMORY_ARCHIVE_INDEX_MAX_LINES);
    const kernel = readFileSync(join(ROOT, "AGENTS.md"), "utf8");
    expect(measuredKernelLines(kernel)).toBeLessThanOrEqual(MEMORY_KERNEL_ERROR_LINES);
  });
});
