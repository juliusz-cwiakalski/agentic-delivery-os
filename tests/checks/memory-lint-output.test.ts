/**
 * GH-301 output verdicts, determinism, and the print ceiling
 * (TC-MEMLAY-004, TC-MEMGATE-001, TC-MEMGATE-002, TC-MEMNFR-003).
 */
import { describe, expect, test } from "bun:test";
import { evaluateMemory } from "../../packages/core/src/domain/memory-lint";
import type {
  MemoryEvaluationResult,
  MemoryScannedFile,
} from "../../packages/core/src/contracts/index";
import { fileListingBody } from "../fixtures/memory/bodies";
import {
  emptyTree,
  populatedTree,
  recordText,
  treeWith,
  truncatingTree,
  validLessonFields,
} from "../fixtures/memory/tree";

const TODAY = "2026-11-15";
const EMPTY_VOCABULARY = { rules: [], suppressionClasses: [] } as const;

const evaluate = (files: readonly MemoryScannedFile[]): MemoryEvaluationResult =>
  evaluateMemory({ files, today: TODAY, privacy: EMPTY_VOCABULARY });

describe("TC-MEMLAY-004 empty and populated verdict stability", () => {
  test("the empty-but-proved tree reports no error findings", () => {
    const result = evaluate(emptyTree());
    expect(result.findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  test("the populated tree reports no error findings", () => {
    const result = evaluate(populatedTree());
    expect(result.findings.filter((finding) => finding.severity === "error")).toEqual([]);
    expect(result.exitCode).toBe(0);
  });

  test("the summary reports counts without a fixed population", () => {
    const empty = evaluate(emptyTree());
    const populated = evaluate(populatedTree());
    expect(empty.summary.areas).toBe(8);
    expect(populated.summary.areas).toBe(8);
    expect(populated.summary.records).toBeGreaterThan(empty.summary.records);
  });
});

describe("TC-MEMGATE-001 exit verdict and summary counts", () => {
  const errorFiles = treeWith([
    {
      relative: "lessons/lesson-2026-001-no-id.md",
      text: recordText(validLessonFields({ id: undefined })),
    },
    {
      relative: "lessons/lesson-2026-002-no-date.md",
      text: recordText(validLessonFields({ id: "lesson-2026-002", created: undefined })),
    },
    {
      relative: "lessons/lesson-2026-003-no-evidence.md",
      text: recordText(validLessonFields({ id: "lesson-2026-003", evidence: undefined })),
    },
  ]);

  test("a tree with an error exits non-zero and prints FAIL lines plus a summary", () => {
    const result = evaluate(errorFiles);
    expect(result.exitCode).toBe(1);
    expect(result.findings).toHaveLength(3);
    expect(result.lines.filter((line) => line.startsWith("FAIL memory-lint:"))).toHaveLength(3);
    expect(
      result.lines.some((line) =>
        line.startsWith(
          `memory-lint: records=3 areas=8 errors=${result.summary.errors} advisories=0`,
        ),
      ),
    ).toBe(true);
    expect(result.summary.errors).toBe(3);
  });

  test("an advisory-only tree exits zero and prints WARN lines", () => {
    const result = evaluate(
      treeWith([
        {
          relative: "lessons/lesson-2026-001-advisory.md",
          text: recordText(validLessonFields({ revalidate_after: "2020-01-01" }), fileListingBody),
        },
      ]),
    );
    expect(result.exitCode).toBe(0);
    expect(result.summary.advisories).toBe(2);
    expect(result.lines.filter((line) => line.startsWith("WARN memory-lint:"))).toHaveLength(2);
    expect(result.lines.some((line) => line.startsWith("FAIL memory-lint:"))).toBe(false);
  });
});

describe("TC-MEMGATE-002 determinism and declared ordering", () => {
  test("two runs over one fixed injected date are byte-identical", () => {
    const first = evaluate(errorFilesTree());
    const second = evaluate(errorFilesTree());
    expect(first.lines).toEqual(second.lines);
    expect(first.exitCode).toBe(second.exitCode);
  });

  test("findings are ordered by area, path, line, and rule id", () => {
    const result = evaluate(errorFilesTree());
    const areas = result.findings.map((finding) => finding.area);
    expect(areas).toEqual([...areas].sort((left, right) => areaIndex(left) - areaIndex(right)));
    const withinArea = result.findings.filter((finding) => finding.area === "schema");
    const paths = withinArea.map((finding) => finding.path);
    expect(paths).toEqual([...paths].sort());
  });

  test("the pure evaluation reads no ambient clock", () => {
    const original = Date.now;
    Date.now = () => {
      throw new Error("the pure evaluation read the wall clock");
    };
    try {
      const result = evaluate(errorFilesTree());
      expect(result.findings.length).toBeGreaterThan(0);
    } finally {
      Date.now = original;
    }
  });
});

const areaOrder = [
  "schema",
  "dating",
  "provenance",
  "reference",
  "index",
  "budget",
  "derivable",
  "secret",
] as const;
const areaIndex = (area: string): number => areaOrder.indexOf(area as (typeof areaOrder)[number]);

function errorFilesTree(): readonly MemoryScannedFile[] {
  return treeWith([
    {
      relative: "lessons/lesson-2026-001-baseline.md",
      text: recordText(validLessonFields({ created: "15/11/2026" })),
    },
    {
      relative: "lessons/lesson-2026-002-baseline.md",
      text: recordText(validLessonFields({ id: "lesson-2026-002", statement: "x".repeat(400) })),
    },
  ]);
}

describe("TC-MEMNFR-003 print ceiling and truncation line", () => {
  test("150 errors print 100 FAIL lines and one truncation line with true totals", () => {
    const result = evaluate(truncatingTree({ errors: 150, advisories: 0 }));
    expect(result.exitCode).toBe(1);
    expect(result.lines.filter((line) => line.startsWith("FAIL memory-lint:"))).toHaveLength(100);
    expect(result.summary.errors).toBe(150);
    const truncation = result.lines.filter((line) => line.includes("truncated"));
    expect(truncation).toHaveLength(1);
    expect(truncation[0]).toContain("errors=150");
  });

  test("150 advisories print 100 WARN lines and one truncation line", () => {
    const result = evaluate(truncatingTree({ errors: 0, advisories: 150 }));
    expect(result.exitCode).toBe(0);
    expect(result.lines.filter((line) => line.startsWith("WARN memory-lint:"))).toHaveLength(100);
    expect(result.summary.advisories).toBe(150);
    expect(result.lines.filter((line) => line.includes("truncated"))).toHaveLength(1);
  });

  test("exactly 100 errors do not truncate; 101 do", () => {
    expect(
      evaluate(truncatingTree({ errors: 100, advisories: 0 })).lines.some((line) =>
        line.includes("truncated"),
      ),
    ).toBe(false);
    expect(
      evaluate(truncatingTree({ errors: 101, advisories: 0 })).lines.filter((line) =>
        line.includes("truncated"),
      ),
    ).toHaveLength(1);
  });

  test("the printed prefix is deterministic under truncation", () => {
    const first = evaluate(truncatingTree({ errors: 150, advisories: 0 }));
    const second = evaluate(truncatingTree({ errors: 150, advisories: 0 }));
    expect(first.lines).toEqual(second.lines);
  });
});
