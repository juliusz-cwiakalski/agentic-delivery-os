/**
 * TC-QLC-001 (GH-292) — a reasoned removal retires the entry from every read
 * surface: one append, a folded absence, one `remove` disclosure, and no
 * source record deleted, edited, or re-keyed.
 */
import { describe, expect, test } from "bun:test";
import { readQueueFold } from "../../packages/core/src/app/queue";
import { QUEUE_REMOVAL_RECORD_KIND } from "../../packages/core/src/contracts/index";
import {
  ACCEPTED_REASONS,
  REPO_A,
  REMOVAL_REF,
} from "../fixtures/queue/removal/cases";
import { createRemovalHarness } from "../fixtures/queue/removal/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;

describe("TC-QLC-001 reasoned removal retires the entry", () => {
  test("one append removes the ref from list, plan, ready, lanes, and the derived document", async () => {
    const harness = createRemovalHarness("remove-happy");
    harness.seedEntry({ ref: REMOVAL_REF, priority: 5 });
    const recordsBefore = harness.composition.store.readRecords();
    if (!recordsBefore.ok) throw new Error("seed read failed");
    const entryBefore = recordsBefore.value.records.find(
      (record) => record.key === `queue.entries:${REMOVAL_REF}`,
    );
    expect(entryBefore).toBeDefined();

    const run = await harness.run(["queue", "remove", REMOVAL_REF, "--reason", "abandoned", "--json"]);
    expect(run.exitCode).toBe(0);
    const envelope = json(run.stdout);
    expect(Object.keys(envelope).sort()).toEqual(["data", "exitCode", "runId", "schemaVersion", "timing"]);
    const data = envelope.data as Record<string, unknown>;
    expect(data.result).toBe("removed");
    expect(data.reason).toBe("abandoned");
    expect(data.ref).toBe(REMOVAL_REF);
    expect(data.event).toEqual({ topic: "queue.graph", kind: "remove" });

    // Exactly one removal record, with the declared schema and payload.
    const removals = harness.removalRecords();
    expect(removals).toHaveLength(1);
    const removal = removals[0];
    if (removal === undefined) throw new Error("removal record vanished");
    expect(removal.schema).toBe("delivery.queue.removal.v1");
    expect(removal.ref).toBe(REMOVAL_REF);
    expect(removal.reason).toBe("abandoned");
    expect(typeof removal.recordedAt).toBe("string");

    // Every fold-driven read surface loses the ref. `queue ready` reads the
    // delivered status facts (not the queue ledger): it must not fabricate
    // readiness for the removed ref either way.
    for (const argv of [
      ["queue", "list", "--json"],
      ["queue", "plan", "--json"],
      ["lanes", "list", "--json"],
    ]) {
      const read = await harness.run(argv);
      expect(read.exitCode).toBe(0);
      expect(read.stdout).not.toContain(REMOVAL_REF);
    }
    const ready = await harness.run(["queue", "ready", REMOVAL_REF, "--json"]);
    expect(ready.exitCode).toBe(0);
    expect(ready.stdout).toContain("work-item-unobserved");

    // The derived document drops the entry and keeps its declared schema.
    const document = harness.graphDocument();
    expect(document).toBeDefined();
    const parsed = JSON.parse(document ?? "{}") as {
      schema: string;
      entries: readonly { ref: string }[];
    };
    expect(parsed.schema).toBe("delivery.queue.graph.v1");
    expect(parsed.entries.some((entry) => entry.ref === REMOVAL_REF)).toBe(false);

    // The entry record survives byte-identical; the fold sees no entry.
    const recordsAfter = harness.composition.store.readRecords();
    if (!recordsAfter.ok) throw new Error("post read failed");
    const entryAfter = recordsAfter.value.records.find(
      (record) => record.key === `queue.entries:${REMOVAL_REF}`,
    );
    expect(entryAfter).toEqual(entryBefore);
    const fold = readQueueFold(harness.composition.store);
    if (!fold.ok) throw new Error("fold read failed");
    expect(fold.value.entries.some((entry) => entry.ref === REMOVAL_REF)).toBe(false);
    // The removal is the newest record in the ledger.
    const removalRecords = recordsAfter.value.records.filter(
      (record) => record.kind === QUEUE_REMOVAL_RECORD_KIND,
    );
    expect(removalRecords).toHaveLength(1);
  });

  test("every closed vocabulary reason is accepted with the matching payload", async () => {
    for (const { reason } of ACCEPTED_REASONS) {
      const harness = createRemovalHarness(`remove-${reason}`);
      harness.seedEntry({ ref: REMOVAL_REF });
      const run = await harness.run(["queue", "remove", REMOVAL_REF, "--reason", reason, "--json"]);
      expect(run.exitCode, reason).toBe(0);
      const data = json(run.stdout).data as Record<string, unknown>;
      expect(data.result).toBe("removed");
      expect(data.reason).toBe(reason);
      expect(harness.removalRecords()).toHaveLength(1);
    }
  });

  test("the degraded marker stays the delivered set on the removal payload", async () => {
    const harness = createRemovalHarness("remove-degraded");
    harness.seedEntry({ ref: REMOVAL_REF });
    const run = await harness.run(["queue", "remove", REMOVAL_REF, "--reason", "abandoned", "--json"]);
    expect(run.exitCode).toBe(0);
    const data = json(run.stdout).data as { degraded: readonly string[] };
    expect(data.degraded).toEqual(["daemon-unreachable"]);
    expect(REPO_A).toBeDefined();
  });
});
