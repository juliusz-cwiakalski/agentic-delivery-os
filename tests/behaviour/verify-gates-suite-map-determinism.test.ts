/**
 * TC-SDET-001 / TC-SDET-002 / TC-SRES-004 — every declared-map outcome is
 * deterministic across runs, and the narrowed naming stays bounded at maximum
 * breadth.
 */
import { describe, expect, test } from "bun:test";
import { baseFacts, clone, EXPECTED_JOBS, run } from "../fixtures/verify-gates/cases/facts";
import { combinedRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";
import {
  DEFECTS,
  declaredRead,
  disjointMap,
  maxNarrowingMap,
  mirrorAbsentMap,
  narrowedJob01Map,
  REFERENCE_JOB,
  REFERENCE_SUITES,
  twoEqualJobsMap,
  validEqualityMap,
  widerMap,
} from "../fixtures/verify-gates/suite-map/cases";

const REF = "GH-300";

const facts = (mirror: string = REFERENCE_JOB) => {
  const base = clone(baseFacts());
  const names = [...new Set([...EXPECTED_JOBS, mirror])];
  base.workflow = { outcome: "read", names };
  base.checkRuns = {
    ok: true,
    value: { items: names.map((name) => run(name, "succeeded")), pageItemCount: names.length },
  };
  return base;
};

const cases = [
  { id: "equality", read: () => declaredRead(validEqualityMap()), mirror: REFERENCE_JOB },
  { id: "two-equal", read: () => declaredRead(twoEqualJobsMap()), mirror: REFERENCE_JOB },
  { id: "narrowing", read: () => declaredRead(narrowedJob01Map()), mirror: REFERENCE_JOB },
  { id: "wider", read: () => declaredRead(widerMap()), mirror: REFERENCE_JOB },
  { id: "disjoint", read: () => declaredRead(disjointMap()), mirror: REFERENCE_JOB },
  { id: "mirror-absent", read: () => declaredRead(mirrorAbsentMap()), mirror: REFERENCE_JOB },
  {
    id: "invalid-map",
    read: () => () => ({ ok: false as const, code: "config.value.invalid" as const }),
    mirror: REFERENCE_JOB,
  },
  {
    id: "invalid-workflow",
    read: () => declaredRead(validEqualityMap()),
    mirror: REFERENCE_JOB,
    workflow: "failed" as const,
  },
];

const runOnce = async (entry: (typeof cases)[number], mode: "json" | "human") => {
  const base = facts(entry.mirror);
  if (entry.workflow === "failed") base.workflow = { outcome: "failed", names: [] };
  return runVerify(combinedRuntime({ facts: base, suiteMap: entry.read() }), ["gates", REF], {
    json: mode === "json",
  });
};

describe("TC-SDET-001 every declared-map outcome is deterministic", () => {
  for (const entry of cases) {
    test(`${entry.id} is byte-identical across two runs in both modes`, async () => {
      for (const mode of ["json", "human"] as const) {
        const first = await runOnce(entry, mode);
        const second = await runOnce(entry, mode);
        expect(second.stdout).toBe(first.stdout);
        expect(second.stderr).toBe(first.stderr);
        expect(second.exitCode).toBe(first.exitCode);
      }
    });
  }

  test("the first equality in declared order wins on every repeat", async () => {
    for (const order of [
      ["job-01", "job-02"],
      ["job-02", "job-01"],
    ] as const) {
      const map = twoEqualJobsMap(order);
      for (let repeat = 0; repeat < 3; repeat += 1) {
        const result = await runVerify(
          combinedRuntime({ facts: facts("job-01"), suiteMap: declaredRead(map) }),
          ["gates", REF],
        );
        const data = result.envelope?.data as Record<string, unknown>;
        expect(data.mirrorsJob).toBe(order[0]);
      }
    }
  });
});

describe("TC-SDET-002 the narrowed header is bounded and stable at maximum breadth", () => {
  const maxFacts = () => facts("j".repeat(120));

  test("the header prints the first eight mirror identifiers plus omitted=24 identically", async () => {
    const map = maxNarrowingMap();
    const first = await runVerify(
      combinedRuntime({ facts: maxFacts(), suiteMap: declaredRead(map) }),
      ["gates", REF],
    );
    const second = await runVerify(
      combinedRuntime({ facts: maxFacts(), suiteMap: declaredRead(map) }),
      ["gates", REF],
    );
    expect(second.stdout).toBe(first.stdout);
    const summary = String(first.envelope?.error?.summary ?? "");
    const header = summary.split("\n")[0] ?? "";
    expect(header).toContain(
      `breadth=${(map.jobs[0]?.suites ?? []).slice(0, 8).join(",")} omitted=24`,
    );
    expect(header).not.toContain("suite-9");
    expect(summary.split("\n")).toHaveLength(6);
    expect(summary.length).toBeLessThanOrEqual(4096);
    const detail = first.envelope?.detail as { readonly suiteBreadth: readonly string[] };
    expect(detail.suiteBreadth).toEqual(map.local);
  });

  test("the header follows the mirror's order while detail follows the local order", async () => {
    const map = maxNarrowingMap();
    const reversed = { ...map, local: [...map.local].reverse() };
    const result = await runVerify(
      combinedRuntime({ facts: maxFacts(), suiteMap: declaredRead(reversed) }),
      ["gates", REF],
    );
    const header = String(result.envelope?.error?.summary ?? "").split("\n")[0] ?? "";
    expect(header).toContain(
      `breadth=${(map.jobs[0]?.suites ?? []).slice(0, 8).join(",")} omitted=24`,
    );
    const detail = result.envelope?.detail as { readonly suiteBreadth: readonly string[] };
    expect(detail.suiteBreadth).toEqual(reversed.local);
    expect(detail.suiteBreadth).not.toEqual(map.local);
  });

  test("the member-less six-line narrowed header stays within the same grammar", async () => {
    const result = await runVerify(
      combinedRuntime({ facts: facts(), suiteMap: declaredRead(narrowedJob01Map()) }),
      ["gates", REF],
    );
    const lines = String(result.envelope?.error?.summary ?? "").split("\n");
    expect(lines[0]).toBe(
      `result=unknown; gates=5/5 passed, 0 failed, 0 unknown; scope=narrowed mirror=job-01 breadth=${REFERENCE_SUITES.join(",")}`,
    );
    expect(lines).toHaveLength(6);
  });

  test("no outcome renders an empty breadth= or omitted=0", async () => {
    const result = await runVerify(
      combinedRuntime({ facts: facts(), suiteMap: declaredRead(DEFECTS["jobs-empty"] as never) }),
      ["gates", REF],
    );
    expect(result.envelope?.error?.code).toBe("config.value.invalid");
    expect(result.stdout).not.toContain("omitted=0");
    expect(result.stdout).not.toContain("breadth=;");
  });
});
