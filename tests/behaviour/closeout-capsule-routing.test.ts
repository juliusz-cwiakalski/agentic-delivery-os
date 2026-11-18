/** TC-CAP-021 — the closed routing matrix and path confinement. */
import { describe, expect, test } from "bun:test";
import { candidateYaml, runPromotionCloseout } from "../fixtures/capsule/promotion";
import { checkPromotionConfinement } from "../../packages/adapters/src/file/memory-promotion";

const candidatesOf = (run: Awaited<ReturnType<typeof runPromotionCloseout>>) =>
  ((run.data?.capsule ?? {}) as Record<string, unknown>).candidates as Record<string, unknown>[];

describe("TC-CAP-021 promotion routing", () => {
  test("a lesson is home-written with one record and one index row", async () => {
    const run = await runPromotionCloseout({ candidates: { "a.yaml": candidateYaml() } });
    try {
      expect(run.exitCode).toBe(0);
      const candidates = candidatesOf(run);
      expect(candidates[0]?.decision).toBe("promoted");
      const home = candidates[0]?.home as string;
      expect(home).toMatch(/^lessons\/lesson-2026-001-/);
      expect(run.memory.exists(home)).toBe(true);
      expect(run.memory.read("README.md")).toContain(`\`${home}\``);
    } finally {
      run.cleanup();
    }
  });

  test("fact, decision, norm, and workflow are handoffs; preference and fleet are rejected", async () => {
    const run = await runPromotionCloseout({
      candidates: {
        "a.yaml": candidateYaml({ id: "fact-one", class: "fact", statement: "Fact statement." }),
        "b.yaml": candidateYaml({
          id: "decision-one",
          class: "decision",
          statement: "Decision statement.",
        }),
        "c.yaml": candidateYaml({ id: "norm-one", class: "norm", statement: "Norm statement." }),
        "d.yaml": candidateYaml({
          id: "workflow-one",
          class: "workflow",
          statement: "Workflow statement.",
        }),
        "e.yaml": candidateYaml({
          id: "preference-one",
          class: "preference",
          statement: "Preference statement.",
        }),
        "f.yaml": candidateYaml({ id: "fleet-one", class: "fleet", statement: "Fleet statement." }),
      },
    });
    try {
      const byId = new Map(candidatesOf(run).map((entry) => [entry.id, entry]));
      expect(byId.get("fact-one")?.home).toBe("doc/spec/**");
      expect(byId.get("decision-one")?.home).toBe("doc/decisions/**");
      expect(byId.get("norm-one")?.home).toBe("AGENTS.md");
      expect(byId.get("workflow-one")?.home).toBe("command/skill/playbook");
      expect(byId.get("preference-one")?.reason).toBe("home-not-implemented");
      expect(byId.get("fleet-one")?.reason).toBe("owner-approval-required");
    } finally {
      run.cleanup();
    }
  });

  test("the id allocator is monotonic across lessons and never reuses", async () => {
    const run = await runPromotionCloseout({
      candidates: { "a.yaml": candidateYaml({ statement: "A different statement." }) },
      memory: {
        records: {
          "lessons/lesson-2026-001-old.md":
            '---\nid: "lesson-2026-001"\nkind: "lesson"\nstatement: "Old."\nstatus: "candidate"\n---\n',
        },
      },
    });
    try {
      expect(candidatesOf(run)[0]?.home).toMatch(/^lessons\/lesson-2026-002-/);
    } finally {
      run.cleanup();
    }
  });

  test("the index budget refuses with index-budget-exceeded", async () => {
    const run = await runPromotionCloseout({
      candidates: { "a.yaml": candidateYaml() },
      memory: { readmeLines: 200 },
    });
    try {
      expect(candidatesOf(run)[0]?.reason).toBe("index-budget-exceeded");
      expect(run.memory.exists("README.md")).toBe(true);
    } finally {
      run.cleanup();
    }
  });

  test("a traversal path is refused before any write", () => {
    const memory = "/tmp/memory-root";
    expect(
      checkPromotionConfinement(memory, {
        candidateId: "x",
        class: "lesson",
        recordId: "lesson-2026-001",
        path: "../escape.md",
        content: "x",
        indexRow: "x",
      }).ok,
    ).toBe(false);
  });
});

describe("TC-CAP-021 promotion path confinement units", () => {
  test("a symlinked parent outside the memory root is an escape", async () => {
    const { mkdtempSync, symlinkSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const root = mkdtempSync(join(tmpdir(), "gh240-root-"));
    const outside = mkdtempSync(join(tmpdir(), "gh240-outside-"));
    try {
      symlinkSync(outside, join(root, "lessons"));
      const result = checkPromotionConfinement(root, {
        candidateId: "lesson-one",
        class: "lesson",
        recordId: "lesson-2026-001",
        path: "lessons/lesson-2026-001-x.md",
        content: "x",
        indexRow: "x",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("escape");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  test("a differing pre-existing target is a conflict, never an overwrite", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { applyPromotionWrite } = await import(
      "../../packages/adapters/src/file/memory-promotion"
    );
    const root = mkdtempSync(join(tmpdir(), "gh240-write-"));
    try {
      mkdirSync(join(root, "lessons"), { recursive: true });
      writeFileSync(join(root, "lessons/lesson-2026-001-x.md"), "ORIGINAL\n");
      const result = applyPromotionWrite(root, {
        candidateId: "lesson-one",
        class: "lesson",
        recordId: "lesson-2026-001",
        path: "lessons/lesson-2026-001-x.md",
        content: "DIFFERENT\n",
        indexRow: "| `lessons/lesson-2026-001-x.md` | x |",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("conflict");
      expect(readFileSync(join(root, "lessons/lesson-2026-001-x.md"), "utf8")).toBe("ORIGINAL\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
