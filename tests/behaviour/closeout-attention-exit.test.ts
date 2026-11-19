/** TC-CAP-034 (P6 subset) — apply data + exit 1, plan exit 0, failures carry no residue. */
import { describe, expect, test } from "bun:test";
import { ADAPTER_OPERATIONS } from "../../packages/core/src/contracts/index";
import { makeChangeTree } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import {
  makeFacts,
  makeProvider,
  makeWorkItem,
  observed,
  WORK_ITEM_REF,
} from "../fixtures/closeout/harness";
import {
  MILESTONE_DECLARATION,
  MILESTONE_TITLE,
  openItemMilestone,
} from "../fixtures/closeout/milestone";

const githubCapabilities = {
  supportedOperations: [...ADAPTER_OPERATIONS],
  declaredGaps: [],
  writableCarriers: [],
  readableCarriers: [],
} as const;

const humanFacts = () =>
  makeFacts({
    threadAuthorFacts: [
      { threadId: "PRRT_2", authorPrincipal: "@reviewer-bob", authorKind: "human" },
    ],
  });

/** A withheld milestone closure and nothing else (the routine success shape). */
const withheldMilestoneFacts = () =>
  makeFacts({
    provider: { systemName: "github", capabilities: githubCapabilities },
    observedWorkItem: observed(makeWorkItem({ milestone: MILESTONE_TITLE })),
    milestone: { declaration: MILESTONE_DECLARATION, observation: openItemMilestone() },
  });

const tree = () =>
  makeChangeTree({
    ref: WORK_ITEM_REF,
    month: "2026-11",
    name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
  });

describe("TC-CAP-034 attention exit", () => {
  test("apply returns data and exits 1 when residue remains", async () => {
    const change = tree();
    try {
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(change.changes),
        facts: humanFacts(),
      });
      expect(run.exitCode).toBe(1);
      expect(run.envelope.error).toBeUndefined();
      expect(closeoutData(run.envelope).residue?.length).toBe(1);
    } finally {
      change.cleanup();
    }
  });

  test("plan renders the residue and exits 0", async () => {
    const change = tree();
    try {
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF], {
        capsule: makeCapsuleRuntime(change.changes),
        facts: humanFacts(),
      });
      expect(run.exitCode).toBe(0);
      expect(closeoutData(run.envelope).residue?.length).toBe(1);
    } finally {
      change.cleanup();
    }
  });

  test("no residue exits 0 and a command-level failure carries no structured residue", async () => {
    const change = tree();
    try {
      const clean = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(change.changes),
        facts: makeFacts(),
      });
      expect(clean.exitCode).toBe(0);
    } finally {
      change.cleanup();
    }
    const failing = tree();
    try {
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(failing.changes),
        facts: humanFacts(),
        provider: makeProvider({
          writeWorkItem: { ok: false, code: "provider.payload.invalid", detail: "x" },
        }),
      });
      expect(run.exitCode).not.toBe(0);
      expect(run.envelope.data).toBeUndefined();
      expect(run.envelope.error).toBeDefined();
    } finally {
      failing.cleanup();
    }
  });
});

describe("AC-F4-3/AC-F4-7 a withheld milestone closure stays success-shaped", () => {
  test("the withheld residue alone applies at exit 0 and still reports the item", async () => {
    const change = tree();
    try {
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(change.changes),
        facts: withheldMilestoneFacts(),
      });
      expect(run.exitCode).toBe(0);
      expect(run.envelope.error).toBeUndefined();
      const residue = closeoutData(run.envelope).residue ?? [];
      expect(residue).toHaveLength(1);
      expect(residue[0]).toEqual({
        item: "closure-withheld",
        kind: "milestone-sync-withheld",
        location: WORK_ITEM_REF,
      });
      expect(run.provider.calls.filter((call) => call.kind === "closeMilestone")).toHaveLength(0);
    } finally {
      change.cleanup();
    }
  });

  test("another residue kind alongside it still projects the attention exit", async () => {
    const change = tree();
    try {
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(change.changes),
        facts: {
          ...withheldMilestoneFacts(),
          threadAuthorFacts: [
            { threadId: "PRRT_2", authorPrincipal: "@reviewer-bob", authorKind: "human" },
          ],
        },
      });
      expect(run.exitCode).toBe(1);
      const residue = closeoutData(run.envelope).residue ?? [];
      expect(residue.map((item) => item.kind)).toEqual([
        "unresolved-human-thread",
        "milestone-sync-withheld",
      ]);
    } finally {
      change.cleanup();
    }
  });
});

describe("TC-CAP-034 P7/P10 completing halves", () => {
  test("worktree refusal carries retained evidence and no data or structured residue", async () => {
    const change = tree();
    try {
      const facts = makeFacts({
        worktree: {
          present: true,
          safe: false,
          reason: "dirty",
          path: "/tmp/retained-worktree",
          head: "a".repeat(40),
        },
      });
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(change.changes),
        facts,
      });
      expect(run.exitCode).toBe(1);
      expect(run.envelope.data).toBeUndefined();
      const error = run.envelope.error as Record<string, unknown>;
      expect(error.code).toBe("closeout.branch.unsafe");
      expect(String(error.summary)).toContain("retained=1");
      expect(String(error.summary)).toContain("/tmp/retained-worktree");
      expect(String(error.summary)).toContain("condition=dirty");
    } finally {
      change.cleanup();
    }
  });

  test("plan mode renders the worktree refusal and its retained-worktree residue", async () => {
    const change = tree();
    try {
      const facts = makeFacts({
        worktree: {
          present: true,
          safe: false,
          reason: "locked",
          path: "/tmp/wt",
          head: "a".repeat(40),
        },
      });
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF], {
        capsule: makeCapsuleRuntime(change.changes),
        facts,
      });
      expect(run.exitCode).toBe(0);
      const data = closeoutData(run.envelope);
      const step = data.steps.find((entry) => entry.stepId === "worktree-cleanup");
      expect(step?.outcome).toBe("would-refuse");
      expect(data.residue?.some((item) => item.kind === "worktree-retained")).toBe(true);
    } finally {
      change.cleanup();
    }
  });

  test("a capsule family step failure is closeout.step.capsule.failed with no data", async () => {
    const { runPromotionCloseout, candidateYaml } = await import("../fixtures/capsule/promotion");
    const run = await runPromotionCloseout({
      candidates: { "a.yaml": candidateYaml() },
      promotionWrite: () => () => ({
        ok: false,
        code: "escape",
        detail: "resolved home is outside the memory root",
      }),
    });
    try {
      expect(run.exitCode).toBe(1);
      expect(run.data).toBeUndefined();
      expect(run.error?.code).toBe("closeout.step.capsule.failed");
      expect(String(run.error?.summary)).toContain("outside the memory root");
    } finally {
      run.cleanup();
    }
  });
});
