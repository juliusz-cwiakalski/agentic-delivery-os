/**
 * TC-SUP-072 (behaviour half) — every other outcome reuses a delivered identity
 * with the declared exit; a parked stall inside a successful run keeps exit 0
 * (GH-295 AC-F8-1, DEC-6).
 */

import { describe, expect, test } from "bun:test";
import { appendFileSync, readdirSync } from "node:fs";
import { claimSingleFlightRefusal } from "../../packages/core/src/app/index";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import {
  LANE_REF,
  seedHeartbeat,
  seedLane,
  seedLiveLease,
  stalledAndParked,
} from "../fixtures/supervise/records";

type Cell = {
  readonly id: string;
  readonly run: () => Promise<{ readonly exitCode: number; readonly stdout: string }>;
  readonly code: string;
  readonly exit: number;
};

describe("TC-SUP-072 the reuse table and the exit taxonomy", () => {
  test("containment, state, and single-flight reuse delivered identities with their exits", async () => {
    const grammar = createSupervisionHarness({ label: "exits-grammar" });
    try {
      seedLane(grammar.seed, LANE_REF);
      const unreadable = createSupervisionHarness({ label: "exits-unreadable" });
      try {
        seedLane(unreadable.seed, LANE_REF);
        const stateDirectory = `${unreadable.directory}/.supervision-state`;
        const ledger = readdirSync(stateDirectory).find((name) => name.startsWith("ledger."));
        appendFileSync(`${stateDirectory}/${ledger as string}`, "{torn");
        const single = createSupervisionHarness({ label: "exits-single" });
        try {
          stalledAndParked(single.seed);
          seedLiveLease(single.seed, { ref: LANE_REF, holder: "holder-a" });
          const cells: readonly Cell[] = [
            {
              id: "extra-positional",
              run: () => grammar.runCli(["supervise", "GH-123", "--json"]),
              code: "fallback.invocation",
              exit: 1,
            },
            {
              id: "unknown-flag",
              run: () => grammar.runCli(["supervise", "--nope", "--json"]),
              code: "fallback.invocation",
              exit: 1,
            },
            {
              id: "unreadable-state",
              run: () => unreadable.runCli(["supervise", "--json"]),
              code: "state.",
              exit: 2,
            },
            {
              id: "per-ref-double-claim",
              run: () =>
                single.runCli(["supervise", "--json"], {
                  claimRefusal: (ref) => {
                    const refusal = claimSingleFlightRefusal(single.store, {
                      ref,
                      holder: "supervise",
                      nowMs: single.nowMs,
                    });
                    return refusal === undefined
                      ? undefined
                      : {
                          code: "queue.single-flight",
                          ...(refusal.holder === undefined ? {} : { holder: refusal.holder }),
                        };
                  },
                }),
              code: "queue.single-flight",
              exit: 1,
            },
          ];
          for (const cell of cells) {
            const run = await cell.run();
            expect(run.exitCode, cell.id).toBe(cell.exit);
            const envelope = JSON.parse(run.stdout) as { error?: { code: string } };
            if (cell.code.endsWith(".")) {
              expect(envelope.error?.code ?? "", cell.id).toMatch(/^state\./u);
            } else {
              expect(envelope.error?.code, cell.id).toBe(cell.code);
            }
            // No supervise identity was minted for a reuse outcome.
            expect(envelope.error?.code ?? "", cell.id).not.toMatch(/^supervise\./u);
          }
        } finally {
          single.remove();
        }
      } finally {
        unreadable.remove();
      }
    } finally {
      grammar.remove();
    }
  });

  test("a parked stall inside a successful run keeps exit 0", async () => {
    const harness = createSupervisionHarness({ label: "exits-parked" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -(300_000 + 1) });
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const data = (JSON.parse(run.stdout) as { data?: Record<string, unknown> }).data;
      expect(((data?.actions ?? []) as readonly unknown[]).length).toBe(1);
    } finally {
      harness.remove();
    }
  });
});
