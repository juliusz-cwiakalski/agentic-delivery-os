/**
 * GH-301 concurrency proofs (TC-MEMCONC-001, TC-MEMCONC-002).
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { parse } from "yaml";
import { evaluateMemory } from "../../packages/core/src/domain/memory-lint";
import { evaluateCandidates } from "../../packages/core/src/domain/capsule-candidates";
import {
  applyPromotionWrite,
  readMemoryFacts,
} from "../../packages/adapters/src/file/memory-promotion";
import { scanMemoryTree } from "../../packages/adapters/src/file/memory-scan";
import { scanMemoryFolder } from "../fixtures/memory/tree";
import type {
  MemoryEvaluationResult,
  MemoryPrivacyVocabulary,
} from "../../packages/core/src/contracts/index";
import { candidateYaml, makeTempMemory } from "../fixtures/capsule/promotion";
import { indexReadme, indexRow, recordText, validLessonFields } from "../fixtures/memory/tree";

const TODAY = "2026-11-15";
const EMPTY_VOCABULARY: MemoryPrivacyVocabulary = { rules: [], suppressionClasses: [] };

const evaluateRoot = (root: string): MemoryEvaluationResult =>
  evaluateMemory({ files: scanMemoryTree(root).files, today: TODAY, privacy: EMPTY_VOCABULARY });

const evaluateFolder = (root: string): MemoryEvaluationResult =>
  evaluateMemory({ files: scanMemoryFolder(root), today: TODAY, privacy: EMPTY_VOCABULARY });

const git = (cwd: string, args: readonly string[]) =>
  spawnSync("git", args, { cwd, encoding: "utf8" });

const write = (root: string, relative: string, text: string): void => {
  const target = join(root, relative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
};

const rowCount = (root: string, path: string): number =>
  readFileSync(join(root, ".ai/memory/README.md"), "utf8")
    .split("\n")
    .filter((line) => line.includes(`\`${path}\``)).length;

const recordFor = (id: string, created: string): string =>
  recordText(validLessonFields({ id, created }));

const appendRow = (root: string, relative: string, hint: string): void => {
  const path = join(root, ".ai/memory/README.md");
  writeFileSync(path, `${readFileSync(path, "utf8")}${indexRow(relative, hint)}\n`);
};

const resolveUnion = (root: string): void => {
  const path = join(root, ".ai/memory/README.md");
  const kept: string[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (/^(<<<<<<<|=======|>>>>>>>)/.test(line)) continue;
    kept.push(line);
  }
  const deduped = [...new Set(kept)];
  writeFileSync(path, deduped.join("\n"));
};

describe("TC-MEMCONC-001 parallel branches: records and own entry points never conflict", () => {
  test("only the shared index conflicts and the scripted union covers both records", () => {
    const root = mkdtempSync(join(tmpdir(), "gh301-conc-"));
    try {
      expect(git(root, ["init", "-q"]).status).toBe(0);
      expect(git(root, ["config", "user.email", "agent@example.invalid"]).status).toBe(0);
      expect(git(root, ["config", "user.name", "Agent"]).status).toBe(0);
      write(
        root,
        ".ai/memory/README.md",
        indexReadme([
          indexRow("agents/agent-a/README.md", "read agent a"),
          indexRow("agents/agent-b/README.md", "read agent b"),
        ]),
      );
      write(root, ".ai/memory/agents/agent-a/README.md", "# agent a memory\n");
      write(root, ".ai/memory/agents/agent-b/README.md", "# agent b memory\n");
      write(root, ".ai/memory/lessons/.gitkeep", "");
      expect(git(root, ["add", "-A"]).status).toBe(0);
      expect(git(root, ["commit", "-qm", "base"]).status).toBe(0);
      const baseBranch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
      expect(git(root, ["checkout", "-qb", "feat/agent-a"]).status).toBe(0);
      write(
        root,
        ".ai/memory/lessons/lesson-2026-101-a.md",
        recordFor("lesson-2026-101", "2026-11-10"),
      );
      write(
        root,
        ".ai/memory/agents/agent-a/README.md",
        "# agent a memory\n\n- 2026-11-10: capture\n",
      );
      appendRow(root, "lessons/lesson-2026-101-a.md", "read record a");
      expect(git(root, ["add", "-A"]).status).toBe(0);
      expect(git(root, ["commit", "-qm", "agent a"]).status).toBe(0);
      const commitA = git(root, ["rev-parse", "HEAD"]).stdout.trim();
      expect(git(root, ["checkout", "-q", baseBranch]).status).toBe(0);
      expect(git(root, ["checkout", "-qb", "feat/agent-b"]).status).toBe(0);
      write(
        root,
        ".ai/memory/lessons/lesson-2026-102-b.md",
        recordFor("lesson-2026-102", "2026-11-11"),
      );
      write(
        root,
        ".ai/memory/agents/agent-b/README.md",
        "# agent b memory\n\n- 2026-11-11: capture\n",
      );
      appendRow(root, "lessons/lesson-2026-102-b.md", "read record b");
      expect(git(root, ["add", "-A"]).status).toBe(0);
      expect(git(root, ["commit", "-qm", "agent b"]).status).toBe(0);
      const commitB = git(root, ["rev-parse", "HEAD"]).stdout.trim();
      expect(git(root, ["checkout", "-q", baseBranch]).status).toBe(0);
      expect(git(root, ["merge", "--ff-only", "feat/agent-a"]).status).toBe(0);
      expect(git(root, ["merge", "feat/agent-b"]).status).toBe(1);
      const conflicted = git(root, ["diff", "--name-only", "--diff-filter=U"])
        .stdout.trim()
        .split("\n")
        .filter((line) => line.length > 0);
      expect(conflicted).toEqual([".ai/memory/README.md"]);
      resolveUnion(root);
      expect(git(root, ["add", ".ai/memory/README.md"]).status).toBe(0);
      expect(git(root, ["diff", "--name-only", "--diff-filter=U"]).stdout.trim()).toBe("");
      const merged = evaluateRoot(root);
      expect(merged.findings).toEqual([]);
      expect(rowCount(root, "lessons/lesson-2026-101-a.md")).toBe(1);
      expect(rowCount(root, "lessons/lesson-2026-102-b.md")).toBe(1);
      for (const commit of [commitA, commitB]) {
        const touched = git(root, ["show", "--name-only", "--format=", commit]).stdout;
        const agent = commit === commitA ? "agent-a" : "agent-b";
        const other = commit === commitA ? "agent-b" : "agent-a";
        expect(touched).not.toContain(`agents/${other}/`);
        expect(touched).toContain(`agents/${agent}/README.md`);
      }
      // Take-ours non-vacuity control: one dropped row is one uncovered record.
      write(
        root,
        ".ai/memory/README.md",
        git(root, ["show", "feat/agent-a:.ai/memory/README.md"]).stdout,
      );
      const ours = evaluateRoot(root);
      expect(
        ours.findings.filter((finding) => finding.ruleId === "memory.index.record-uncovered"),
      ).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("TC-MEMCONC-002 two promotion writes and idempotent re-run", () => {
  test("both record files, both rows, no duplicates, and a re-run adds nothing", () => {
    const memory = makeTempMemory();
    try {
      const documents = [
        { file: "a.yaml", value: parse(candidateYaml({ id: "lesson-2026-101", statement: "A." })) },
        { file: "b.yaml", value: parse(candidateYaml({ id: "lesson-2026-102", statement: "B." })) },
      ];
      const first = evaluateCandidates({
        documents,
        memory: readMemoryFacts(memory.root),
        decided: new Set(),
      });
      expect(first.schemaFailures).toEqual([]);
      expect(first.writes).toHaveLength(2);
      for (const write of first.writes)
        expect(applyPromotionWrite(memory.root, write).ok).toBe(true);
      const merged = evaluateFolder(memory.root);
      expect(merged.findings).toEqual([]);
      const rows = readFileSync(join(memory.root, "README.md"), "utf8");
      expect(rows.split("\n").filter((line) => line.includes("lesson-2026-101")).length).toBe(1);
      expect(rows.split("\n").filter((line) => line.includes("lesson-2026-102")).length).toBe(1);
      const again = evaluateCandidates({
        documents,
        memory: readMemoryFacts(memory.root),
        decided: new Set(["lesson-2026-101", "lesson-2026-102"]),
      });
      expect(again.writes).toEqual([]);
      writeFileSync(
        join(memory.root, "README.md"),
        `${readFileSync(join(memory.root, "README.md"), "utf8")}${first.writes[0]?.indexRow ?? ""}\n`,
      );
      const duplicate = evaluateFolder(memory.root);
      expect(
        duplicate.findings.some((finding) => finding.ruleId === "memory.index.row-duplicate"),
      ).toBe(true);
    } finally {
      memory.cleanup();
    }
  });
});
