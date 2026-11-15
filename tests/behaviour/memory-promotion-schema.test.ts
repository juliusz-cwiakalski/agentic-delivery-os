/**
 * GH-301 write-path alignment: full schema rendering, hint derivation, and the
 * capsule projection refusals (TC-MEMWRITE-001/002/004).
 */
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import {
  CAPSULE_CANDIDATE_REQUIRED_KEYS,
  CAPSULE_CANDIDATE_SCOPES,
  HINT_MAX_CHARS,
  MEMORY_RECORD_REQUIRED_KEYS,
  type MemoryEvaluationResult,
  type MemoryPrivacyVocabulary,
  STATEMENT_MAX_CHARS,
} from "../../packages/core/src/contracts/index";
import { evaluateMemory } from "../../packages/core/src/domain/memory-lint";
import { candidateYaml, runPromotionCloseout } from "../fixtures/capsule/promotion";
import { recordText, scanMemoryFolder, validLessonFields } from "../fixtures/memory/tree";

const TODAY = "2026-11-15";
const EMPTY_VOCABULARY: MemoryPrivacyVocabulary = { rules: [], suppressionClasses: [] };

const evaluateRoot = (root: string): MemoryEvaluationResult =>
  evaluateMemory({ files: scanMemoryFolder(root), today: TODAY, privacy: EMPTY_VOCABULARY });

const homeOf = (run: Awaited<ReturnType<typeof runPromotionCloseout>>): string =>
  ((
    ((run.data?.capsule ?? {}) as Record<string, unknown>).candidates as Record<string, unknown>[]
  )[0]?.home as string) ?? "";

const rowOf = (run: Awaited<ReturnType<typeof runPromotionCloseout>>, home: string): string => {
  const row = run.memory
    .read("README.md")
    .split("\n")
    .find((line) => line.includes(home));
  if (row === undefined) throw new Error(`no index row for ${home}`);
  return row;
};

const hintOf = (row: string): string => {
  const cells = row
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
  return cells[1] ?? "";
};

const frontmatterOf = (text: string): Record<string, unknown> => {
  const block = /^---\n([\s\S]*?)\n---/.exec(text)?.[1];
  if (block === undefined) throw new Error("record frontmatter is missing");
  return (parse(block) ?? {}) as Record<string, unknown>;
};

const recordFiles = (root: string): string[] => {
  const out: string[] = [];
  for (const area of ["lessons", "tacit", "preferences"]) {
    const directory = join(root, area);
    try {
      for (const name of readdirSync(directory)) {
        if (name.endsWith(".md")) out.push(`${area}/${name}`);
      }
    } catch {
      // absent area
    }
  }
  return out;
};

describe("TC-MEMWRITE-001 promotion renders the full schema and hint", () => {
  test("a promoted lesson renders every required key and evaluates clean", async () => {
    const run = await runPromotionCloseout({
      candidates: { "a.yaml": candidateYaml({ applies_when: "a change touches the gates" }) },
    });
    try {
      expect(run.exitCode).toBe(0);
      const home = homeOf(run);
      const fields = frontmatterOf(run.memory.read(home));
      for (const key of MEMORY_RECORD_REQUIRED_KEYS) expect(Object.keys(fields)).toContain(key);
      expect(fields.trust).toBe("T3");
      expect(fields.basis).toBe("review-catch");
      expect(fields.kind).toBe("lesson");
      const hint = hintOf(rowOf(run, home));
      expect(hint.length).toBeGreaterThan(0);
      expect(hint.length).toBeLessThanOrEqual(HINT_MAX_CHARS);
      expect(evaluateRoot(run.memory.root).findings).toEqual([]);
    } finally {
      run.cleanup();
    }
  });

  test("a promoted tacit record lands under tacit/ with the mapped kind", async () => {
    const run = await runPromotionCloseout({
      candidates: { "a.yaml": candidateYaml({ class: "tacit" }) },
    });
    try {
      expect(run.exitCode).toBe(0);
      const home = homeOf(run);
      expect(home.startsWith("tacit/")).toBe(true);
      expect(frontmatterOf(run.memory.read(home)).kind).toBe("tacit_fragment");
      expect(evaluateRoot(run.memory.root).findings).toEqual([]);
    } finally {
      run.cleanup();
    }
  });

  test("a supersession promotion leaves the whole tree lint-clean (F-1 round trip)", async () => {
    const targetRelative = "lessons/lesson-2026-001-old.md";
    const run = await runPromotionCloseout({
      candidates: {
        "a.yaml": candidateYaml({
          statement: "The newer statement that supersedes the old one.",
          supersedes: ["lesson-2026-001"],
        }),
      },
      memory: {
        indexRows: [`| \`${targetRelative}\` | read the superseded lesson |`],
        records: {
          [targetRelative]: recordText(validLessonFields()),
        },
      },
    });
    try {
      expect(run.exitCode).toBe(0);
      const home = homeOf(run);
      const target = frontmatterOf(run.memory.read(targetRelative));
      expect(target.status).toBe("superseded");
      expect(target.superseded_by).toBe(frontmatterOf(run.memory.read(home)).id);
      const result = evaluateRoot(run.memory.root);
      expect(result.findings.map((finding) => finding.ruleId)).toEqual([]);
    } finally {
      run.cleanup();
    }
  });
});

describe("TC-MEMWRITE-002 read-when hint derivation and bound", () => {
  test("applies_when becomes the hint and differs from the statement", async () => {
    const run = await runPromotionCloseout({
      candidates: {
        "a.yaml": candidateYaml({
          applies_when: "a change touches the quality gates",
          statement: "Run the scoped gate first.",
        }),
      },
    });
    try {
      const hint = hintOf(rowOf(run, homeOf(run)));
      expect(hint).toBe("a change touches the quality gates");
      expect(hint).not.toBe("Run the scoped gate first.");
    } finally {
      run.cleanup();
    }
  });

  test("without applies_when the hint falls back to the statement", async () => {
    const statement = "Run the scoped gate first when the full gate is slow.";
    const run = await runPromotionCloseout({
      candidates: { "a.yaml": candidateYaml({ statement }) },
    });
    try {
      expect(hintOf(rowOf(run, homeOf(run)))).toBe(statement);
    } finally {
      run.cleanup();
    }
  });

  test("an over-long applicability path renders a read-when phrase, not a truncation", async () => {
    const applicability = `when ${"x".repeat(HINT_MAX_CHARS + 50)}`;
    const run = await runPromotionCloseout({
      candidates: {
        "a.yaml": candidateYaml({
          applies_when: applicability,
          statement: "y".repeat(STATEMENT_MAX_CHARS),
        }),
      },
    });
    try {
      const hint = hintOf(rowOf(run, homeOf(run)));
      expect(hint.length).toBeGreaterThan(0);
      expect(hint.length).toBeLessThanOrEqual(HINT_MAX_CHARS);
      expect(hint).not.toBe(applicability.slice(0, HINT_MAX_CHARS));
      expect(applicability.startsWith(hint)).toBe(false);
      expect(evaluateRoot(run.memory.root).findings).toEqual([]);
    } finally {
      run.cleanup();
    }
  });

  test("a statement over the hint bound yields a derived hint, not a statement prefix", async () => {
    const statement = "z".repeat(STATEMENT_MAX_CHARS);
    const run = await runPromotionCloseout({
      candidates: { "a.yaml": candidateYaml({ statement }) },
    });
    try {
      const hint = hintOf(rowOf(run, homeOf(run)));
      expect(hint.length).toBeGreaterThan(0);
      expect(hint.length).toBeLessThanOrEqual(HINT_MAX_CHARS);
      expect(hint).not.toBe(statement.slice(0, HINT_MAX_CHARS));
      expect(statement.startsWith(hint)).toBe(false);
      expect(statement.includes(hint)).toBe(false);
      expect(evaluateRoot(run.memory.root).findings).toEqual([]);
    } finally {
      run.cleanup();
    }
  });
});

describe("TC-MEMWRITE-004 capsule reconciliation and refusals", () => {
  test("a source outside the four channels is capsule-invalid with zero writes", async () => {
    const run = await runPromotionCloseout({
      candidates: { "a.yaml": candidateYaml({ source: "anecdotally" }) },
    });
    try {
      expect(run.exitCode).toBe(1);
      expect(run.error?.code).toBe("closeout.capsule-invalid");
      expect(recordFiles(run.memory.root)).toEqual([]);
      expect(run.memory.read("README.md")).not.toContain("review-catch-fixture");
    } finally {
      run.cleanup();
    }
  });

  test("every declared source channel is accepted", async () => {
    for (const source of ["review_verdict", "ci_verdict", "human_correction", "merged_pr"]) {
      const run = await runPromotionCloseout({
        candidates: {
          "a.yaml": candidateYaml({
            source,
            id: `lesson-2026-${String(source.length).padStart(3, "0")}`,
          }),
        },
      });
      try {
        expect({ source, exitCode: run.exitCode }).toEqual({ source, exitCode: 0 });
      } finally {
        run.cleanup();
      }
    }
  });

  for (const candidateClass of ["lesson", "tacit"] as const) {
    test(`a ${candidateClass} candidate with scope fleet is refused before any write`, async () => {
      const run = await runPromotionCloseout({
        candidates: { "a.yaml": candidateYaml({ class: candidateClass, scope: "fleet" }) },
      });
      try {
        expect(run.exitCode).toBe(1);
        expect(run.error?.code).toBe("closeout.capsule-invalid");
        expect(recordFiles(run.memory.root)).toEqual([]);
        expect(run.memory.read("README.md")).not.toContain("review-catch-fixture");
        for (const file of recordFiles(run.memory.root)) {
          expect(run.memory.read(file)).not.toContain('scope: "fleet"');
        }
        expect(CAPSULE_CANDIDATE_SCOPES).toContain("fleet");
      } finally {
        run.cleanup();
      }
    });
  }

  test("the class-level fleet candidate keeps its delivered rejection", async () => {
    const run = await runPromotionCloseout({
      candidates: { "a.yaml": candidateYaml({ class: "fleet" }) },
    });
    try {
      const candidates = ((run.data?.capsule ?? {}) as Record<string, unknown>)
        .candidates as Record<string, unknown>[];
      expect(candidates[0]?.reason).toBe("owner-approval-required");
    } finally {
      run.cleanup();
    }
  });

  test("the candidate contract keeps its key set and closed scope vocabulary", () => {
    expect([...CAPSULE_CANDIDATE_REQUIRED_KEYS]).toEqual([
      "id",
      "class",
      "scope",
      "statement",
      "evidence",
      "basis",
      "source",
      "trust",
      "status",
      "created_by",
      "created",
    ]);
    expect(CAPSULE_CANDIDATE_SCOPES).toContain("fleet");
  });

  test("a candidate one character over the statement bound is refused with zero writes", async () => {
    const run = await runPromotionCloseout({
      candidates: {
        "a.yaml": candidateYaml({ statement: "x".repeat(STATEMENT_MAX_CHARS + 1) }),
      },
    });
    try {
      expect(run.exitCode).toBe(1);
      expect(run.error?.code).toBe("closeout.capsule-invalid");
      expect(recordFiles(run.memory.root)).toEqual([]);
      expect(run.memory.read("README.md")).not.toContain("review-catch-fixture");
    } finally {
      run.cleanup();
    }
  });

  test("a candidate exactly at the statement bound promotes and lints clean", async () => {
    const run = await runPromotionCloseout({
      candidates: {
        "a.yaml": candidateYaml({ statement: "x".repeat(STATEMENT_MAX_CHARS) }),
      },
    });
    try {
      expect(run.exitCode).toBe(0);
      const home = homeOf(run);
      expect(frontmatterOf(run.memory.read(home)).statement).toBe("x".repeat(STATEMENT_MAX_CHARS));
      expect(evaluateRoot(run.memory.root).findings).toEqual([]);
    } finally {
      run.cleanup();
    }
  });
});
