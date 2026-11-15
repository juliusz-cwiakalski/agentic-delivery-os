/**
 * TC-SNARR-001/003/004/005 — the narrowed-scope refusal on the member-less path.
 *
 * Exit, the closed `error` key set (no `kind`), `detail.suiteBreadth`, the
 * byte-pinned DEC-15 header, precedence over the gate verdict projection and the
 * unknown taxonomy, and the bounded naming at maximum breadth.
 */
import { describe, expect, test } from "bun:test";
import { resolveVerifySuiteMap } from "../../packages/core/src/domain/index";
import { baseFacts, clone, EXPECTED_JOBS, run } from "../fixtures/verify-gates/cases/facts";
import {
  combinedRuntime,
  runVerify,
  SYNTHETIC_BRAND,
} from "../fixtures/verify-gates/cases/harness";
import {
  declaredRead,
  maxNarrowingMap,
  narrowedMap,
  nineLocalMap,
  REFERENCE_JOB,
  REFERENCE_SUITES,
} from "../fixtures/verify-gates/suite-map/cases";

const REF = "GH-300";
const NARROWED_HEADER = `result=unknown; gates=5/5 passed, 0 failed, 0 unknown; scope=narrowed mirror=TS aggregate check breadth=${REFERENCE_SUITES.join(",")}`;

const narrowFacts = (mirror: string = REFERENCE_JOB) => {
  const facts = clone(baseFacts());
  const names = [...EXPECTED_JOBS, mirror];
  facts.workflow = { outcome: "read", names };
  facts.checkRuns = {
    ok: true,
    value: { items: names.map((name) => run(name, "succeeded")), pageItemCount: names.length },
  };
  return facts;
};

const failingFacts = () => {
  const facts = narrowFacts();
  const names = [...EXPECTED_JOBS, REFERENCE_JOB];
  facts.checkRuns = {
    ok: true,
    value: {
      items: names.map((name) => run(name, name === EXPECTED_JOBS[0] ? "failed" : "succeeded")),
      pageItemCount: names.length,
    },
  };
  return facts;
};

const unknownFacts = (classified: boolean) => {
  const facts = narrowFacts();
  facts.openPullRequests = classified
    ? { ok: false, reason: "credential-unavailable", failureCode: "config.credential.missing" }
    : { ok: false, reason: "read-failed", failureClass: "provider.payload.invalid" };
  facts.deliveryRequestDetail = { ok: false, reason: "not-attempted" };
  facts.checkRuns = { ok: false, reason: "not-attempted" };
  return facts;
};

const runNarrow = async (
  facts: ReturnType<typeof baseFacts>,
  map: ReturnType<typeof narrowedMap> = narrowedMap(),
) => runVerify(combinedRuntime({ facts, suiteMap: declaredRead(map) }), ["gates", REF], {});

const errorOf = (envelope: Record<string, unknown> | undefined) =>
  envelope?.error as Record<string, unknown>;

describe("TC-SNARR-001 the refusal identity, detail, and pinned header", () => {
  test("exit 1, no data, closed error keys, complete local detail", async () => {
    const result = await runNarrow(narrowFacts());
    expect(result.exitCode).toBe(1);
    expect(result.envelope?.data).toBeUndefined();
    const error = errorOf(result.envelope);
    expect(error).toBeDefined();
    expect(Object.keys(error ?? {}).sort()).toEqual(
      ["category", "code", "consequence", "remediationHint", "retryable", "summary"].sort(),
    );
    expect(error?.code).toBe("verify.narrowed-scope");
    expect(error?.category).toBe("user");
    expect(error?.retryable).toBe(false);
    expect(error?.consequence).toBe("not_landed");
    expect(error?.remediationHint).toBe(
      "Run the local gate over the declared full suite breadth, or update the declared suite map so the local suite set matches the mirrored CI job, then re-run the gates.",
    );
    expect(result.envelope?.detail).toEqual({ suiteBreadth: ["tests"] });
    expect(Object.keys((result.envelope?.detail as object) ?? {})).toEqual(["suiteBreadth"]);
  });

  test("the header is byte-equal to the pinned DEC-15 grammar and names the mirror breadth", async () => {
    const result = await runNarrow(narrowFacts());
    const summary = String(errorOf(result.envelope)?.summary ?? "");
    const lines = summary.split("\n");
    expect(lines[0]).toBe(NARROWED_HEADER);
    expect(lines).toHaveLength(6);
    expect(summary.length).toBeLessThanOrEqual(4096);
    expect(lines[0]).not.toContain("mirror=tests");
    expect(lines[0]?.split(" breadth=").length).toBe(2);
  });

  test("the human failure rendering keeps the code and the supplied block, with no cause line", async () => {
    const result = await runVerify(
      combinedRuntime({ facts: narrowFacts(), suiteMap: declaredRead(narrowedMap()) }),
      ["gates", REF],
      { json: false },
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr.startsWith(`${SYNTHETIC_BRAND.binaryName}: verify.narrowed-scope\n`)).toBe(
      true,
    );
    expect(result.stderr).toContain(`summary: ${NARROWED_HEADER}`);
    expect(result.stderr).not.toContain("cause:");
    expect(result.stdout).not.toContain(" pass ");
  });

  test("a job carrying U+2028 or U+2029 is refused before any narrowed header renders", async () => {
    for (const separator of ["\u2028", "\u2029"]) {
      const raw = {
        schemaVersion: "delivery.verify.suite-map.v1",
        jobs: [{ job: `TS${separator}aggregate check`, suites: [...REFERENCE_SUITES] }],
        local: ["tests"],
      };
      const result = await runVerify(
        combinedRuntime({ facts: narrowFacts(), suiteMap: () => resolveVerifySuiteMap(raw) }),
        ["gates", REF],
        { json: false },
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("config.value.invalid");
      expect(
        result.stderr.startsWith(`${SYNTHETIC_BRAND.binaryName}: config.value.invalid\n`),
      ).toBe(true);
      expect(result.stdout).not.toContain("scope=narrowed");
      expect(result.stderr).not.toContain("scope=narrowed");
      expect(result.stderr).not.toContain("cause:");
      expect(result.stdout).not.toMatch(/[\u2028\u2029]/u);
      expect(result.stderr).not.toMatch(/[\u2028\u2029]/u);
    }
  });

  test("the invoked envelope is deterministic across two runs", async () => {
    const first = await runNarrow(narrowFacts());
    const second = await runNarrow(narrowFacts());
    expect(second.stdout).toBe(first.stdout);
    expect(second.stderr).toBe(first.stderr);
    expect(second.exitCode).toBe(first.exitCode);
  });
});

describe("TC-SNARR-003 the refusal precedes verify.gates.failed", () => {
  test("a failing gate still yields verify.narrowed-scope with result=fail and every gate line", async () => {
    const result = await runNarrow(failingFacts());
    const error = errorOf(result.envelope);
    expect(error?.code).toBe("verify.narrowed-scope");
    const lines = String(error?.summary ?? "").split("\n");
    expect(lines).toHaveLength(6);
    expect(lines[0]).toBe(
      `result=fail; gates=4/5 passed, 1 failed, 0 unknown; scope=narrowed mirror=TS aggregate check breadth=${REFERENCE_SUITES.join(",")}`,
    );
    expect(String(error?.summary)).toContain("ci-green fail reason=ci-failed");
    expect(result.envelope?.detail).toEqual({ suiteBreadth: ["tests"] });
  });

  test("the delivered failure path is unchanged for a no-map run with the same facts", async () => {
    const result = await runVerify(combinedRuntime({ facts: failingFacts() }), ["gates", REF], {});
    expect(errorOf(result.envelope)?.code).toBe("verify.gates.failed");
    expect(result.envelope?.detail).toBeUndefined();
  });
});

describe("TC-SNARR-004 the refusal precedes the unknown taxonomy", () => {
  for (const classified of [true, false]) {
    test(`the ${classified ? "classified" : "unclassified"} unknown still refuses for scope`, async () => {
      const result = await runNarrow(unknownFacts(classified));
      const error = errorOf(result.envelope);
      expect(error?.code).toBe("verify.narrowed-scope");
      expect(result.exitCode).toBe(1);
      const summary = String(error?.summary ?? "");
      expect(summary.split("\n")).toHaveLength(6);
      expect(summary).toContain("ci-green unknown reason=");
      expect(result.envelope?.detail).toEqual({ suiteBreadth: ["tests"] });
    });
  }

  test("the no-map control keeps the delivered unknown taxonomy", async () => {
    const result = await runVerify(
      combinedRuntime({ facts: unknownFacts(true) }),
      ["gates", REF],
      {},
    );
    expect(errorOf(result.envelope)?.code).toBe("config.credential.missing");
    const unclassified = await runVerify(
      combinedRuntime({ facts: unknownFacts(false) }),
      ["gates", REF],
      {},
    );
    expect(errorOf(unclassified.envelope)?.code).toBe("verify.gates.unavailable");
  });
});

describe("TC-SNARR-005 the naming stays bounded", () => {
  test("nine local identifiers are complete in detail while the header prints eight plus omitted=1", async () => {
    const facts = narrowFacts();
    facts.workflow = { outcome: "read", names: [...EXPECTED_JOBS, REFERENCE_JOB] };
    const result = await runNarrow(facts, nineLocalMap());
    const detail = result.envelope?.detail as { readonly suiteBreadth: readonly string[] };
    expect(detail.suiteBreadth).toEqual(nineLocalMap().local);
    const header = String(errorOf(result.envelope)?.summary ?? "").split("\n")[0] ?? "";
    const mirror = nineLocalMap().jobs[0]?.suites ?? [];
    expect(header).toContain(`breadth=${mirror.slice(0, 8).join(",")} omitted=2`);
    expect(String(errorOf(result.envelope)?.summary).split("\n")).toHaveLength(6);
  });

  test("the max-breadth case keeps 31 identifiers in detail and omitted=24 in the header", async () => {
    const map = maxNarrowingMap();
    const facts = narrowFacts("j".repeat(120));
    const result = await runNarrow(facts, map);
    const detail = result.envelope?.detail as { readonly suiteBreadth: readonly string[] };
    expect(detail.suiteBreadth).toHaveLength(31);
    const summary = String(errorOf(result.envelope)?.summary ?? "");
    const header = summary.split("\n")[0] ?? "";
    expect(header).toContain(
      `breadth=${(map.jobs[0]?.suites ?? []).slice(0, 8).join(",")} omitted=24`,
    );
    expect(summary.split("\n")).toHaveLength(6);
    expect(summary.length).toBeLessThanOrEqual(4096);
    expect(header).not.toContain("suite-9");
  });
});
