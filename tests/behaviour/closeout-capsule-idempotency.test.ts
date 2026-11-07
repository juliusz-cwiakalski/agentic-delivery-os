/** TC-CAP-022/023 — re-run stability and the pre-existing-target matrix. */
import { describe, expect, test } from "bun:test";
import { candidateYaml, runPromotionCloseout } from "../fixtures/capsule/promotion";

describe("TC-CAP-022/023 promotion idempotency", () => {
  test("a re-run appends no duplicate decision, record, or index row", async () => {
    const first = await runPromotionCloseout({ candidates: { "a.yaml": candidateYaml() } });
    const tree = first.tree;
    const memory = first.memory;
    const capsule = first.capsule;
    const { makePromotionRuntime } = await import("../fixtures/capsule/promotion");
    const { runCloseoutCli } = await import("../fixtures/closeout/cli");
    const { WORK_ITEM_REF } = await import("../fixtures/closeout/harness");
    try {
      expect(first.exitCode).toBe(0);
      const home = (
        ((first.data?.capsule ?? {}) as Record<string, unknown>).candidates as Record<
          string,
          unknown
        >[]
      )[0]?.home as string;
      const record = memory.read(home);
      const indexRow = memory.read("README.md");
      const promotion = makePromotionRuntime(memory, capsule, WORK_ITEM_REF);
      const second = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule,
        promotion,
      });
      expect(second.exitCode).toBe(0);
      expect(memory.read(home)).toBe(record);
      expect(memory.read("README.md")).toBe(indexRow);
      const events = capsule.read(WORK_ITEM_REF);
      expect(events.ok).toBe(true);
      if (!events.ok) return;
      expect(events.events.filter((event) => event.kind === "capsule.promotion").length).toBe(1);
      expect(tree.folder).toContain("GH-183");
    } finally {
      first.cleanup();
    }
  });

  test("a byte-identical pre-existing target is a satisfied no-op", async () => {
    const statement = "Run the scoped gate first when the full gate is slow.";
    const content = `---\nid: "lesson-2026-001"\nkind: "lesson"\nscope: "repo"\nstatement: "${statement}"\nevidence: "review-verdict:review-iter-1"\nsource: "review_verdict"\ncreated_by: "coder"\ncreated: "2026-11-07"\nstatus: "candidate"\nsupersedes: []\n---\n`;
    const run = await runPromotionCloseout({
      candidates: { "a.yaml": candidateYaml({ id: "lesson-2026-001", statement }) },
      memory: {
        records: {
          "lessons/lesson-2026-001-review-catch-fixture.md": content,
        },
      },
    });
    try {
      const candidates = ((run.data?.capsule ?? {}) as Record<string, unknown>)
        .candidates as Record<string, unknown>[];
      expect(candidates[0]?.decision).toBe("promoted");
      expect(run.memory.read("lessons/lesson-2026-001-review-catch-fixture.md")).toBe(content);
      expect(run.memory.read("README.md")).not.toContain("review-catch-fixture");
    } finally {
      run.cleanup();
    }
  });

  test("a same-id different-content target is duplicate:<existing-id>", async () => {
    const run = await runPromotionCloseout({
      candidates: {
        "a.yaml": candidateYaml({ id: "lesson-2026-001", statement: "Different statement." }),
      },
      memory: {
        records: {
          "lessons/lesson-2026-001-old.md":
            '---\nid: "lesson-2026-001"\nkind: "lesson"\nstatement: "Old statement."\nstatus: "candidate"\n---\n',
        },
      },
    });
    try {
      const candidates = ((run.data?.capsule ?? {}) as Record<string, unknown>)
        .candidates as Record<string, unknown>[];
      expect(candidates[0]?.reason).toBe("duplicate:lesson-2026-001");
      expect(run.memory.read("lessons/lesson-2026-001-old.md")).toContain("Old statement.");
    } finally {
      run.cleanup();
    }
  });
});
