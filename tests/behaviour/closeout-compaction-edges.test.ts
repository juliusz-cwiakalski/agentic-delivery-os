/** TC-CAP-043 — no sessions, attribution unavailable, and same-digest re-runs. */
import { describe, expect, test } from "bun:test";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import { WORK_ITEM_REF, makeFacts } from "../fixtures/closeout/harness";
import { makeChangeTree } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";

const tree = () =>
  makeChangeTree({
    ref: WORK_ITEM_REF,
    month: "2026-11",
    name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
  });

describe("TC-CAP-043 compaction edges", () => {
  test("no sessions is skipped-noop with no zero checkpoint", async () => {
    const change = tree();
    try {
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(change.changes),
        facts: makeFacts({ sessions: { available: true, sessionIds: [] } }),
      });
      expect(run.exitCode).toBe(0);
      const step = closeoutData(run.envelope).steps.find(
        (entry) => entry.stepId === "session-compaction",
      );
      expect(step?.outcome).toBe("skipped-noop");
      expect(step?.reason).toBe("no-sessions");
    } finally {
      change.cleanup();
    }
  });

  test("unavailable attribution is a gap plus residue, never a guessed checkpoint", async () => {
    const change = tree();
    try {
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(change.changes),
        facts: makeFacts({ sessions: { available: false, sessionIds: ["session-a"] } }),
      });
      expect(run.exitCode).toBe(1);
      const data = closeoutData(run.envelope);
      const step = data.steps.find((entry) => entry.stepId === "session-compaction");
      expect(step?.outcome).toBe("skipped-gap");
      expect(step?.reason).toBe("session-attribution-unavailable");
      expect(data.residue?.some((item) => item.kind === "session-attribution-gap")).toBe(true);
    } finally {
      change.cleanup();
    }
  });
});

describe("TC-CAP-043 compaction idempotency key", () => {
  const checkpointKey = async (sessions: readonly string[], commit: string): Promise<string> => {
    const change = tree();
    try {
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(change.changes),
        facts: makeFacts({
          sessions: {
            available: true,
            sessionIds: sessions,
            lastVerifiedCommit: commit,
          },
        }),
      });
      expect(run.exitCode).toBe(0);
      const events = makeCapsuleRuntime(change.changes).read(WORK_ITEM_REF);
      expect(events.ok).toBe(true);
      if (!events.ok) return "";
      return (
        events.events.find((event) => event.kind === "capsule.compaction-checkpoint")?.eventKey ??
        ""
      );
    } finally {
      change.cleanup();
    }
  };

  test("the key is the session-set digest plus the last verified commit", async () => {
    const { deriveCapsuleEventKey } = await import("../../packages/core/src/domain/capsule");
    const key = await checkpointKey(["session-b", "session-a"], "a".repeat(40));
    expect(key).toBe(
      deriveCapsuleEventKey([
        "capsule.compaction-checkpoint",
        ["session-a", "session-b"].join(","),
        "a".repeat(40),
      ]),
    );
    const changedSet = await checkpointKey(["session-a"], "a".repeat(40));
    expect(changedSet).not.toBe(key);
    const changedCommit = await checkpointKey(["session-a", "session-b"], "b".repeat(40));
    expect(changedCommit).not.toBe(key);
  });
});
