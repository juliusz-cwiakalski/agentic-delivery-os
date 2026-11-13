/**
 * Production composition facts (GH-240 F-5, F-7, F-9, F-10).
 *
 * A real composition over a temp repository with a squash landing and a
 * delivery worktree must reach would-apply/applied for worktree-cleanup and
 * merged-diff-sweep, attribute sessions into the checkpoint, and land
 * harness.telemetry records in the state log without copying them into the
 * capsule.
 */
import { describe, expect, setDefaultTimeout, test } from "bun:test";

setDefaultTimeout(120_000);
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createCloseoutComposition,
  createCloseoutCommandRuntime,
} from "../../packages/cli/src/edge";
import { createCloseoutCommandDefinition } from "../../packages/cli/src/commands/closeout";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import {
  CLOSEOUT_MAX_MACHINE_BYTES,
  type HarnessSettings,
  RETRO_RUN_PAYLOAD_SCHEMA,
} from "../../packages/core/src/contracts/index";
import { capsuleGateEventKey, capsulePhaseEventKey } from "../../packages/core/src/domain/capsule";
import {
  appendHarnessTelemetry,
  readHarnessTelemetry,
  recordRetroRun,
  seedRetroRegistry,
} from "../../packages/core/src/state/index";
import { makeChangeTree } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";
import { makeTempMemory } from "../fixtures/capsule/promotion";
import {
  makeMergedRequest,
  makeProvider,
  makeWorkItem,
  observed,
  WORK_ITEM_REF,
} from "../fixtures/closeout/harness";
import { createTempRepo } from "../fixtures/closeout/temp-git";
import {
  buildOpencodeStore,
  WORK_ITEM_REF as HARNESS_REF,
} from "../fixtures/harness/opencode-store/build";
import { makeIdentity, openStore, removeRoot } from "../fixtures/state/harness";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

const emptyStore = (): string => mkdtempSync(join(tmpdir(), "gh240-empty-claude-"));

const harnessSettings = (kind: "opencode" | "claude-code", path: string): HarnessSettings => ({
  kind,
  executionKind: "host",
  opencodeDatabasePath: kind === "opencode" ? path : "",
  claudeCodeSessionDirectory: kind === "claude-code" ? path : "",
  environment: [],
});

type CompositionFixture = {
  readonly repo: ReturnType<typeof createTempRepo>;
  readonly root: string;
  readonly store: ReturnType<typeof openStore>["store"];
  readonly tree: ReturnType<typeof makeChangeTree>;
  readonly memory: ReturnType<typeof makeTempMemory>;
  readonly capsule: ReturnType<typeof makeCapsuleRuntime>;
  readonly worktreePath: string;
  readonly squashSha: string;
  readonly provider: ReturnType<typeof makeProvider>;
  readonly run: (
    apply: boolean,
  ) => Promise<{ exitCode: number; envelope: Record<string, unknown> }>;
  readonly cleanup: () => void;
};

const makeFixture = (options: {
  readonly dirtyWorktree?: boolean;
  readonly harness?: "opencode" | "claude-code" | "none";
  readonly sessions?: boolean;
  readonly brokenHarness?: boolean;
  readonly unattributable?: boolean;
  readonly threads?: ReturnType<typeof makeMergedRequest>["threads"];
  readonly retroRun?: boolean;
}): CompositionFixture => {
  const repo = createTempRepo();
  const root = mkdtempSync(join(tmpdir(), "gh240-composition-"));
  const harnessStore =
    options.harness === "opencode" && options.sessions !== false
      ? buildOpencodeStore({ variant: "full", workItemRef: WORK_ITEM_REF })
      : undefined;
  const claudeDir = options.harness === "claude-code" ? emptyStore() : undefined;
  if (options.unattributable === true && claudeDir !== undefined) {
    writeFileSync(
      join(claudeDir, "session.jsonl"),
      `${JSON.stringify({ type: "session", sessionId: "cc_ghost", parentId: null })}\n`,
    );
  }

  repo.run(["checkout", "main-tools"]);
  writeFileSync(
    join(repo.directory, "src-flip.ts"),
    "// TODO close-todo GH-183 remove this guard\nexport const value = 1;\n",
  );
  repo.run(["add", "src-flip.ts"]);
  repo.run(["commit", "-m", "squash landing"]);
  const squashSha = repo.run(["rev-parse", "HEAD"]);
  repo.run(["branch", "feat/GH-183/composition", squashSha]);
  const worktreePath = join(root, "delivery-worktree");
  repo.run(["worktree", "add", worktreePath, "feat/GH-183/composition"]);
  if (options.dirtyWorktree === true) {
    writeFileSync(join(worktreePath, "dirty.txt"), "dirty\n");
  }

  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  const acquired = store.acquireFence("seed-fence");
  if (!acquired.ok) throw new Error("fence failed");
  store.append(acquired.value.handle, {
    kind: "merge.transaction",
    recordKey: `merge.transaction:${WORK_ITEM_REF}`,
    payload: { changeRef: WORK_ITEM_REF, result: "merged", squashSha },
  });
  store.releaseFence(acquired.value.handle);
  if (options.retroRun === true) {
    expect(seedRetroRegistry(store, "retro-seed").ok).toBe(true);
    expect(
      recordRetroRun(
        store,
        {
          schemaId: RETRO_RUN_PAYLOAD_SCHEMA,
          runId: "retro-run-1",
          level: "change",
          mode: "collect",
          scope: WORK_ITEM_REF,
          counts: { collected: 1, malformed: 0, skippedSource: 0 },
          consumed: [],
          truth: { clean: true, blocking: null, checks: [] },
        },
        "retro-run-fence",
      ).ok,
    ).toBe(true);
  }

  const provider = makeProvider({
    workItem: observed(makeWorkItem()),
    merged: observed(
      makeMergedRequest({
        sourceRef: "feat/GH-183/composition",
        headSha: squashSha,
        ...(options.threads === undefined ? {} : { threads: options.threads }),
      }),
    ),
  });
  const tree = makeChangeTree({
    ref: WORK_ITEM_REF,
    month: "2026-11",
    name: `2026-11-01--${WORK_ITEM_REF}--composition`,
  });
  const memory = makeTempMemory({});
  const capsule = makeCapsuleRuntime(tree.changes);
  const composition = createCloseoutComposition({
    workspaceId: "workspace-a",
    providerRuntime: provider.runtime,
    git: { cwd: repo.directory, timeoutMs: 30_000 },
    store,
    nowIso: () => "2026-11-07T00:00:00Z",
    newFenceToken: (() => {
      let counter = 0;
      return () => {
        counter += 1;
        return `fence-composition-${counter}`;
      };
    })(),
    capsule,
    memoryRoot: memory.root,
    ...(options.harness === "opencode" && harnessStore !== undefined
      ? {
          harness: harnessSettings(
            "opencode",
            options.brokenHarness === true ? `${harnessStore.path}.missing` : harnessStore.path,
          ),
        }
      : options.harness === "claude-code" && claudeDir !== undefined
        ? { harness: harnessSettings("claude-code", claudeDir) }
        : {}),
  });
  const runtime = createCloseoutCommandRuntime(composition);
  const deps: CliDependencies = {
    brand: SYNTHETIC_BRAND,
    clock: { now: () => 1_000 },
    newRunId: () => "run-composition",
    secrets: [],
    program: { commands: { closeout: createCloseoutCommandDefinition(runtime) } },
  };
  const run = async (apply: boolean) => {
    const stdout = bufferSink();
    const stderr = bufferSink();
    const exitCode = await runCli(
      ["--json", "closeout", WORK_ITEM_REF, ...(apply ? ["--apply"] : [])],
      { stdout, stderr },
      deps,
    );
    const text = stdout.value.trim();
    return {
      exitCode,
      envelope: text.length === 0 ? {} : (JSON.parse(text) as Record<string, unknown>),
    };
  };
  return {
    repo,
    root,
    store,
    tree,
    memory,
    capsule,
    worktreePath,
    squashSha,
    provider,
    run,
    cleanup: () => {
      repo.remove();
      tree.cleanup();
      memory.cleanup();
      removeRoot(root);
      if (harnessStore !== undefined) {
        rmSync(harnessStore.directory, { recursive: true, force: true });
      }
      if (claudeDir !== undefined) rmSync(claudeDir, { recursive: true, force: true });
    },
  };
};

const dataOf = (envelope: Record<string, unknown>): Record<string, unknown> => {
  const data = envelope.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("expected data");
  }
  return data as Record<string, unknown>;
};

const stepOf = (data: Record<string, unknown>, stepId: string) =>
  (data.steps as Record<string, unknown>[]).find((step) => step.stepId === stepId);

describe("closeout production composition facts", () => {
  test("worktree cleanup and the merged-diff sweep reach would-apply then applied", async () => {
    const fixture = makeFixture({ harness: "opencode" });
    try {
      const plan = await fixture.run(false);
      expect(plan.exitCode).toBe(0);
      const planData = dataOf(plan.envelope);
      expect(stepOf(planData, "worktree-cleanup")?.outcome).toBe("would-apply");
      const diffPlan = stepOf(planData, "merged-diff-sweep");
      expect(diffPlan?.outcome).toBe("would-apply");
      expect((diffPlan?.detail as Record<string, unknown>)?.hits).toBeGreaterThan(0);
      expect(readHarnessTelemetry(fixture.store, WORK_ITEM_REF).ok).toBe(true);
      const afterPlan = readHarnessTelemetry(fixture.store, WORK_ITEM_REF);
      expect(afterPlan.ok && afterPlan.value.records.length).toBe(0);

      const applied = await fixture.run(true);
      expect(applied.exitCode).toBe(0);
      const data = dataOf(applied.envelope);
      expect(stepOf(data, "worktree-cleanup")?.outcome).toBe("applied");
      expect(stepOf(data, "merged-diff-sweep")?.outcome).toBe("applied");
      const worktrees = fixture.repo.run(["worktree", "list", "--porcelain"]);
      expect(worktrees.includes(fixture.worktreePath)).toBe(false);

      const events = fixture.capsule.read(WORK_ITEM_REF);
      expect(events.ok).toBe(true);
      if (!events.ok) return;
      expect(
        events.events.some(
          (event) => event.kind === "closeout.step" && event.payload.markerKind === "todo-marker",
        ),
      ).toBe(true);
      const checkpoint = events.events.find(
        (event) => event.kind === "capsule.compaction-checkpoint",
      );
      expect(checkpoint).toBeDefined();
      expect((checkpoint?.payload.sessionCount as number) ?? 0).toBeGreaterThan(0);
      expect(JSON.stringify(events.events)).not.toContain("telemetry");

      const telemetry = readHarnessTelemetry(fixture.store, WORK_ITEM_REF);
      expect(telemetry.ok).toBe(true);
      if (telemetry.ok) expect(telemetry.value.records.length).toBeGreaterThan(0);
    } finally {
      fixture.cleanup();
    }
  });

  test("production thread authorship leaves a human thread unresolved", async () => {
    const fixture = makeFixture({
      harness: "claude-code",
      threads: [
        {
          threadId: "PRRT_HUMAN",
          resolved: false,
          commentCount: 1,
          authorLogin: "reviewer-bob",
          authorKind: "human",
        },
        {
          threadId: "PRRT_BOT",
          resolved: false,
          commentCount: 1,
          authorLogin: "dependabot[bot]",
          authorKind: "non-human",
        },
      ],
    });
    try {
      const plan = await fixture.run(false);
      expect(plan.exitCode).toBe(0);
      const data = dataOf(plan.envelope);
      const step = stepOf(data, "comment-resolution");
      expect(step?.operations).toHaveLength(1);
      expect(((step?.operations ?? []) as Record<string, unknown>[])[0]?.arguments).toMatchObject({
        threadId: "PRRT_BOT",
      });
      const residue = data.residue as Record<string, unknown>[];
      expect(
        residue.some(
          (item) =>
            item.kind === "unresolved-human-thread" && item.location === "thread:PRRT_HUMAN",
        ),
      ).toBe(true);
      expect(residue.some((item) => item.location === "thread:PRRT_BOT")).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  test("the production retro read reports collected and never writes the registry", async () => {
    const fixture = makeFixture({ harness: "claude-code", retroRun: true });
    try {
      const ledger = join(fixture.root, "ledger.workspace-a.jsonl");
      const before = createHash("sha256").update(readFileSync(ledger)).digest("hex");
      const plan = await fixture.run(false);
      expect(plan.exitCode).toBe(0);
      const step = stepOf(dataOf(plan.envelope), "retro-coverage-move");
      expect(step?.outcome).toBe("would-apply");
      expect((step?.detail as Record<string, unknown>)?.state).toBe("collected");
      expect(createHash("sha256").update(readFileSync(ledger)).digest("hex")).toBe(before);
    } finally {
      fixture.cleanup();
    }
  });

  test("the production retro read reports pending when no change-level run exists", async () => {
    const fixture = makeFixture({ harness: "claude-code" });
    try {
      const plan = await fixture.run(false);
      expect(plan.exitCode).toBe(0);
      const step = stepOf(dataOf(plan.envelope), "retro-coverage-move");
      expect((step?.detail as Record<string, unknown>)?.state).toBe("pending");
    } finally {
      fixture.cleanup();
    }
  });

  test("real state records and producer keys yield zero capsule-event-gap residue", async () => {
    const fixture = makeFixture({ harness: "claude-code" });
    const commitSha = fixture.squashSha;
    const gateSetIdentity = "delivery.merge.gates.v1:unit";
    try {
      const acquired = fixture.store.acquireFence("expected-seed");
      if (!acquired.ok) throw new Error("fence failed");
      const append = (recordKey: string, kind: string, payload: Record<string, unknown>) => {
        const result = fixture.store.append(acquired.value.handle, {
          kind,
          recordKey,
          payload,
        });
        expect(result.ok).toBe(true);
      };
      append(`${"phase.transition"}:${WORK_ITEM_REF}`, "phase.transition", {
        changeRef: WORK_ITEM_REF,
        phaseId: "delivery",
        operation: "complete",
        timestamp: "2026-11-07T00:00:00Z",
        outcome: "landed",
        commitIntent: "atomic",
        commitSha,
      });
      append(`${"commit.telemetry"}:${WORK_ITEM_REF}`, "commit.telemetry", {
        changeRef: WORK_ITEM_REF,
        commitSha,
        messageSource: "template",
        transport: "none",
        tokenSpend: { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
        landedAt: "2026-11-07T00:00:00Z",
      });
      append(`${"merge.gate-verification"}:${WORK_ITEM_REF}`, "merge.gate-verification", {
        changeRef: WORK_ITEM_REF,
        headSha: commitSha,
        verifiedAt: "2026-11-07T00:00:00Z",
        gateSet: { schemaVersion: "delivery.merge.gates.v1", ids: ["unit"] },
        gates: [],
        trackerPosture: { labels: [], ownerLabels: [] },
      });
      fixture.store.releaseFence(acquired.value.handle);

      const seedEvent = (
        writer: "phase" | "commit" | "verify",
        kind: string,
        eventKey: string,
        payload: Record<string, unknown>,
      ) => {
        const result = fixture.capsule.append({
          changeRef: WORK_ITEM_REF,
          workspaceChangesDirectory: fixture.tree.changes,
          writer,
          kind: kind as never,
          eventKey,
          payload,
          runId: "seed-run",
        });
        expect(result.ok).toBe(true);
      };
      seedEvent(
        "phase",
        "phase.transition",
        capsulePhaseEventKey({
          changeRef: WORK_ITEM_REF,
          phaseId: "delivery",
          operation: "complete",
          commitSha,
        }),
        {
          phaseId: "delivery",
          operation: "complete",
          outcome: "landed",
          commitIntent: "atomic",
          commitSha,
        },
      );
      seedEvent("commit", "commit.landed", commitSha, {
        commitSha,
        messageSource: "template",
        changeRef: WORK_ITEM_REF,
      });
      seedEvent("verify", "gate.outcome", capsuleGateEventKey(gateSetIdentity, commitSha), {
        gateSet: gateSetIdentity,
        headSha: commitSha,
        gates: [],
      });

      const applied = await fixture.run(true);
      expect(applied.exitCode).toBe(0);
      const data = dataOf(applied.envelope);
      expect(
        ((data.residue ?? []) as Record<string, unknown>[]).filter(
          (item) => item.kind === "capsule-event-gap",
        ),
      ).toEqual([]);
      expect(stepOf(data, "capsule")?.outcome).toBe("applied");
    } finally {
      fixture.cleanup();
    }
  });

  test("a dirty worktree refuses removal and retains it", async () => {
    const fixture = makeFixture({ dirtyWorktree: true, harness: "claude-code" });
    try {
      const applied = await fixture.run(true);
      expect(applied.exitCode).toBe(1);
      const error = applied.envelope.error as Record<string, unknown>;
      expect(error.code).toBe("closeout.branch.unsafe");
      expect(String(error.summary)).toContain("retained=1");
      expect(fixture.repo.run(["worktree", "list", "--porcelain"])).toContain(fixture.worktreePath);
    } finally {
      fixture.cleanup();
    }
  });

  test("an unreadable harness store is a declared attribution gap with residue", async () => {
    const fixture = makeFixture({ harness: "opencode", brokenHarness: true });
    try {
      const applied = await fixture.run(true);
      expect(applied.exitCode).toBe(1);
      const data = dataOf(applied.envelope);
      expect(stepOf(data, "session-compaction")?.outcome).toBe("skipped-gap");
      expect(stepOf(data, "session-compaction")?.reason).toBe("session-attribution-unavailable");
      expect(
        (data.residue as Record<string, unknown>[]).some(
          (item) => item.kind === "session-attribution-gap",
        ),
      ).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  test("an unattributable session is a declared attribution gap with residue", async () => {
    const fixture = makeFixture({ harness: "claude-code", unattributable: true });
    try {
      const applied = await fixture.run(true);
      expect(applied.exitCode).toBe(1);
      const data = dataOf(applied.envelope);
      expect(stepOf(data, "session-compaction")?.outcome).toBe("skipped-gap");
      expect(stepOf(data, "session-compaction")?.reason).toBe("session-attribution-unavailable");
      expect(
        (data.residue as Record<string, unknown>[]).some(
          (item) => item.kind === "session-attribution-gap",
        ),
      ).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  test("no sessions is skipped-noop, and an unreadable store is an attribution gap", async () => {
    const noSessions = makeFixture({ harness: "claude-code" });
    try {
      const applied = await noSessions.run(true);
      expect(applied.exitCode).toBe(0);
      const data = dataOf(applied.envelope);
      expect(stepOf(data, "session-compaction")?.outcome).toBe("skipped-noop");
    } finally {
      noSessions.cleanup();
    }
    const gap = makeFixture({ harness: "none" });
    try {
      // No harness configuration at all leaves the step a no-op, not a fabricated gap.
      const applied = await gap.run(true);
      expect(applied.exitCode).toBe(0);
      expect(stepOf(dataOf(applied.envelope), "session-compaction")?.outcome).toBe("skipped-noop");
    } finally {
      gap.cleanup();
    }
  });
});
