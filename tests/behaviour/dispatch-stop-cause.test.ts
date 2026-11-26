/**
 * TC-PEAK-034 — a stop with another cause or a missing end is the grammar
 * refusal `input.value.rejected` before any lane read (GH-413 F-9, AC-F9-3,
 * NFR-8, DEC-21).
 */
import { describe, expect, test } from "bun:test";
import { createCommandScenario, readsFrom } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";

const scenarioWithStop = (calls: string[]) =>
  createCommandScenario({
    label: "gh413-stop-grammar",
    evidence: COMPLETED_EVIDENCE,
    reads: readsFrom(),
    nowIso: () => "2026-11-12T06:30:00.000Z",
    stop: {
      stop: async ({ ref, cause, until }) => {
        calls.push(`${ref}:${cause}:${until}`);
        return {
          ok: true,
          data: {
            query: "stop",
            ref,
            cause,
            until,
            episodeId: "episode-1",
            preservation: "preserved",
          },
        };
      },
    },
  });

const errorCodeOf = (run: Awaited<ReturnType<ReturnType<typeof scenarioWithStop>["invoke"]>>) =>
  run.envelope?.error?.code ?? run.envelope?.data?.error?.code;

describe("TC-PEAK-034 the stop grammar refuses another cause or a missing end", () => {
  for (const cause of ["owner-hold", "liveness-stall", "provider-window"] as const) {
    test(`cause ${cause} is refused input.value.rejected before any lane read`, async () => {
      const calls: string[] = [];
      const scenario = scenarioWithStop(calls);
      try {
        const run = await scenario.invoke([
          "dispatch",
          "stop",
          "GH-413",
          "--cause",
          cause,
          "--until",
          "2026-11-12T10:00:00.000Z",
          "--json",
        ]);
        expect(run.exit).toBe(1);
        expect(errorCodeOf(run)).toBe("input.value.rejected");
        expect(calls).toHaveLength(0);
        expect(scenario.calls.claims).toHaveLength(0);
      } finally {
        scenario.dispose();
      }
    });
  }

  test("a missing end is input.value.rejected with the until-required reason", async () => {
    const calls: string[] = [];
    const scenario = scenarioWithStop(calls);
    try {
      const run = await scenario.invoke([
        "dispatch",
        "stop",
        "GH-413",
        "--cause",
        "peak-window",
        "--json",
      ]);
      expect(run.exit).toBe(1);
      expect(errorCodeOf(run)).toBe("input.value.rejected");
      const summary =
        (run.envelope?.error as { readonly summary?: string } | undefined)?.summary ??
        run.envelope?.data?.error?.summary;
      expect(summary).toContain("until-required");
      expect(calls).toHaveLength(0);
    } finally {
      scenario.dispose();
    }
  });
});
