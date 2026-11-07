/**
 * TC-CAP-010 (producer half) — a failed capsule append is non-gating.
 *
 * The primary outcome and the durable state record are unchanged; the failure
 * is classified and disclosed; a torn capsule is refused with zero bytes and
 * never repaired. The closeout `capsule-event-gap` cross-check completes in P3.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withPhaseHarness } from "./phase-support";
import { makeFileProducer, makeRecordingProducer } from "../fixtures/capsule/producer";

const ROOT = process.cwd();
const FULL = readFileSync(join(ROOT, "tests/fixtures/phase/full-open.yaml"), "utf8");
const REF = "GH-179";

const dataOf = (run: { readonly envelope?: Record<string, unknown> }): Record<string, unknown> => {
  const data = run.envelope?.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("expected success data");
  }
  return data as Record<string, unknown>;
};

const eventsPath = (root: string): string =>
  join(root, "doc", "changes", "2026-10", `2026-10-31--${REF}--phase-fixture`, "events.jsonl");

describe("TC-CAP-010 non-gating capsule append", () => {
  test("a busy append leaves the primary outcome and the transition record intact", async () => {
    const producer = makeRecordingProducer("busy");
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const run = await harness.run(["complete", REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).outcome).toBe("landed");
        expect(harness.transitionPayloads().length).toBe(1);
        expect((dataOf(run).capsule as Record<string, unknown>).code).toBe("state.lock.busy");
      },
      "capsule-nongating-busy",
      undefined,
      { capsule: producer.port },
    );
  });

  test("a thrown append fabricates no event file", async () => {
    const producer = makeRecordingProducer("throw");
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const run = await harness.run(["complete", REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).outcome).toBe("landed");
        expect(() => readFileSync(eventsPath(harness.root), "utf8")).toThrow();
      },
      "capsule-nongating-throw",
      undefined,
      { capsule: producer.port },
    );
  });

  test("a torn tail is refused, disclosed, and never repaired", async () => {
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const port = makeFileProducer(join(harness.root, "doc", "changes"));
        await harness.runDefinition(
          (await import("../../packages/cli/src/commands/phase")).createPhaseCommandDefinition({
            ...harness.runtime,
            capsule: port,
          }),
          ["complete", REF, "delivery"],
        );
        const file = eventsPath(harness.root);
        const valid = readFileSync(file, "utf8");
        const torn = valid.slice(0, -3);
        writeFileSync(file, torn);
        const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
        const { createPhaseCommandDefinition } = await import(
          "../../packages/cli/src/commands/phase"
        );
        const reopened = await harness.runDefinition(
          createPhaseCommandDefinition({ ...harness.runtime, capsule: port }),
          ["reopen", REF, "delivery", "rework"],
        );
        expect(reopened.exitCode).toBe(0);
        const capsule = dataOf(reopened).capsule as Record<string, unknown>;
        expect(capsule.code).toBe("capsule.torn-tail");
        expect(capsule.appended).toBe(false);
        expect(createHash("sha256").update(readFileSync(file)).digest("hex")).toBe(digest);
      },
      "capsule-nongating-torn",
    );
  });
});
