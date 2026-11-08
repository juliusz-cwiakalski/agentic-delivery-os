/**
 * TC-CAP-006 — terminal `capsule.closed` exactly once (runtime half).
 *
 * The close is the final line, carries decision counts/event count/digest, and
 * seals the capsule against every later writer. The applied payload and
 * plan-mode absence complete in P3.
 */
import { describe, expect, test } from "bun:test";
import type { CapsuleEvent } from "../../packages/core/src/contracts/index";
import { capsuleDigest } from "../../packages/core/src/domain/capsule";
import {
  CAPSULE_FOLDER,
  CAPSULE_REF,
  eventsText,
  makeEvent,
  makeMemoryFs,
  makeMemoryRuntime,
  payloadFor,
} from "../fixtures/capsule/harness";

const changes = "/changes";
const folder = `/changes/2026-11/${CAPSULE_FOLDER}`;
const dirs = [changes, "/changes/2026-11", folder];

const closePayload = (events: readonly CapsuleEvent[]) => ({
  decisionCounts: { promoted: 3, rejected: 1 },
  eventCount: events.length,
  digest: capsuleDigest(events),
});

describe("TC-CAP-006 terminal close", () => {
  test("the close is the last line and carries counts, event count, and digest", () => {
    const memory = makeMemoryFs({ directories: dirs });
    const runtime = makeMemoryRuntime(memory, changes);
    for (const key of ["a", "b"]) {
      expect(
        runtime.append({
          changeRef: CAPSULE_REF,
          workspaceChangesDirectory: changes,
          writer: "commit",
          kind: "commit.landed",
          eventKey: key,
          payload: { commitSha: key.repeat(40) },
          runId: "run-0001",
        }).ok,
      ).toBe(true);
    }
    const before = runtime.read(CAPSULE_REF);
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    const beforeText = memory.files.get(`${folder}/events.jsonl`) ?? "";
    const closed = runtime.close({
      changeRef: CAPSULE_REF,
      workspaceChangesDirectory: changes,
      writer: "closeout",
      eventKey: "capsule-closed",
      payload: closePayload(before.events),
      runId: "run-0001",
    });
    expect(closed.ok).toBe(true);
    if (closed.ok) expect(closed.appended).toBe(true);
    const after = runtime.read(CAPSULE_REF);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    const last = after.events[after.events.length - 1] as CapsuleEvent;
    expect(last.kind).toBe("capsule.closed");
    expect(last.payload).toEqual(closePayload(before.events));
    expect(before.events.length).toBe(3);
    const afterText = memory.files.get(`${folder}/events.jsonl`) ?? "";
    expect(afterText.startsWith(beforeText)).toBe(true);
  });

  test("every writer is refused after the close and the file is unchanged", () => {
    const memory = makeMemoryFs({
      directories: dirs,
      files: {
        [`${folder}/events.jsonl`]: eventsText([
          makeEvent(1, "capsule.opened", "closeout", payloadFor("capsule.opened")),
          makeEvent(2, "capsule.closed", "closeout", payloadFor("capsule.closed")),
        ]),
      },
    });
    const runtime = makeMemoryRuntime(memory, changes);
    const before = memory.files.get(`${folder}/events.jsonl`);
    for (const writer of ["phase", "commit", "verify", "closeout"] as const) {
      const kind =
        writer === "phase"
          ? "phase.transition"
          : writer === "commit"
            ? "commit.landed"
            : writer === "verify"
              ? "gate.outcome"
              : "closeout.step";
      const result = runtime.append({
        changeRef: CAPSULE_REF,
        workspaceChangesDirectory: changes,
        writer,
        kind,
        eventKey: `late-${writer}`,
        payload:
          kind === "phase.transition"
            ? { phaseId: "1", operation: "complete", outcome: "completed" }
            : kind === "commit.landed"
              ? { commitSha: "c".repeat(40) }
              : kind === "gate.outcome"
                ? { gateSet: "default", headSha: "c".repeat(40), gates: [] }
                : { stepId: "capsule", outcome: "applied" },
        runId: "run-0001",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("capsule.post-close");
    }
    expect(memory.files.get(`${folder}/events.jsonl`)).toBe(before);
  });

  test("a re-run appends zero close events", () => {
    const memory = makeMemoryFs({ directories: dirs });
    const runtime = makeMemoryRuntime(memory, changes);
    const events = [makeEvent(1, "capsule.opened", "closeout", payloadFor("capsule.opened"))];
    const first = runtime.close({
      changeRef: CAPSULE_REF,
      workspaceChangesDirectory: changes,
      writer: "closeout",
      eventKey: "capsule-closed",
      payload: closePayload(events),
      runId: "run-0001",
    });
    expect(first.ok && first.appended).toBe(true);
    const text = memory.files.get(`${folder}/events.jsonl`);
    const second = runtime.close({
      changeRef: CAPSULE_REF,
      workspaceChangesDirectory: changes,
      writer: "closeout",
      eventKey: "capsule-closed-2",
      payload: closePayload(events),
      runId: "run-0002",
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.appended).toBe(false);
      expect(second.reason).toBe("already-closed");
    }
    expect(memory.files.get(`${folder}/events.jsonl`)).toBe(text);
  });
});
