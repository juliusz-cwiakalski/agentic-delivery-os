/**
 * GH-301 scan cost and gate overhead (TC-MEMNFR-002; NFR-2, NFR-3).
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type MemoryScanFileSystem,
  scanMemoryTree,
} from "../../packages/adapters/src/file/memory-scan";
import type { MemoryPrivacyVocabulary } from "../../packages/core/src/contracts/index";
import { MEMORY_ROOT } from "../../packages/core/src/contracts/index";
import { evaluateMemory } from "../../packages/core/src/domain/memory-lint";

const ROOT = process.cwd();
const EMPTY_VOCABULARY: MemoryPrivacyVocabulary = { rules: [], suppressionClasses: [] };
const FILES = 2_000;

const countingFileSystem = (): {
  readonly fs: MemoryScanFileSystem;
  readonly reads: () => number;
} => {
  let reads = 0;
  return {
    fs: {
      readText: (path) => {
        const text = readFileSync(path, "utf8");
        reads += 1;
        return text;
      },
      listDirectory: (path) =>
        readdirSync(path, { withFileTypes: true }).map((entry) => ({
          name: entry.name,
          directory: entry.isDirectory(),
        })),
    },
    reads: () => reads,
  };
};

describe("TC-MEMNFR-002 scan cost and one read per file", () => {
  test("a 2,000-file tree scans within the declared bound with one read per file", () => {
    const root = mkdtempSync(join(tmpdir(), "gh301-perf-"));
    try {
      mkdirSync(join(root, ".ai/memory/agents/perf"), { recursive: true });
      writeFileSync(join(root, ".ai/memory/README.md"), "# Memory\n");
      for (let index = 0; index < FILES; index += 1) {
        writeFileSync(
          join(root, ".ai/memory/agents/perf", `topic-${String(index).padStart(4, "0")}.md`),
          `# topic ${index}\n`,
        );
      }
      const counter = countingFileSystem();
      const started = performance.now();
      const scanned = scanMemoryTree(root, MEMORY_ROOT, counter.fs);
      const result = evaluateMemory({
        files: scanned.files,
        today: "2026-11-15",
        privacy: EMPTY_VOCABULARY,
      });
      const elapsed = performance.now() - started;
      expect(scanned.files).toHaveLength(FILES + 1);
      expect(counter.reads()).toBe(FILES + 1);
      expect(result.findings).toEqual([]);
      console.log(
        `memory-lint scan: files=${scanned.files.length} elapsed=${elapsed.toFixed(1)}ms`,
      );
      expect(elapsed).toBeLessThan(1_000);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the timed path imports no child_process or fetch", () => {
    for (const relative of [
      "packages/core/src/domain/memory-lint.ts",
      "scripts/checks/memory-lint.ts",
    ]) {
      const source = readFileSync(join(ROOT, relative), "utf8");
      expect(source).not.toContain("node:child_process");
      expect(source).not.toContain("fetch(");
    }
  });
});
