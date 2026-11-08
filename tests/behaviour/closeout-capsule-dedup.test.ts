/** TC-CAP-019 — deterministic normalized-statement dedup, no similarity. */
import { describe, expect, test } from "bun:test";
import { candidateYaml, runPromotionCloseout } from "../fixtures/capsule/promotion";

describe("TC-CAP-019 deterministic dedup", () => {
  test("an existing normalized-statement match is rejected with the existing id", async () => {
    const statement = "Run the scoped gate first when the full gate is slow.";
    const run = await runPromotionCloseout({
      candidates: { "a.yaml": candidateYaml({ statement: `  ${statement.toUpperCase()} ` }) },
      memory: {
        records: {
          "lessons/lesson-2026-001-existing.md":
            '---\nid: "lesson-2026-001"\nkind: "lesson"\nstatement: "Run the scoped gate first when the full gate is slow."\nstatus: "candidate"\n---\n',
        },
      },
    });
    try {
      expect(run.exitCode).toBe(0);
      const candidates = ((run.data?.capsule ?? {}) as Record<string, unknown>)
        .candidates as Record<string, unknown>[];
      expect(candidates[0]).toEqual({
        id: "review-catch-fixture",
        decision: "rejected",
        reason: "duplicate:lesson-2026-001",
      });
    } finally {
      run.cleanup();
    }
  });

  test("sibling candidates with the same statement dedup in id order", async () => {
    const run = await runPromotionCloseout({
      candidates: {
        "a.yaml": candidateYaml({ id: "first-candidate", statement: "Same statement here." }),
        "b.yaml": candidateYaml({ id: "second-candidate", statement: " same   STATEMENT here. " }),
      },
    });
    try {
      const candidates = ((run.data?.capsule ?? {}) as Record<string, unknown>)
        .candidates as Record<string, unknown>[];
      expect(candidates.find((entry) => entry.id === "first-candidate")?.decision).toBe("promoted");
      expect(candidates.find((entry) => entry.id === "second-candidate")).toEqual({
        id: "second-candidate",
        decision: "rejected",
        reason: "duplicate:lesson-2026-001",
      });
    } finally {
      run.cleanup();
    }
  });

  test("a similar but not equal statement is not deduped", async () => {
    const run = await runPromotionCloseout({
      candidates: {
        "a.yaml": candidateYaml({
          statement: "Run the full gate first when the scoped gate is slow.",
        }),
      },
      memory: {
        records: {
          "lessons/lesson-2026-001-existing.md":
            '---\nid: "lesson-2026-001"\nkind: "lesson"\nstatement: "Run the scoped gate first when the full gate is slow."\nstatus: "candidate"\n---\n',
        },
      },
    });
    try {
      const candidates = ((run.data?.capsule ?? {}) as Record<string, unknown>)
        .candidates as Record<string, unknown>[];
      expect(candidates[0]?.decision).toBe("promoted");
    } finally {
      run.cleanup();
    }
  });
});
