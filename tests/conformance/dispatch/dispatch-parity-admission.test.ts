/**
 * TC-ADMIT-001..005 — atomic dispatch admission over the real composed
 * production program and the real state store (GH-347 F-2; DEC-1; TDR-0050).
 *
 * Every case drives the shipped composition (driver D1) with only the declared
 * seams injected. The two concurrent-dispatch scenarios come from the single
 * registry `tests/fixtures/dispatch/parity/cases.ts`; the fence-contention and
 * refusal-table cases use the same latch and harness.
 */
import { describe, expect, test } from "bun:test";
import { projectExitCode } from "../../../packages/cli/src/projection";
import { ERROR_TABLE } from "../../../packages/core/src/contracts/index";
import { parityCasesOf } from "../../fixtures/dispatch/parity/cases";
import { createParityHarness } from "../../fixtures/dispatch/parity/harness";
import { admissionSameRefRace, createFenceLatch } from "../../fixtures/dispatch/parity/interleave";

const sideOf = (observation: Awaited<ReturnType<typeof admissionSameRefRace>>) =>
  observation.results.map((result) => ({
    exit: result.exit,
    code: result.envelope?.error?.code,
    holder: result.envelope?.detail?.holder,
    text: JSON.stringify(result.envelope ?? {}),
  }));

const errorRowExit = (code: string): number => {
  const row = ERROR_TABLE.find((entry) => entry.code === code);
  if (row === undefined) throw new Error(`error row ${code} is not in the table`);
  return projectExitCode(row.projectionClass);
};

describe("TC-ADMIT-001 two concurrent same-ref dispatches receive their declared verdict", () => {
  for (const parked of ["first", "second"] as const) {
    test(`parked=${parked}: exactly one admitted and one queue.single-flight naming the holder`, async () => {
      const observation = await admissionSameRefRace({ parked, label: `admit-race-${parked}` });
      const sides = sideOf(observation);
      expect(sides).toHaveLength(2);
      const admitted = sides.filter((side) => side.exit === 0);
      const refused = sides.filter((side) => side.exit !== 0);
      expect(admitted).toHaveLength(1);
      expect(refused).toHaveLength(1);
      const loser = refused[0];
      expect(loser?.code).toBe("queue.single-flight");
      expect(loser?.exit).toBe(errorRowExit("queue.single-flight"));
      expect(loser?.holder).toBe("dispatch");
      expect(loser?.text).not.toContain("fallback.internal");
      // Cardinality: exactly one acquisition (plus its release record) and
      // exactly one attempt record; the refusal appended neither.
      expect(observation.leaseAcquisitions).toBe(1);
      expect(observation.leaseRecords).toBe(2);
      expect(observation.attempts).toHaveLength(1);
      expect(observation.spawns).toBe(1);
      expect(observation.violations).toEqual([]);
    });
  }

  test("the registry carries exactly the declared admission rows", () => {
    const rows = parityCasesOf("admission");
    expect(rows.map((row) => row.id)).toEqual([
      "admission-same-ref-race",
      "admission-other-ref-lease",
    ]);
    for (const row of rows) expect(row.declaredSeam).toBe("claim");
  });

  test("the registered same-ref scenario is the one asserted above", async () => {
    const entry = parityCasesOf("admission").find((row) => row.id === "admission-same-ref-race");
    if (entry === undefined) throw new Error("the admission registry row is missing");
    const observation = await entry.scenario();
    const sides = sideOf(observation);
    expect(sides.filter((side) => side.exit === 0)).toHaveLength(entry.expected.admitted ?? 1);
    expect(sides.filter((side) => side.exit !== 0)).toHaveLength(entry.expected.refused ?? 1);
  });
});

describe("TC-ADMIT-002 a live other-ref lease refuses queue.lease-conflict pre-session", () => {
  test("the refusal names the holder and appends no attempt, lane, or lease", async () => {
    const entry = parityCasesOf("admission").find((row) => row.id === "admission-other-ref-lease");
    if (entry === undefined) throw new Error("the other-ref registry row is missing");
    const observation = await entry.scenario();
    const result = observation.results[0];
    expect(result?.exit).toBe(errorRowExit("queue.lease-conflict"));
    expect(result?.envelope?.error?.code).toBe("queue.lease-conflict");
    expect(result?.envelope?.error?.summary).toContain("lane-1");
    expect(JSON.stringify(result?.envelope ?? {})).not.toContain("fallback.internal");
    expect(observation.attempts).toHaveLength(0);
    expect(observation.lanes).toHaveLength(0);
    // The seeded lease is the only lease record and is unmodified; the refused
    // dispatch appended no acquisition.
    expect(observation.leaseRecords).toBe(1);
    expect(observation.leaseAcquisitions).toBe(1);
  });
});

describe("TC-ADMIT-003 fence contention is waited out and re-decided, never surfaced", () => {
  test("the dispatch proceeds after the fence frees, with recorded bounded waits", async () => {
    const latch = createFenceLatch();
    const h = createParityHarness({ label: "admit-fence-wait", delay: latch.delay });
    try {
      const held = h.holdFence();
      const run = h.run();
      await latch.parked();
      h.releaseFence(held);
      latch.release();
      const result = await run;
      const observation = h.observe();
      expect(result.envelope?.error?.code).toBeUndefined();
      expect(result.exit).toBe(0);
      expect(observation.leaseAcquisitions).toBe(1);
      expect(observation.attempts).toHaveLength(1);
      const waits = observation.waits.filter((wait) => wait.reason === "claim-fence");
      expect(waits.length).toBeGreaterThanOrEqual(1);
      for (const wait of waits) expect(wait.ms).toBeLessThanOrEqual(90_000);
      // A wait is never a verdict: no queue-kind error and no internal identity.
      expect(JSON.stringify(result.envelope ?? {})).not.toContain("fallback.internal");
    } finally {
      h.dispose();
    }
  });
});

describe("TC-ADMIT-004 a persistent state failure keeps its state.* kind at exit 2", () => {
  test("the durable fence holder is never released: state kind, bounded wait, zero records", async () => {
    const h = createParityHarness({ label: "admit-persistent-contention" });
    try {
      h.holdFence();
      const result = await h.run();
      const observation = h.observe();
      const code = result.envelope?.error?.code ?? "";
      expect(result.exit).toBe(2);
      expect(code.startsWith("state.")).toBe(true);
      const row = ERROR_TABLE.find((entry) => entry.code === code);
      expect(row).toBeDefined();
      expect(row?.domainKind).toBe("state");
      expect(row?.projectionClass).toBe("platform-provider");
      expect(JSON.stringify(result.envelope ?? {})).not.toContain("fallback.internal");
      expect(observation.attempts).toHaveLength(0);
      expect(observation.lanes).toHaveLength(0);
      expect(observation.leaseRecords).toBe(0);
      expect(observation.leaseAcquisitions).toBe(0);
      const waits = observation.waits.filter((wait) => wait.reason === "claim-fence");
      const cumulative = waits.reduce((total, wait) => total + wait.ms, 0);
      expect(waits.length).toBeGreaterThan(0);
      expect(cumulative).toBeLessThanOrEqual(90_000);
      expect(waits.length).toBeLessThan(90_000);
    } finally {
      h.dispose();
    }
  });
});

describe("TC-ADMIT-005 every refusal exits its mapped code with zero records", () => {
  test("the refusal table maps to its ERROR_TABLE projection and appends nothing", async () => {
    const refusalRows: readonly {
      readonly label: string;
      readonly code: string;
      readonly seed: () => ReturnType<typeof createParityHarness>;
    }[] = [
      {
        label: "same-ref live lease",
        code: "queue.single-flight",
        seed: () => {
          const h = createParityHarness({ label: "admit-table-same-ref" });
          h.seedLease({ ref: "GH-347", holder: "lane-1" });
          return h;
        },
      },
      {
        label: "other-ref live lease",
        code: "queue.lease-conflict",
        seed: () => {
          const h = createParityHarness({ label: "admit-table-other-ref", extraRefs: ["GH-400"] });
          h.seedLease({ ref: "GH-400", holder: "lane-1" });
          return h;
        },
      },
    ];
    for (const row of refusalRows) {
      const h = row.seed();
      try {
        const result = await h.run();
        expect(result.exit, row.label).toBe(errorRowExit(row.code));
        expect(result.envelope?.error?.code, row.label).toBe(row.code);
        const attempts = await h.run(["dispatch", "attempts", "--ref", "GH-347", "--json"]);
        expect(attempts.exit, row.label).toBe(0);
        const data = attempts.envelope?.data as
          | { readonly matched?: number; readonly attempts?: readonly unknown[] }
          | undefined;
        expect(data?.matched, row.label).toBe(0);
        expect(data?.attempts, row.label).toEqual([]);
        expect(h.observe().attempts, row.label).toHaveLength(0);
        expect(h.observe().lanes, row.label).toHaveLength(0);
      } finally {
        h.dispose();
      }
    }
  });

  test("a refused ref still admits after the live lease is gone", async () => {
    const h = createParityHarness({ label: "admit-recovery", extraRefs: ["GH-400"] });
    try {
      h.seedLease({ ref: "GH-347", holder: "lane-1" });
      const refused = await h.run();
      expect(refused.exit).toBe(errorRowExit("queue.single-flight"));
      // Release the seeded lease through the real primitive, then dispatch again.
      const { releaseQueueLease } = await import("../../../packages/core/src/app/queue");
      const released = releaseQueueLease(h.store, {
        ref: "GH-347",
        holder: "lane-1",
        nowIso: h.clock.nowIso(),
        nowMs: h.clock.nowMs(),
        fenceToken: "release-seeded",
      });
      expect(released.ok).toBe(true);
      const admitted = await h.run();
      expect(admitted.exit).toBe(0);
      expect(h.observe().attempts).toHaveLength(1);
    } finally {
      h.dispose();
    }
  });
});
