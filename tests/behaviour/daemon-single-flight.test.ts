/**
 * TC-QLC-042 (GH-292, F-4, AC-F4-3; GAP-T1) — a composed supervision cycle with
 * a supplied claim port follows the dispatch family: any live same-ref lease
 * refuses `queue.single-flight` naming the holder and starts no executor. The
 * case injects the port; the production daemon composition stays supervise-only
 * (A-6), so no case claims a live production spawn.
 */
import { describe, expect, test } from "bun:test";
import { claimSingleFlightRefusal, runSupervisionCycle } from "../../packages/core/src/app/index";
import {
  type SingleFlightStore,
  seedLease,
  singleFlightStore,
} from "../fixtures/queue/single-flight/harness";

const NOW_ISO = "2026-11-12T10:00:00Z";

const runCycle = async (
  single: SingleFlightStore,
  input: { readonly ref: string; readonly holder?: string },
) =>
  runSupervisionCycle({
    store: single.store,
    fenceToken: `supervision-${input.ref}`,
    ports: {
      executor: {
        availability: () => ({ available: true, reason: "available" }),
        start: () => Promise.resolve({ sessionId: "session-supervised", harnessKind: "opencode" }),
        observe: () =>
          Promise.resolve({
            observable: false,
            sessionId: "session-supervised",
            progress: "progressing",
          }),
        collect: () => Promise.resolve({ outcome: "completed" as const }),
        resume: () => Promise.resolve(true),
      },
      nextAction: () => ({
        ref: input.ref,
        repository: "host/owner/name",
        weightClass: "standard",
      }),
      claim: (action) => {
        // The composed claim port: the dispatch-family admission predicate
        // exactly as the production composition wires it (GAP-T1).
        const refused = claimSingleFlightRefusal(single.store, {
          ref: action.ref,
          holder: "dispatch",
          nowMs: Date.parse(NOW_ISO),
        });
        if (refused !== undefined) {
          return {
            ok: false as const,
            code: refused.code,
            ...(refused.holder === undefined ? {} : { holder: refused.holder }),
          };
        }
        return { ok: true as const, leaseId: `lease-${action.ref}` };
      },
      release: () => true,
      nowIso: () => NOW_ISO,
    },
  });

describe("TC-QLC-042 composed supervision claim follows the dispatch family", () => {
  test("a live same-ref lease refuses the cycle with the holder and no executor start", async () => {
    const single = singleFlightStore("supervision-single-flight");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241" });
      const result = await runCycle(single, { ref: "GH-241" });
      expect(result.mode).toBe("claim-refused");
      if (result.mode !== "claim-refused") return;
      expect(result.code).toBe("queue.single-flight");
      expect(result.holder).toBe("lane-1");
    } finally {
      single.dispose();
    }
  });

  test("no live lease admits the cycle through the injected port", async () => {
    const single = singleFlightStore("supervision-free");
    try {
      const result = await runCycle(single, { ref: "GH-241" });
      expect(result.mode).toBe("spawned");
    } finally {
      single.dispose();
    }
  });
});
