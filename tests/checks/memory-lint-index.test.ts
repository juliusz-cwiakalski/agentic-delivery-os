/**
 * GH-301 index coverage: both directions, row shape, and the archive universe
 * (TC-MEMINDEX-001, TC-MEMINDEX-002, TC-MEMINDEX-003, TC-MEMLAY-002 steps 2-4).
 */
import { describe, expect, test } from "bun:test";
import { evaluateMemory } from "../../packages/core/src/domain/memory-lint";
import {
  HINT_MAX_CHARS,
  type MemoryEvaluationResult,
} from "../../packages/core/src/contracts/index";
import {
  archiveIndexReadme,
  indexReadme,
  indexRow,
  memoryFile,
  recordText,
  validLessonFields,
} from "../fixtures/memory/tree";

const TODAY = "2026-11-15";
const EMPTY_VOCABULARY = { rules: [], suppressionClasses: [] } as const;
const LESSON = {
  relative: "lessons/lesson-2026-001-baseline.md",
  text: recordText(validLessonFields()),
};

const evaluate = (files: readonly ReturnType<typeof memoryFile>[]): MemoryEvaluationResult =>
  evaluateMemory({ files, today: TODAY, privacy: EMPTY_VOCABULARY });

const indexFindings = (result: MemoryEvaluationResult) =>
  result.findings.filter((finding) => finding.area === "index");

describe("TC-MEMINDEX-001 both-direction coverage independence", () => {
  test("a record with no row is record-uncovered", () => {
    const result = evaluate([
      memoryFile("README.md", indexReadme([])),
      memoryFile(LESSON.relative, LESSON.text),
    ]);
    expect(indexFindings(result).map((finding) => finding.ruleId)).toEqual([
      "memory.index.record-uncovered",
    ]);
    expect(indexFindings(result)[0]?.path).toBe(`.ai/memory/${LESSON.relative}`);
    expect(indexFindings(result)[0]?.detail).toContain("memory-index");
  });

  test("a row with no record is row-unbacked", () => {
    const result = evaluate([
      memoryFile(
        "README.md",
        indexReadme([indexRow("lessons/lesson-2026-999-missing.md", "read it")]),
      ),
    ]);
    expect(indexFindings(result).map((finding) => finding.ruleId)).toEqual([
      "memory.index.row-unbacked",
    ]);
    expect(indexFindings(result)[0]?.detail).toContain("memory-index");
  });

  test("one of each yields exactly two findings", () => {
    const result = evaluate([
      memoryFile(
        "README.md",
        indexReadme([indexRow("lessons/lesson-2026-999-missing.md", "read it")]),
      ),
      memoryFile(LESSON.relative, LESSON.text),
    ]);
    expect(
      indexFindings(result)
        .map((finding) => finding.ruleId)
        .sort(),
    ).toEqual(["memory.index.record-uncovered", "memory.index.row-unbacked"]);
    expect(indexFindings(result)).toHaveLength(2);
  });

  test("a fully covered tree reports nothing", () => {
    const result = evaluate([
      memoryFile("README.md", indexReadme([indexRow(LESSON.relative, "read it")])),
      memoryFile(LESSON.relative, LESSON.text),
    ]);
    expect(indexFindings(result)).toEqual([]);
  });
});

describe("TC-MEMINDEX-002 row shape, duplicates, and wrong targets", () => {
  const covered = (rows: readonly string[]) =>
    evaluate([
      memoryFile("README.md", indexReadme(rows)),
      memoryFile(LESSON.relative, LESSON.text),
    ]);

  test("an empty hint is hint-missing", () => {
    const result = covered([indexRow(LESSON.relative, "")]);
    expect(indexFindings(result).map((finding) => finding.ruleId)).toContain(
      "memory.index.hint-missing",
    );
  });

  test("an over-long hint is row-malformed with measured value and cap", () => {
    const result = covered([indexRow(LESSON.relative, "x".repeat(HINT_MAX_CHARS + 1))]);
    const finding = indexFindings(result).find(
      (entry) => entry.ruleId === "memory.index.row-malformed",
    );
    expect(finding?.detail).toContain(String(HINT_MAX_CHARS + 1));
    expect(finding?.detail).toContain(String(HINT_MAX_CHARS));
  });

  test("a duplicate row is row-duplicate", () => {
    const row = indexRow(LESSON.relative, "read it");
    const result = covered([row, row]);
    expect(indexFindings(result).map((finding) => finding.ruleId)).toEqual([
      "memory.index.row-duplicate",
    ]);
  });

  for (const target of ["agents/coder/topic.md", "retro/2026/2026-11-10-retro.md", "lessons/"]) {
    test(`a row for ${target} is row-unbacked in the memory universe`, () => {
      const result = covered([indexRow(LESSON.relative, "read it"), indexRow(target, "read it")]);
      const unbacked = indexFindings(result).filter(
        (finding) => finding.ruleId === "memory.index.row-unbacked",
      );
      expect(unbacked).toHaveLength(1);
      expect(unbacked[0]?.detail).toContain(target);
      expect(unbacked[0]?.detail).toContain("memory-index");
    });
  }

  test("hints at and just under the bound are silent", () => {
    for (const length of [HINT_MAX_CHARS - 1, HINT_MAX_CHARS]) {
      const result = covered([indexRow(LESSON.relative, "x".repeat(length))]);
      expect(result.findings).toEqual([]);
    }
  });
});

const archiveFiles = (input: {
  readonly memoryRows: readonly string[];
  readonly archiveRows: readonly string[];
  readonly notes: readonly string[];
}): ReturnType<typeof memoryFile>[] => [
  memoryFile("README.md", indexReadme(input.memoryRows)),
  memoryFile("retro/INDEX.md", archiveIndexReadme(input.archiveRows)),
  ...input.notes.map((note) => memoryFile(note, `# ${note}\n`)),
];

describe("TC-MEMINDEX-003 archive coverage over its own universe", () => {
  const notes = ["retro/2026/2026-11-10-retro.md", "retro/2026/2026-11-11-retro.md"];
  const archiveRows = notes.map((note) => indexRow(note, "read the retro"));
  const memoryRows = [indexRow("retro/INDEX.md", "read the archive")];

  test("exact archive coverage is silent", () => {
    const result = evaluate(archiveFiles({ memoryRows, archiveRows, notes }));
    expect(indexFindings(result)).toEqual([]);
  });

  test("a note with no archive row is archive-index record-uncovered only", () => {
    const result = evaluate(
      archiveFiles({ memoryRows, archiveRows: archiveRows.slice(0, 1), notes }),
    );
    const uncovered = indexFindings(result).filter(
      (finding) => finding.ruleId === "memory.index.record-uncovered",
    );
    expect(uncovered).toHaveLength(1);
    expect(uncovered[0]?.detail).toContain("archive-index");
    expect(indexFindings(result).some((finding) => finding.detail.includes("memory-index"))).toBe(
      false,
    );
  });

  test("an archive row backed by no note is archive-index row-unbacked", () => {
    const result = evaluate(
      archiveFiles({
        memoryRows,
        archiveRows: [...archiveRows, indexRow("retro/2026/2026-11-12-retro.md", "read")],
        notes,
      }),
    );
    expect(indexFindings(result).map((finding) => finding.ruleId)).toEqual([
      "memory.index.row-unbacked",
    ]);
    expect(indexFindings(result)[0]?.detail).toContain("archive-index");
  });

  test("a memory-index row for a retro note is row-unbacked in the memory universe", () => {
    const result = evaluate(
      archiveFiles({
        memoryRows: [...memoryRows, indexRow(notes[0] as string, "read")],
        archiveRows,
        notes,
      }),
    );
    expect(indexFindings(result).map((finding) => finding.ruleId)).toEqual([
      "memory.index.row-unbacked",
    ]);
    expect(indexFindings(result)[0]?.detail).toContain("memory-index");
  });

  test("the two universes stay independent in the other direction", () => {
    const result = evaluate(archiveFiles({ memoryRows: [], archiveRows, notes }));
    const uncovered = indexFindings(result).filter(
      (finding) => finding.ruleId === "memory.index.record-uncovered",
    );
    expect(uncovered).toHaveLength(1);
    expect(uncovered[0]?.path).toBe(".ai/memory/retro/INDEX.md");
    expect(uncovered[0]?.detail).toContain("memory-index");
  });

  test("the emitted index id set stays inside the five register ids", () => {
    const seen = new Set<string>();
    for (const result of [
      evaluate(archiveFiles({ memoryRows: [], archiveRows, notes })),
      evaluate(archiveFiles({ memoryRows, archiveRows: [], notes })),
      evaluate(
        archiveFiles({
          memoryRows: [...memoryRows, indexRow(notes[0] as string, "read")],
          archiveRows,
          notes,
        }),
      ),
    ]) {
      for (const finding of indexFindings(result)) seen.add(finding.ruleId);
    }
    expect([...seen].sort()).toEqual([
      "memory.index.record-uncovered",
      "memory.index.row-unbacked",
    ]);
  });
});

describe("TC-MEMLAY-002 placeholder, topic-file, and directory-row semantics", () => {
  test("placeholders and represented files are not covered; a directory row is unbacked", () => {
    const files = [
      memoryFile(
        "README.md",
        indexReadme([
          indexRow("agents/coder/README.md", "read it"),
          indexRow("retro/INDEX.md", "read the archive"),
          indexRow("lessons/", "read the lessons"),
        ]),
      ),
      memoryFile("agents/coder/README.md", "# coder\n"),
      memoryFile("agents/coder/topic.md", "# topic\n"),
      memoryFile(
        "retro/INDEX.md",
        archiveIndexReadme([indexRow("retro/2026/n.md", "read the note")]),
      ),
      memoryFile("retro/2026/n.md", "# note\n"),
      memoryFile("lessons/.gitkeep", ""),
    ];
    const result = evaluate(files);
    const index = indexFindings(result);
    expect(index).toHaveLength(1);
    expect(index[0]?.ruleId).toBe("memory.index.row-unbacked");
    expect(index[0]?.detail).toContain("lessons/");
    expect(index[0]?.detail).toContain("memory-index");
  });
});
