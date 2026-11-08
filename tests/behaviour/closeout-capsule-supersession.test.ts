/** TC-CAP-020 — explicit contradiction pairing and target-existence first. */
import { describe, expect, test } from "bun:test";
import { candidateYaml, runPromotionCloseout } from "../fixtures/capsule/promotion";

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
    } finally {
      run.cleanup();
    }
  });
});
