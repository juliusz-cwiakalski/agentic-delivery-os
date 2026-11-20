/**
 * GH-301 derivable-content advisories (TC-MEMHEUR-001, TC-MEMHEUR-002).
 */
import { describe, expect, test } from "bun:test";
import {
  type MemoryEvaluationResult,
  STATEMENT_MAX_CHARS,
} from "../../packages/core/src/contracts/index";
import { evaluateMemory } from "../../packages/core/src/domain/memory-lint";
import { cleanBody, commandEchoBody, fileListingBody } from "../fixtures/memory/bodies";
import { recordText, treeWith, validLessonFields } from "../fixtures/memory/tree";

const TODAY = "2026-11-15";
const EMPTY_VOCABULARY = { rules: [], suppressionClasses: [] } as const;

const evaluateBodies = (bodies: readonly string[]): MemoryEvaluationResult =>
  evaluateMemory({
    files: treeWith(
      bodies.map((body, index) => ({
        relative: `lessons/lesson-2026-${String(index + 1).padStart(3, "0")}-body.md`,
        text: recordText(
          validLessonFields({ id: `lesson-2026-${String(index + 1).padStart(3, "0")}` }),
          body,
        ),
      })),
    ),
    today: TODAY,
    privacy: EMPTY_VOCABULARY,
  });

describe("TC-MEMHEUR-001 derivable advisory classes", () => {
  test("a repository file listing is one file-listing advisory", () => {
    const result = evaluateBodies([fileListingBody]);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      "memory.derivable.file-listing",
    ]);
    expect(result.findings[0]?.severity).toBe("warn");
    expect(result.exitCode).toBe(0);
  });

  test("a restated workspace command is one command-echo advisory", () => {
    const result = evaluateBodies([commandEchoBody]);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      "memory.derivable.command-echo",
    ]);
    expect(result.findings[0]?.severity).toBe("warn");
  });

  test("both classes in one body yield two advisories and a reported count", () => {
    const result = evaluateBodies([`${fileListingBody}${commandEchoBody}`]);
    expect(result.findings.map((finding) => finding.ruleId)).toEqual([
      "memory.derivable.command-echo",
      "memory.derivable.file-listing",
    ]);
    expect(result.summary.advisories).toBe(2);
    expect(result.exitCode).toBe(0);
  });

  test("an ordinary code fence produces no derivable finding", () => {
    expect(evaluateBodies([cleanBody]).findings).toEqual([]);
  });
});

describe("TC-MEMHEUR-002 advisories never gate", () => {
  test("a clean record produces no derivable finding", () => {
    expect(evaluateBodies([""]).findings).toEqual([]);
  });

  test("advisory-only output keeps exit zero and prints WARN lines", () => {
    const result = evaluateBodies([fileListingBody]);
    expect(result.exitCode).toBe(0);
    expect(
      result.lines.some((line) => line.startsWith("WARN memory-lint: memory.derivable.")),
    ).toBe(true);
    expect(result.lines.some((line) => line.startsWith("FAIL memory-lint:"))).toBe(false);
  });

  test("an advisory survives alongside an error", () => {
    const files = treeWith([
      {
        relative: "lessons/lesson-2026-001-error.md",
        text: recordText(validLessonFields({ statement: "x".repeat(STATEMENT_MAX_CHARS + 1) })),
      },
      {
        relative: "lessons/lesson-2026-002-advisory.md",
        text: recordText(validLessonFields({ id: "lesson-2026-002" }), fileListingBody),
      },
    ]);
    const result = evaluateMemory({ files, today: TODAY, privacy: EMPTY_VOCABULARY });
    expect(result.exitCode).toBe(1);
    expect(
      result.findings.some((finding) => finding.ruleId === "memory.derivable.file-listing"),
    ).toBe(true);
    expect(result.lines.some((line) => line.startsWith("WARN memory-lint:"))).toBe(true);
  });
});
