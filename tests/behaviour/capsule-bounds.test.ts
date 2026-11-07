/**
 * TC-CAP-005 — capsule caps are enforced by refusal, never truncation.
 *
 * At-cap is accepted; one unit over is refused with a classified condition
 * carrying the cap; prior bytes stay an exact prefix.
 */
import { describe, expect, test } from "bun:test";
import {
  CAPSULE_MAX_BYTES,
  CAPSULE_MAX_CANDIDATES,
  CAPSULE_MAX_CANDIDATE_BYTES,
  CAPSULE_MAX_EVENTS,
  CAPSULE_MAX_EVENT_PAYLOAD_BYTES,
  type CapsuleEvent,
} from "../../packages/core/src/contracts/index";
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
const dirs = [changes, "/changes/2026-11", folder, `${folder}/candidates`];

const runtimeWith = (memory: ReturnType<typeof makeMemoryFs>) => makeMemoryRuntime(memory, changes);

const appendCommit = (runtime: ReturnType<typeof makeMemoryRuntime>, key: string) =>
  runtime.append({
    changeRef: CAPSULE_REF,
    workspaceChangesDirectory: changes,
    writer: "commit",
    kind: "commit.landed",
    eventKey: key,
    payload: { commitSha: "b".repeat(40) },
    runId: "run-0001",
  });

describe("TC-CAP-005 capsule caps", () => {
  test("the event cap refuses the 2001st event with an unchanged file", () => {
    const memory = makeMemoryFs({ directories: dirs });
    const events: CapsuleEvent[] = [
      makeEvent(1, "capsule.opened", "closeout", payloadFor("capsule.opened")),
    ];
    for (let index = 2; index <= CAPSULE_MAX_EVENTS; index += 1) {
      events.push(makeEvent(index, "phase.transition", "phase", payloadFor("phase.transition")));
    }
    const text = eventsText(events);
    memory.files.set(`${folder}/events.jsonl`, text);
    const runtime = runtimeWith(memory);
    const attempt = appendCommit(runtime, "over-cap");
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) {
      expect(attempt.code).toBe("capsule.event-cap");
      expect(attempt.cap).toBe(CAPSULE_MAX_EVENTS);
      expect(attempt.refused).toBe(1);
    }
    const after = memory.files.get(`${folder}/events.jsonl`) ?? "";
    expect(after).toBe(text);
    expect(after.startsWith(text.slice(0, 512))).toBe(true);
  });

  test("the byte cap refuses an append that would exceed two MiB", () => {
    const memory = makeMemoryFs({ directories: dirs });
    const events: CapsuleEvent[] = [
      makeEvent(1, "capsule.opened", "closeout", payloadFor("capsule.opened")),
    ];
    let index = 2;
    let text = eventsText(events);
    while (Buffer.byteLength(text) < CAPSULE_MAX_BYTES - 1024) {
      events.push(
        makeEvent(index, "review.verdict", "closeout", {
          iteration: index,
          verdict: "PASS",
          artifact: "x".repeat(3_900),
        }),
      );
      text = eventsText(events);
      index += 1;
    }
    memory.files.set(`${folder}/events.jsonl`, text);
    const runtime = runtimeWith(memory);
    const attempt = appendCommit(runtime, "over-bytes");
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) {
      expect(attempt.code).toBe("capsule.byte-cap");
      expect(attempt.cap).toBe(CAPSULE_MAX_BYTES);
    }
    expect(memory.files.get(`${folder}/events.jsonl`)).toBe(text);
  });

  test("the payload cap accepts exactly 4096 bytes and refuses 4097", () => {
    const memory = makeMemoryFs({ directories: dirs });
    const runtime = runtimeWith(memory);
    const base = JSON.stringify({ iteration: 1, verdict: "PASS", artifact: "" });
    const atCap = {
      iteration: 1,
      verdict: "PASS",
      artifact: "x".repeat(CAPSULE_MAX_EVENT_PAYLOAD_BYTES - base.length),
    };
    expect(JSON.stringify(atCap).length).toBe(CAPSULE_MAX_EVENT_PAYLOAD_BYTES);
    const accepted = runtime.append({
      changeRef: CAPSULE_REF,
      workspaceChangesDirectory: changes,
      writer: "closeout",
      kind: "review.verdict",
      eventKey: "at-cap",
      payload: atCap,
      runId: "run-0001",
    });
    expect(accepted.ok).toBe(true);
    const before = memory.files.get(`${folder}/events.jsonl`) ?? "";
    const overCap = { ...atCap, artifact: `${atCap.artifact}x` };
    expect(JSON.stringify(overCap).length).toBe(CAPSULE_MAX_EVENT_PAYLOAD_BYTES + 1);
    const refused = runtime.append({
      changeRef: CAPSULE_REF,
      workspaceChangesDirectory: changes,
      writer: "closeout",
      kind: "review.verdict",
      eventKey: "over-cap",
      payload: overCap,
      runId: "run-0001",
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.code).toBe("capsule.payload-cap");
    expect(memory.files.get(`${folder}/events.jsonl`)).toBe(before);
  });

  test("the candidate caps accept 8 KiB and refuse one byte over", () => {
    const memory = makeMemoryFs({ directories: dirs });
    memory.files.set(`${folder}/candidates/at-cap.yaml`, "y".repeat(CAPSULE_MAX_CANDIDATE_BYTES));
    const runtime = runtimeWith(memory);
    expect(runtime.readCandidates(CAPSULE_REF).ok).toBe(true);
    memory.files.set(
      `${folder}/candidates/over-cap.yaml`,
      "y".repeat(CAPSULE_MAX_CANDIDATE_BYTES + 1),
    );
    const over = runtime.readCandidates(CAPSULE_REF);
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.code).toBe("capsule.candidate-invalid");
      expect(over.cap).toBe(CAPSULE_MAX_CANDIDATE_BYTES);
    }
    expect(CAPSULE_MAX_CANDIDATES).toBe(100);
  });

  test("the candidate count cap refuses the 101st file and names the omitted count", () => {
    const memory = makeMemoryFs({ directories: dirs });
    for (let index = 0; index < CAPSULE_MAX_CANDIDATES + 1; index += 1) {
      memory.files.set(`${folder}/candidates/candidate-${index}.yaml`, "statement: x\n");
    }
    const runtime = runtimeWith(memory);
    const over = runtime.readCandidates(CAPSULE_REF);
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.code).toBe("capsule.candidate-cap");
      expect(over.refused).toBe(1);
    }
  });
});
