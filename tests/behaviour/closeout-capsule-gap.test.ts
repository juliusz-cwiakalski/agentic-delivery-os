/**
 * TC-CAP-010 / TC-CAP-011 (completing half) — the closeout cross-check.
 *
 * A producer append failure leaves a missing expected event; closeout reports
 * exactly one `capsule-event-gap` residue naming the kind and identity, the
 * capsule still validates, and it still closes.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCapsuleEvents } from "../../packages/core/src/domain/capsule";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import { WORK_ITEM_REF } from "../fixtures/closeout/harness";
import { eventsText, makeChangeTree, makeEvent, payloadFor } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";

describe("TC-CAP-010/011 capsule event gap cross-check", () => {
  test("a missing expected commit event is one named capsule-event-gap residue", async () => {
    const tree = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
      files: {
        "events.jsonl": eventsText([
          makeEvent(1, "capsule.opened", "closeout", payloadFor("capsule.opened")),
        ]),
      },
    });
    try {
      const runtime = makeCapsuleRuntime(tree.changes);
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: runtime,
        capsuleExpected: [
          { kind: "commit.landed", eventKey: "commit-sha-1", identity: "commit-sha-1" },
        ],
      });
      expect(run.exitCode).toBe(1);
      const data = closeoutData(run.envelope);
      expect(data.residue?.length).toBe(1);
      expect(data.residue?.[0]?.kind).toBe("capsule-event-gap");
      expect(data.residue?.[0]?.location).toBe("commit-sha-1");
      expect(data.residue?.[0]?.item).toContain("commit.landed");
      expect(data.capsule?.closed).toBe(true);
      const report = parseCapsuleEvents(readFileSync(join(tree.folder, "events.jsonl"), "utf8"));
      expect(report.ok).toBe(true);
      if (!report.ok) return;
      expect(report.events.filter((event) => event.kind === "capsule.closed").length).toBe(1);
    } finally {
      tree.cleanup();
    }
  });

  test("plan mode renders the same residue and writes nothing", async () => {
    const tree = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
      files: {
        "events.jsonl": eventsText([
          makeEvent(1, "capsule.opened", "closeout", payloadFor("capsule.opened")),
        ]),
      },
    });
    try {
      const file = join(tree.folder, "events.jsonl");
      const before = readFileSync(file, "utf8");
      const runtime = makeCapsuleRuntime(tree.changes);
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF], {
        capsule: runtime,
        capsuleExpected: [{ kind: "gate.outcome", eventKey: "gate-sha-1", identity: "gate-sha-1" }],
      });
      expect(run.exitCode).toBe(0);
      const data = closeoutData(run.envelope);
      expect(data.residue?.[0]?.location).toBe("gate-sha-1");
      expect(data.capsule).toBeUndefined();
      expect(readFileSync(file, "utf8")).toBe(before);
    } finally {
      tree.cleanup();
    }
  });
});
