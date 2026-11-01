/**
 * TC-QREADY-022 / TC-QREADY-023 — read-only execution and byte-identical
 * deterministic replay.
 */
import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StatusParkRead } from "../../packages/core/src/contracts/index";
import { readProviderParkViews } from "../../packages/core/src/provider";
import {
  baseFacts,
  createRecorder,
  makeWorkItem,
  queueRuntime,
  runQueueReadyCli,
  workItemRead,
} from "../fixtures/queue-ready/harness";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";
import { guardStore } from "./verify-support";

const ROOT = process.cwd();
const QUEUE_MODULES = [
  "packages/core/src/contracts/queue-ready.ts",
  "packages/core/src/domain/queue-ready.ts",
  "packages/core/src/domain/ci-result.ts",
  "packages/cli/src/commands/queue.ts",
];

const FORBIDDEN_TOKENS = [
  "node:child_process",
  "Bun.spawn",
  "execSync",
  "writeFileSync",
  "appendFileSync",
  "process.env",
  "Bun.env",
  "Date.now",
  "Math.random",
  "performance.now",
  "fetch(",
  "require(",
];

describe("TC-QREADY-022 read-only execution", () => {
  test("the provider-park read observes the guarded store without any mutation", async () => {
    const directory = makeTempRoot("queue-ready-readonly");
    try {
      const { store } = openStore(makeIdentity(directory));
      const storeRecorder = { calls: [] as string[] };
      const guarded = guardStore(store, storeRecorder);
      const recorder = createRecorder();
      const runtime = {
        ...queueRuntime(baseFacts(), recorder),
        readProviderParks: (nowMs: number): StatusParkRead => {
          const parks = readProviderParkViews(guarded.store, nowMs);
          if (!parks.ok)
            return { ok: false, reason: "state-unreadable", failureCode: parks.error.code };
          return { ok: true, parks: parks.value };
        },
      };
      const run = await runQueueReadyCli(["queue", "ready", "GH-176", "--json"], runtime);
      expect(run.exitCode).toBe(0);
      expect(storeRecorder.calls).toContain("read");
      for (const forbidden of [
        "append",
        "replaceDocument",
        "acquireFence",
        "releaseFence",
        "recoverFence",
      ]) {
        expect(storeRecorder.calls, forbidden).not.toContain(forbidden);
      }
      expect(
        recorder.calls.every(
          (call) => call.startsWith("read") || call === "nowIso" || call === "nowMs",
        ),
      ).toBe(true);
    } finally {
      removeRoot(directory);
    }
  });

  test("a seeded store mutation trips the guard", () => {
    const directory = makeTempRoot("queue-ready-seeded");
    try {
      const { store } = openStore(makeIdentity(directory));
      const guarded = guardStore(store, { calls: [] });
      expect(() => guarded.store.append({} as never, {} as never)).toThrow();
      expect(() => guarded.store.acquireFence("seeded")).toThrow();
    } finally {
      removeRoot(directory);
    }
  });

  test("the PM-context bytes and mtime are unchanged", async () => {
    const temp = mkdtempSync(join(tmpdir(), "queue-ready-pm-"));
    try {
      const source = join(ROOT, "tests/fixtures/queue-ready/pm-context/no-active-change.yaml");
      const targetPath = join(temp, "pm-context.yaml");
      cpSync(source, targetPath);
      const before = readFileSync(targetPath);
      const beforeMtime = statSync(targetPath).mtimeMs;
      // The command never receives a path; the reader is injected. A run must not
      // touch the file even when the reader is supplied from a temp root.
      const localContext = (
        await import("../../packages/adapters/src/file/pm-context")
      ).readLocalPmContext({
        path: targetPath,
        fs: (await import("../../packages/adapters/src/file/config-source")).nodeFileSystemFacts(),
      });
      await runQueueReadyCli(
        ["queue", "ready", "GH-176", "--json"],
        queueRuntime(baseFacts({ localContext })),
      );
      expect(readFileSync(targetPath).equals(before)).toBe(true);
      expect(statSync(targetPath).mtimeMs).toBe(beforeMtime);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  test("no queue-ready module imports a write, spawn, or ambient-environment API", () => {
    for (const relative of QUEUE_MODULES) {
      const text = readFileSync(join(ROOT, relative), "utf8");
      for (const token of FORBIDDEN_TOKENS) {
        expect(text.includes(token), `${relative}: ${token}`).toBe(false);
      }
    }
  });

  test("a seeded write token is detected", () => {
    const seeded = "import { writeFileSync } from 'node:fs';";
    expect(FORBIDDEN_TOKENS.some((token) => seeded.includes(token))).toBe(true);
  });
});

describe("TC-QREADY-023 determinism and byte-identical replay", () => {
  const facts = () =>
    baseFacts({
      tracker: workItemRead([
        makeWorkItem({ entityId: "176", labels: ["priority:high"] }),
        makeWorkItem({ entityId: "179", labels: ["priority:high"] }),
      ]),
    });

  test("JSON and human output are byte-identical across replays", async () => {
    const json1 = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "GH-179", "--json"],
      queueRuntime(facts()),
    );
    const json2 = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "GH-179", "--json"],
      queueRuntime(facts()),
    );
    expect(json1.stdout).toBe(json2.stdout);
    const human1 = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "GH-179"],
      queueRuntime(facts()),
    );
    const human2 = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "GH-179"],
      queueRuntime(facts()),
    );
    expect(human1.stdout).toBe(human2.stdout);
  });

  test("a reversed caller order produces the same ranked candidates", async () => {
    const forward = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "GH-179", "--json"],
      queueRuntime(facts()),
    );
    const reversed = await runQueueReadyCli(
      ["queue", "ready", "GH-179", "GH-176", "--json"],
      queueRuntime(facts()),
    );
    const refs = (stdout: string) =>
      JSON.parse(stdout).data.candidates.map(
        (candidate: { workItemRef: string }) => candidate.workItemRef,
      );
    expect(refs(reversed.stdout)).toEqual(refs(forward.stdout));
  });

  test("a changed fact changes the expected bounded field", async () => {
    const succeeded = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "--json"],
      queueRuntime(facts()),
    );
    const pending = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "--json"],
      queueRuntime({
        ...facts(),
        ci: {
          ok: true,
          items: [
            {
              identity: { systemName: "github", entityId: "1" },
              pipelineName: "ci",
              jobs: [{ jobName: "build", jobState: "running" }],
              traceEvidence: [],
            },
          ],
          pageItemCount: 1,
        },
      }),
    );
    const state = (stdout: string) =>
      JSON.parse(stdout).data.candidates[0].conditions.find(
        (condition: { id: string }) => condition.id === "ci-healthy",
      ).state;
    expect(state(succeeded.stdout)).toBe("satisfied");
    expect(state(pending.stdout)).toBe("unsatisfied");
  });

  test("the pure tiers contain no ambient clock, randomness, or environment reads", () => {
    for (const relative of QUEUE_MODULES.slice(0, 3)) {
      const text = readFileSync(join(ROOT, relative), "utf8");
      for (const token of [
        "Date.now",
        "Math.random",
        "process.env",
        "Bun.env",
        "performance.now",
      ]) {
        expect(text.includes(token), `${relative}: ${token}`).toBe(false);
      }
    }
  });
});
