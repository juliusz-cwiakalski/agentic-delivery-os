/**
 * TC-HOLDQUEUE-005/006 (GH-280) — a composed supervision cycle whose
 * next-action seam DERIVES from the held scheduling pass receives no action and
 * claims nothing (conditional guarantee, GAP-T7/D14), while `queue watch`
 * streams the hold with empty actions and claims nothing.
 */
import { describe, expect, test } from "bun:test";
import { createQueueCommandRuntime, type QueueComposition } from "../../packages/cli/src/edge";
import { readDaemonLanes, runSupervisionCycle } from "../../packages/core/src/app/index";
import type { OwnerHoldFact } from "../../packages/core/src/contracts/index";
import { computeQueueSchedule } from "../../packages/core/src/domain/index";
import { createQueueEdgeHarness } from "../fixtures/queue/cli/harness";
import { makeFacts, REPO_A } from "../fixtures/queue/schedule/harness";
import { makeAuditStore } from "../fixtures/state/harness";

const HOLD: OwnerHoldFact = {
  active: true,
  source: "marker",
  reason: "peak-hour cost pause",
};
const executor = {
  availability: () => ({ available: true as const }),
  start: async () => undefined,
  observe: async () => ({
    observable: true as const,
    progress: "progressing" as const,
    done: false,
  }),
  collect: async () => ({ ok: true as const }),
  resume: async () => true,
};

const factsFor = (ownerHold?: OwnerHoldFact) => ({
  ...makeFacts([{ ref: "GH-320", repository: REPO_A }]),
  ...(ownerHold === undefined ? {} : { ownerHold }),
});

const supervision = async (ownerHold: OwnerHoldFact | undefined) => {
  const schedule = computeQueueSchedule(factsFor(ownerHold));
  const fixture = makeAuditStore(
    `owner-hold-supervision-${ownerHold === undefined ? "control" : "held"}`,
  );
  let derived = false;
  let claims = 0;
  const result = await runSupervisionCycle({
    store: fixture.store,
    fenceToken: "fence",
    ports: {
      executor,
      nextAction: () => {
        derived = true;
        const action = schedule.nextActions[0];
        return action === undefined
          ? undefined
          : {
              ref: action.ref,
              repository: action.repository ?? REPO_A,
              weightClass: action.weightClass,
            };
      },
      claim: () => {
        claims += 1;
        return { ok: false, code: "queue.precondition.unmet" };
      },
      release: () => true,
      nowIso: () => "2026-11-07T10:00:00Z",
    },
  });
  const lanes = readDaemonLanes(fixture.store);
  return { result, derived, claims, lanes: lanes.ok ? lanes.records : [] };
};

describe("TC-HOLDQUEUE-005 a composed supervision cycle derives no action from the held pass", () => {
  test("the derived seam yields no action, the claim seam is never called, and no lane record exists", async () => {
    const held = await supervision(HOLD);
    expect(held.derived).toBe(true);
    expect(held.result.mode).toBe("idle");
    expect(held.claims).toBe(0);
    expect(held.lanes).toEqual([]);
  });

  test("the no-hold control derives one action and claims it", async () => {
    const control = await supervision(undefined);
    expect(control.derived).toBe(true);
    expect(control.result.mode).not.toBe("idle");
    expect(control.claims).toBe(1);
  });
});

describe("TC-HOLDQUEUE-006 queue watch streams the hold with empty actions", () => {
  test("the first watch line carries the active hold and claims nothing", async () => {
    const harness = createQueueEdgeHarness("owner-hold-watch", {
      overrides: {
        readOwnerHold: () => HOLD,
        watch: {
          maxIterations: 1,
          intervalMs: 0,
          clock: {
            nowMs: () => Date.parse("2026-11-07T10:00:00Z"),
            nowIso: () => "2026-11-07T10:00:00Z",
            sleep: async () => {},
          },
        },
      } satisfies Partial<QueueComposition>,
    });
    await harness.run(["queue", "add", "GH-320", "--priority", "5", "--json"]);
    const runtime = createQueueCommandRuntime(harness.composition);
    if (runtime.watch === undefined) throw new Error("watch is not composed");
    const lines: string[] = [];
    for await (const line of runtime.watch()) {
      lines.push(line);
      break;
    }
    expect(lines).toHaveLength(1);
    const frame = JSON.parse(lines[0] ?? "{}") as {
      readonly kind: string;
      readonly data: {
        readonly ownerHold?: { readonly source: string; readonly reason?: string };
        readonly entries: readonly { readonly blocking: readonly { readonly reason: string }[] }[];
      };
    };
    expect(frame.kind).toBe("event");
    expect(frame.data.ownerHold).toEqual({ source: "marker", reason: "peak-hour cost pause" });
    expect(frame.data.entries[0]?.blocking[0]?.reason).toBe("owner-hold");
  });
});
