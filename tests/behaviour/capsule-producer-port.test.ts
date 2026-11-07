/** TC-CAP-007/008 — the exported production capsule producer port itself. */
import { describe, expect, test } from "bun:test";
import { createCapsuleProducerPort } from "../../packages/cli/src/edge";
import { nodeCapsuleFileSystemFacts } from "../../packages/adapters/src/file";
import { makeChangeTree } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";

const REF = "GH-183";

describe("createCapsuleProducerPort", () => {
  test("a production append lands one event with the configured run id and no duplicate", () => {
    const tree = makeChangeTree({
      ref: REF,
      month: "2026-11",
      name: `2026-11-01--${REF}--producer-port`,
    });
    try {
      const port = createCapsuleProducerPort({
        changesDirectory: tree.changes,
        fs: nodeCapsuleFileSystemFacts(),
        nowIso: () => "2026-11-07T00:00:00Z",
        runId: () => "run-port",
      });
      const request = {
        changeRef: REF,
        writer: "commit" as const,
        kind: "commit.landed" as const,
        eventKey: "port-key-1",
        payload: { commitSha: "a".repeat(40) },
      };
      const first = port.append(request);
      expect(first.ok).toBe(true);
      if (first.ok) expect(first.appended).toBe(true);
      const reader = makeCapsuleRuntime(tree.changes);
      const events = reader.read(REF);
      expect(events.ok).toBe(true);
      if (!events.ok) return;
      expect(events.events.map((event) => event.kind)).toEqual(["capsule.opened", "commit.landed"]);
      expect(events.events[1]?.runId).toBe("run-port");
      const duplicate = port.append(request);
      expect(duplicate.ok).toBe(true);
      if (duplicate.ok) {
        expect(duplicate.appended).toBe(false);
        expect(duplicate.reason).toBe("duplicate");
      }
      const after = reader.read(REF);
      expect(after.ok && after.events.length).toBe(2);
    } finally {
      tree.cleanup();
    }
  });

  test("an absent capsule is a classified non-gating failure, never a throw", () => {
    const tree = makeChangeTree({
      ref: REF,
      month: "2026-11",
      name: `2026-11-01--${REF}--producer-port`,
    });
    try {
      const port = createCapsuleProducerPort({
        changesDirectory: tree.changes,
        fs: nodeCapsuleFileSystemFacts(),
        nowIso: () => "2026-11-07T00:00:00Z",
      });
      const result = port.append({
        changeRef: "GH-999",
        writer: "phase",
        kind: "phase.transition",
        eventKey: "absent-key",
        payload: { phaseId: "1", operation: "complete", outcome: "landed" },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("capsule.folder-absent");
    } finally {
      tree.cleanup();
    }
  });
});
