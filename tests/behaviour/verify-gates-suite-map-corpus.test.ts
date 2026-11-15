/**
 * TC-SMAP-005 / TC-SRES-002 / TC-SRES-003 / TC-SNARR-001/003/005/006 /
 * TC-SDET-002 — the pinned renderers over a real five-gate evaluation.
 *
 * Pure domain only: the delivered battery evaluator supplies the gate lines, and
 * the narrowed renderer and the cause-line renderer are asserted byte-exactly
 * against the DEC-15/DEC-16 grammar.
 */
import { describe, expect, test } from "bun:test";
import {
  VERIFY_GATES_MAX_SUMMARY_BYTES,
  VERIFY_GATES_MAX_SUMMARY_LINES,
} from "../../packages/core/src/contracts/index";
import {
  evaluateVerifyGates,
  renderSuiteMapCauseLine,
  renderVerifyGatesFailureSummary,
  renderVerifyGatesNarrowedFailureSummary,
  resolveVerifySuiteBreadth,
  resolveVerifySuiteMap,
} from "../../packages/core/src/domain/index";
import { baseFacts, clone, EXPECTED_JOBS, run } from "../fixtures/verify-gates/cases/facts";
import {
  maxNarrowingMap,
  narrowedMap,
  ninePlusUnmirroredMap,
  REFERENCE_JOB,
  REFERENCE_SUITES,
  validEqualityMap,
  widerMap,
} from "../fixtures/verify-gates/suite-map/cases";

const FORMAT_CONTROL = /\p{Cf}/u;

/** True when the value carries a control character, U+2028, U+2029, or a format control. */
const hasControlOrFormat = (value: string): boolean => {
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (point <= 0x1f || (point >= 0x7f && point <= 0x9f)) return true;
    if (point === 0x2028 || point === 0x2029) return true;
    if (FORMAT_CONTROL.test(character)) return true;
  }
  return false;
};

const evaluation = () => evaluateVerifyGates(baseFacts());

const failedEvaluation = () => {
  const facts = clone(baseFacts());
  facts.checkRuns = {
    ok: true,
    value: {
      items: EXPECTED_JOBS.map((name) =>
        run(name, name === EXPECTED_JOBS[0] ? "failed" : "succeeded"),
      ),
      pageItemCount: EXPECTED_JOBS.length,
    },
  };
  return evaluateVerifyGates(facts);
};

const narrowed = (rawMap: unknown) => {
  const declared = resolveVerifySuiteMap(rawMap);
  if (!declared.ok || !declared.declared) throw new Error("expected a declared map");
  const outcome = resolveVerifySuiteBreadth({
    map: declared.value,
    workflow: { outcome: "read", names: [REFERENCE_JOB, "j".repeat(120)] },
  });
  if (outcome.kind !== "narrower") throw new Error(`expected narrowing, got ${outcome.kind}`);
  return { declared: declared.value, outcome };
};

const zeroGateEvaluation = {
  overall: "pass" as const,
  summary: { gates: 0, passed: 0, failed: 0, unknown: 0 },
  gates: [],
};

describe("TC-SNARR-001/003 the narrowed header is byte-pinned", () => {
  test("an all-pass narrow battery renders result=unknown and the eight mirror identifiers", () => {
    const { outcome } = narrowed(narrowedMap());
    const summary = renderVerifyGatesNarrowedFailureSummary(evaluation(), {
      mirrorsJob: outcome.mirrorsJob,
      mirrorBreadth: outcome.mirrorBreadth,
    });
    const [header, ...rest] = summary.split("\n");
    expect(header).toBe(
      `result=unknown; gates=5/5 passed, 0 failed, 0 unknown; scope=narrowed mirror=TS aggregate check breadth=${REFERENCE_SUITES.join(",")}`,
    );
    expect(rest).toHaveLength(5);
    expect(summary.split("\n")).toHaveLength(VERIFY_GATES_MAX_SUMMARY_LINES);
    expect(summary.length).toBeLessThanOrEqual(VERIFY_GATES_MAX_SUMMARY_BYTES);
  });

  test("a failing gate renders result=fail and keeps every gate line", () => {
    const { outcome } = narrowed(narrowedMap());
    const summary = renderVerifyGatesNarrowedFailureSummary(failedEvaluation(), {
      mirrorsJob: outcome.mirrorsJob,
      mirrorBreadth: outcome.mirrorBreadth,
    });
    const lines = summary.split("\n");
    expect(lines[0]).toContain("result=fail;");
    expect(lines).toHaveLength(6);
    expect(summary).toContain("ci-green fail reason=ci-failed");
  });

  test("the delivered renderer still produces the unchanged block", () => {
    const summary = renderVerifyGatesFailureSummary(evaluation());
    expect(summary.split("\n")[0]).toBe("result=unknown; gates=5/5 passed, 0 failed, 0 unknown");
  });
});

describe("TC-SNARR-005/TC-SDET-002 the narrowed naming stays bounded", () => {
  test("the mirror's first eight identifiers plus omitted=24 at maximum breadth", () => {
    const { declared, outcome } = narrowed(maxNarrowingMap());
    const summary = renderVerifyGatesNarrowedFailureSummary(evaluation(), {
      mirrorsJob: outcome.mirrorsJob,
      mirrorBreadth: outcome.mirrorBreadth,
    });
    const header = summary.split("\n")[0] ?? "";
    const expectedIds = declared.jobs[0]?.suites.slice(0, 8).join(",") ?? "";
    expect(header).toContain(`breadth=${expectedIds} omitted=24`);
    expect(header).not.toContain("suite-9");
    expect(header.length).toBeGreaterThan(0);
    expect(summary.split("\n")).toHaveLength(6);
    expect(summary.length).toBeLessThanOrEqual(VERIFY_GATES_MAX_SUMMARY_BYTES);
  });

  test("the member-declaring path renders exactly one line over zero gates", () => {
    const { outcome } = narrowed(narrowedMap());
    const summary = renderVerifyGatesNarrowedFailureSummary(zeroGateEvaluation, {
      mirrorsJob: outcome.mirrorsJob,
      mirrorBreadth: outcome.mirrorBreadth,
    });
    expect(summary).toBe(
      `result=unknown; gates=0/0 passed, 0 failed, 0 unknown; scope=narrowed mirror=TS aggregate check breadth=${REFERENCE_SUITES.join(",")}`,
    );
    expect(summary.split("\n")).toHaveLength(1);
  });

  test("a job name with spaces is preserved verbatim and terminated by breadth=", () => {
    const { outcome } = narrowed(narrowedMap());
    const header = renderVerifyGatesNarrowedFailureSummary(evaluation(), {
      mirrorsJob: outcome.mirrorsJob,
      mirrorBreadth: outcome.mirrorBreadth,
    }).split("\n")[0];
    expect(header).toContain("mirror=TS aggregate check breadth=");
    expect(header?.split(" breadth=").length).toBe(2);
  });

  test("the nine-identifier case prints eight and omitted=1", () => {
    const header = renderVerifyGatesNarrowedFailureSummary(evaluation(), {
      mirrorsJob: "mirror",
      mirrorBreadth: Array.from({ length: 9 }, (_, index) => `s-${index + 1}`),
    }).split("\n")[0];
    expect(header).toContain("breadth=s-1,s-2,s-3,s-4,s-5,s-6,s-7,s-8 omitted=1");
  });
});

describe("TC-SRES-002/003 the one bounded cause line", () => {
  test("an uncorroborated mirror renders the mirror form within its bound", () => {
    const declared = resolveVerifySuiteMap(narrowedMap());
    if (!declared.ok || !declared.declared) throw new Error("expected a declared map");
    const outcome = resolveVerifySuiteBreadth({
      map: declared.value,
      workflow: { outcome: "read", names: ["not-the-mirror"] },
    });
    const line = renderSuiteMapCauseLine(outcome, declared.value.local);
    expect(line).toBe("mirror=TS aggregate check");
    expect(`cause: ${line ?? ""}`.length).toBeLessThanOrEqual(134);
  });

  test("an unmirrored local breadth renders the breadth form", () => {
    const declared = resolveVerifySuiteMap(widerMap());
    if (!declared.ok || !declared.declared) throw new Error("expected a declared map");
    const outcome = resolveVerifySuiteBreadth({
      map: declared.value,
      workflow: { outcome: "read", names: [REFERENCE_JOB] },
    });
    const line = renderSuiteMapCauseLine(outcome, declared.value.local);
    expect(line).toBe(`breadth=${REFERENCE_SUITES.join(",")} omitted=1`);
    expect(`cause: ${line ?? ""}`.length).toBeLessThanOrEqual(545);
  });

  test("a nine-plus unmirrored breadth prints eight and counts the rest", () => {
    const map = ninePlusUnmirroredMap();
    const outcome = resolveVerifySuiteBreadth({
      map,
      workflow: { outcome: "read", names: ["job-01"] },
    });
    const line = renderSuiteMapCauseLine(outcome, map.local);
    expect(line).toBe(
      "breadth=unmirrored-1,unmirrored-2,unmirrored-3,unmirrored-4,unmirrored-5,unmirrored-6,unmirrored-7,unmirrored-8 omitted=1",
    );
  });

  test("equality, narrowing, and not-evaluated each write no cause line", () => {
    const equality = resolveVerifySuiteMap(validEqualityMap());
    if (!equality.ok || !equality.declared) throw new Error("expected an equality map");
    const narrowing = resolveVerifySuiteMap(narrowedMap());
    if (!narrowing.ok || !narrowing.declared) throw new Error("expected a narrowed map");
    const cases = [
      {
        name: "equality",
        map: equality.value,
        workflow: { outcome: "read" as const, names: ["job-01"] },
        expected: "equal" as const,
      },
      {
        name: "narrowing",
        map: narrowing.value,
        workflow: { outcome: "read" as const, names: [REFERENCE_JOB] },
        expected: "narrower" as const,
      },
      {
        name: "not-evaluated",
        map: narrowing.value,
        workflow: { outcome: "failed" as const, names: [] },
        expected: "not-evaluated" as const,
      },
    ];
    for (const entry of cases) {
      const outcome = resolveVerifySuiteBreadth({
        map: entry.map,
        workflow: entry.workflow,
      });
      expect(outcome.kind, entry.name).toBe(entry.expected);
      expect(renderSuiteMapCauseLine(outcome, entry.map.local), entry.name).toBeUndefined();
    }
  });

  test("a job carrying U+2028 or U+2029 never reaches a renderer", () => {
    for (const separator of ["\u2028", "\u2029"]) {
      const raw = {
        schemaVersion: "delivery.verify.suite-map.v1",
        jobs: [{ job: `TS${separator}aggregate check`, suites: [...REFERENCE_SUITES] }],
        local: [...REFERENCE_SUITES],
      };
      expect(resolveVerifySuiteMap(raw).ok, JSON.stringify(separator)).toBe(false);
    }
  });

  test("every accepted job renders exactly one physical line with no control or format character", () => {
    const accepted = [
      REFERENCE_JOB,
      "job-01",
      "j".repeat(120),
      "TS – aggregate check",
      "TS\u00a0aggregate check",
    ];
    for (const job of accepted) {
      const resolved = resolveVerifySuiteMap({
        schemaVersion: "delivery.verify.suite-map.v1",
        jobs: [{ job, suites: ["tests"] }],
        local: ["tests"],
      });
      expect(resolved.ok, job).toBe(true);
      const line = renderSuiteMapCauseLine({ kind: "uncorroborated", mirrorsJob: job }, ["tests"]);
      expect(line, job).toBe(`mirror=${job}`);
      expect(hasControlOrFormat(line ?? ""), job).toBe(false);
      expect((line ?? "").split(/\r\n|\r|\n/u), job).toHaveLength(1);
      const header =
        renderVerifyGatesNarrowedFailureSummary(evaluation(), {
          mirrorsJob: job,
          mirrorBreadth: [...REFERENCE_SUITES],
        }).split("\n")[0] ?? "";
      expect(header, job).toContain(`mirror=${job} breadth=`);
      expect(hasControlOrFormat(header), job).toBe(false);
      expect(header.split(/\r\n|\r|\n/u), job).toHaveLength(1);
    }
  });

  test("every rendering is deterministic across runs", () => {
    const first = renderVerifyGatesNarrowedFailureSummary(evaluation(), {
      mirrorsJob: narrowed(narrowedMap()).outcome.mirrorsJob,
      mirrorBreadth: narrowed(narrowedMap()).outcome.mirrorBreadth,
    });
    const second = renderVerifyGatesNarrowedFailureSummary(evaluation(), {
      mirrorsJob: narrowed(narrowedMap()).outcome.mirrorsJob,
      mirrorBreadth: narrowed(narrowedMap()).outcome.mirrorBreadth,
    });
    expect(second).toBe(first);
  });
});
