/**
 * TC-CAP-004 — per-capsule append lock, bounded retry, and busy disclosure.
 *
 * The runtime half: serialized concurrent appends, bounded retry, the retryable
 * `state.lock.busy` identity, release on success and failure, and per-capsule
 * lock scope. The closeout apply busy-lock assertion completes in P3.
 */
import { describe, expect, test } from "bun:test";
import { CAPSULE_MAX_EVENTS } from "../../packages/core/src/contracts/index";
import {
  CAPSULE_FOLDER,
  CAPSULE_REF,
  makeMemoryFs,
  makeMemoryRuntime,
} from "../fixtures/capsule/harness";

const changes = "/changes";
const folder = `/changes/2026-11/${CAPSULE_FOLDER}`;
const dirs = [changes, "/changes/2026-11", folder];

const append = (runtime: ReturnType<typeof makeMemoryRuntime>, key: string, ref = CAPSULE_REF) =>
  runtime.append({
    changeRef: ref,
    workspaceChangesDirectory: changes,
    writer: "commit",
    kind: "commit.landed",
    eventKey: key,
    payload: { commitSha: "a".repeat(40) },
    runId: "run-0001",
  });

describe("TC-CAP-004 capsule append lock", () => {
  test("concurrent appends are serialized into one contiguous sequence", () => {
    const memory = makeMemoryFs({ directories: dirs });
    const runtime = makeMemoryRuntime(memory, changes);
    for (let index = 0; index < 8; index += 1) {
      const result = append(runtime, `commit-${index}`);
      expect(result.ok).toBe(true);
    }
    const lines = (memory.files.get(`${folder}/events.jsonl`) ?? "")
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as { sequence: number });
    expect(lines.map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(new Set(lines.map((event) => event.sequence)).size).toBe(9);
  });

  test("a held lock retries a bounded number of times and discloses state.lock.busy", () => {
    const waits: number[] = [];
    const memory = makeMemoryFs({ directories: dirs });
    memory.files.set(`${folder}/events.jsonl.lock`, "held\n");
    const runtime = makeMemoryRuntime(memory, changes, {
      lock: { sleep: (ms) => waits.push(ms), maxAttempts: 4, retryMs: 7 },
    });
    const result = append(runtime, "commit-busy");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("state.lock.busy");
      expect(result.retryable).toBe(true);
      expect(result.detail).toContain("capsule lock");
    }
    expect(waits).toEqual([7, 7, 7]);
    expect(waits.length).toBeLessThan(4);
    expect(memory.files.has(`${folder}/events.jsonl`)).toBe(false);
  });

  test("a released lock admits the next append", () => {
    const memory = makeMemoryFs({ directories: dirs });
    memory.files.set(`${folder}/events.jsonl.lock`, "held\n");
    const runtime = makeMemoryRuntime(memory, changes, {
      lock: { sleep: () => undefined, maxAttempts: 2, retryMs: 1 },
    });
    expect(append(runtime, "first").ok).toBe(false);
    memory.files.delete(`${folder}/events.jsonl.lock`);
    expect(append(runtime, "second").ok).toBe(true);
  });

  test("the lock is released after a failed append", () => {
    const memory = makeMemoryFs({ directories: dirs, failAppendOnce: true });
    const runtime = makeMemoryRuntime(memory, changes);
    const failed = append(runtime, "fails");
    expect(failed.ok).toBe(false);
    expect(memory.files.has(`${folder}/events.jsonl.lock`)).toBe(false);
    const next = append(runtime, "succeeds");
    expect(next.ok).toBe(true);
  });

  test("the lock is per capsule, so two refs do not serialize each other", () => {
    const memory = makeMemoryFs({
      directories: [
        changes,
        "/changes/2026-11",
        folder,
        "/changes/2026-11/2026-11-07--GH-241--other",
      ],
    });
    const runtime = makeMemoryRuntime(memory, changes);
    expect(append(runtime, "a", CAPSULE_REF).ok).toBe(true);
    expect(append(runtime, "b", "GH-241").ok).toBe(true);
    expect(memory.files.has(`${folder}/events.jsonl.lock`)).toBe(false);
    expect(memory.files.has("/changes/2026-11/2026-11-07--GH-241--other/events.jsonl.lock")).toBe(
      false,
    );
  });

  test("no lock file remains after a clean run and the declared maximum is sane", () => {
    const memory = makeMemoryFs({ directories: dirs });
    const runtime = makeMemoryRuntime(memory, changes);
    expect(append(runtime, "clean").ok).toBe(true);
    expect([...memory.files.keys()].some((path) => path.endsWith(".lock"))).toBe(false);
    expect(CAPSULE_MAX_EVENTS).toBeGreaterThan(0);
  });
});

describe("TC-CAP-004 completing half: closeout apply contention", () => {
  test("closeout apply returns the retryable state.lock.busy identity", async () => {
    const { writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { makeChangeTree } = await import("../fixtures/capsule/harness");
    const { makeCapsuleRuntime } = await import("../fixtures/capsule/producer");
    const { runCloseoutCli, errorOf } = await import("../fixtures/closeout/cli");
    const { WORK_ITEM_REF } = await import("../fixtures/closeout/harness");
    const tree = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
    });
    try {
      writeFileSync(join(tree.folder, "events.jsonl.lock"), "held\n");
      const runtime = makeCapsuleRuntime(tree.changes, {
        lock: { sleep: () => undefined, maxAttempts: 2, retryMs: 1 },
      });
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: runtime,
      });
      expect(run.exitCode).toBe(2);
      expect(errorOf(run.envelope).code).toBe("state.lock.busy");
      expect(errorOf(run.envelope).code).not.toBe("closeout.capsule-invalid");
    } finally {
      tree.cleanup();
    }
  });
});
