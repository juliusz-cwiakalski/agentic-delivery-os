/** TC-CAP-020 — explicit contradiction pairing and target-existence first. */
import { describe, expect, test } from "bun:test";
import { evaluateMemory } from "../../packages/core/src/domain/memory-lint";
import { candidateYaml, runPromotionCloseout } from "../fixtures/capsule/promotion";
import { recordText, scanMemoryFolder, validLessonFields } from "../fixtures/memory/tree";

const TODAY = "2026-11-15";
const EMPTY_VOCABULARY = { rules: [], suppressionClasses: [] } as const;

const existing = {
  "lessons/lesson-2026-001-old.md":
    '---\nid: "lesson-2026-001"\nkind: "lesson"\nstatement: "Old statement."\nstatus: "candidate"\n---\n',
};

const decisionOf = (run: Awaited<ReturnType<typeof runPromotionCloseout>>) =>
  (
    ((run.data?.capsule ?? {}) as Record<string, unknown>).candidates as Record<string, unknown>[]
  )[0];

describe("TC-CAP-020 supersession", () => {
  test("a contradicting candidate without supersedes is rejected", async () => {
    const run = await runPromotionCloseout({
      candidates: { "a.yaml": candidateYaml({ contradicts: ["lesson-2026-001"] }) },
      memory: { records: existing },
    });
    try {
      expect(decisionOf(run)?.reason).toBe("contradiction-requires-supersession");
    } finally {
      run.cleanup();
    }
  });

  test("an unknown target is supersedes-unknown", async () => {
    const run = await runPromotionCloseout({
      candidates: { "a.yaml": candidateYaml({ supersedes: ["lesson-2099-999"] }) },
    });
    try {
      expect(decisionOf(run)?.reason).toBe("supersedes-unknown");
    } finally {
      run.cleanup();
    }
  });

  test("a path-shaped target is supersedes-unknown with zero writes", async () => {
    const run = await runPromotionCloseout({
      candidates: { "a.yaml": candidateYaml({ supersedes: ["../escape"] }) },
    });
    try {
      expect(decisionOf(run)?.reason).toBe("supersedes-unknown");
      expect(run.memory.exists("lessons")).toBe(true);
    } finally {
      run.cleanup();
    }
  });

  test("an explicit pair promotes and marks the old record superseded", async () => {
    const run = await runPromotionCloseout({
      candidates: {
        "a.yaml": candidateYaml({
          supersedes: ["lesson-2026-001"],
          contradicts: ["lesson-2026-001"],
          statement: "New statement.",
        }),
      },
      memory: { records: existing },
    });
    try {
      expect(decisionOf(run)?.decision).toBe("promoted");
      const old = run.memory.read("lessons/lesson-2026-001-old.md");
      expect(old).toContain('status: "superseded"');
      expect(old).toContain('superseded_by: "lesson-2026-002"');
    } finally {
      run.cleanup();
    }
  });

  test("a supersession over a schema-valid target leaves the tree lint-clean (F-1 round trip)", async () => {
    const targetRelative = "lessons/lesson-2026-001-old.md";
    const run = await runPromotionCloseout({
      candidates: {
        "a.yaml": candidateYaml({
          supersedes: ["lesson-2026-001"],
          statement: "The replacement statement for the superseded lesson.",
        }),
      },
      memory: {
        indexRows: [`| \`${targetRelative}\` | read the superseded lesson |`],
        records: { [targetRelative]: recordText(validLessonFields()) },
      },
    });
    try {
      expect(run.exitCode).toBe(0);
      const old = run.memory.read(targetRelative);
      expect(old).toContain('status: "superseded"');
      const result = evaluateMemory({
        files: scanMemoryFolder(run.memory.root),
        today: TODAY,
        privacy: EMPTY_VOCABULARY,
      });
      expect(result.findings.map((finding) => finding.ruleId)).toEqual([]);
      expect(result.exitCode).toBe(0);
    } finally {
      run.cleanup();
    }
  });
});
