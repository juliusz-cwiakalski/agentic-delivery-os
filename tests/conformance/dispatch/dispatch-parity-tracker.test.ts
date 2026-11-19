/**
 * TC-TRACKER-001/002/003 — the bounded tracker retry ladder over the real
 * composed production program (GH-347 F-4; API-4; DEC-7; TDR-0048).
 *
 * The tracker read is the production read through the injected delay recorder;
 * the scripted transport fails a declared number of issue reads, so the attempt
 * count and waits are observable independently of the resulting token.
 */
import { describe, expect, test } from "bun:test";
import { parityCasesOf } from "../../fixtures/dispatch/parity/cases";
import { trackerOutage, trackerTransient } from "../../fixtures/dispatch/parity/pm-notes";

const ladderWaits = (observation: Awaited<ReturnType<typeof trackerTransient>>): number[] =>
  observation.waits.filter((wait) => wait.reason === "tracker-ladder").map((wait) => wait.ms);

describe("TC-TRACKER-001 a transient failure then success uses the successful read", () => {
  test("four attempts with waits [2000,4000,8000] and no exhaustion reference", async () => {
    const observation = await trackerTransient({ failures: 3, ahead: 2 });
    expect(observation.results[0]?.exit).toBe(0);
    expect(observation.token).toBe("finished");
    expect(ladderWaits(observation)).toEqual([2000, 4000, 8000]);
    expect(ladderWaits(observation).reduce((total, ms) => total + ms, 0)).toBe(14_000);
    const attempt = observation.attempts[0];
    expect(attempt?.evidenceRefs ?? []).not.toContain("tracker:exhausted");
  });
});

describe("TC-TRACKER-002 exhaustion with no decisive artifact is state-unverified", () => {
  test("five attempts, waits [2000,4000,8000,16000], exit 2, exhaustion named", async () => {
    const entry = parityCasesOf("tracker-outage").find(
      (row) => row.id === "tracker-outage-without-artifact",
    );
    if (entry === undefined) throw new Error("the without-artifact registry row is missing");
    const observation = await entry.scenario();
    expect(observation.token).toBe("state-unverified");
    expect(observation.results[0]?.exit).toBe(2);
    expect(ladderWaits(observation)).toEqual([2000, 4000, 8000, 16000]);
    expect(ladderWaits(observation).reduce((total, ms) => total + ms, 0)).toBe(30_000);
    const attempt = observation.attempts[0];
    expect(attempt?.evidenceRefs ?? []).toContain("tracker:exhausted");
    expect(attempt?.token).toBe("state-unverified");
    expect(attempt?.falseSuccess).toBe(false);
  });
});

describe("TC-TRACKER-003 exhaustion with a decisive artifact resolves the artifact", () => {
  const rows: readonly {
    readonly artifact: "open-pr" | "already-merged" | "commits-complete" | "commits-incomplete";
    readonly token: string;
    readonly exit: number;
  }[] = [
    { artifact: "open-pr", token: "pr-open", exit: 0 },
    { artifact: "already-merged", token: "merged", exit: 0 },
    { artifact: "commits-complete", token: "finished", exit: 0 },
    { artifact: "commits-incomplete", token: "partial", exit: 1 },
  ];
  for (const row of rows) {
    test(`${row.artifact} resolves ${row.token} with the exhaustion named`, async () => {
      const observation = await trackerOutage({
        label: `tracker-003-${row.artifact}`,
        artifact: row.artifact,
      });
      expect(observation.token).toBe(row.token);
      expect(observation.results[0]?.exit).toBe(row.exit);
      const attempt = observation.attempts[0];
      expect(attempt?.evidenceRefs ?? []).toContain("tracker:exhausted");
      // No tracker success claim is fabricated for a failed read: the source is
      // either unsatisfied (when required) or not-applicable (when not).
      expect(attempt?.corroboration.tracker).not.toBe("satisfied");
    });
  }

  test("the registered with-artifact row is the same scenario", async () => {
    const entry = parityCasesOf("tracker-outage").find(
      (row) => row.id === "tracker-outage-with-artifact",
    );
    if (entry === undefined) throw new Error("the with-artifact registry row is missing");
    const observation = await entry.scenario();
    expect(observation.token).toBe(entry.expected.token);
    expect(observation.results[0]?.exit).toBe(entry.expected.exit);
    expect(ladderWaits(observation)).toEqual([2000, 4000, 8000, 16000]);
  });
});
