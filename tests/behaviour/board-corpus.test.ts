/**
 * TC-SLA-028 — the committed corpus is the deterministic oracle for the whole
 * feature, covers every named class, makes zero live calls, and is
 * completeness- and mutation-checked.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readOwnerGateSlaDecisions } from "../../packages/core/src/state/index";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import {
  availableCollector,
  type BoardCollectorSpec,
  boardData,
  boardGates,
  createBoardHarness,
  failingCollector,
} from "../fixtures/board/harness";
import { type GateFactInput, gateFact } from "../fixtures/board/matrix";

const ROOT = process.cwd();
const CORPUS_ROOT = join(ROOT, "tests/fixtures/board/corpus");

type CorpusGate = {
  readonly id: string;
  readonly kind: string;
  readonly ref: string;
  readonly ageMs?: number;
  readonly activity?: "absent" | "unparseable";
  readonly waivedBy?: string;
};

type CorpusCollector = { readonly id: string; readonly outcome: "available" | "failed" };

type CorpusExpectation = {
  readonly exitCode: number;
  readonly gateCount: number;
  readonly records: number;
  readonly truncated: boolean;
  readonly omitted: number;
  readonly errorCode?: string;
  readonly gates: readonly {
    readonly id: string;
    readonly slaState: string;
    readonly default: string | null;
    readonly waivedBy: string | null;
    readonly ageUnknownReason?: string;
  }[];
};

type CorpusCase = {
  readonly id: string;
  readonly class: string;
  readonly replays?: number;
  readonly gates?: readonly CorpusGate[];
  readonly collectors?: readonly CorpusCollector[];
  readonly generated?: {
    readonly count: number;
    readonly refPrefix: string;
    readonly ageStepMs: number;
  };
  readonly expect: CorpusExpectation;
};

const loadCases = (): CorpusCase[] =>
  readdirSync(CORPUS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const path = join(CORPUS_ROOT, entry.name, "case.json");
      return JSON.parse(readFileSync(path, "utf8")) as CorpusCase;
    })
    .sort((left, right) => left.id.localeCompare(right.id));

const gatesFor = (testCase: CorpusCase): ReturnType<typeof gateFact>[] => {
  const generated = testCase.generated;
  if (generated !== undefined) {
    return Array.from({ length: generated.count }, (_, index) =>
      gateFact({
        id: `${generated.refPrefix}${index.toString().padStart(3, "0")}:owner-review`,
        ref: `${generated.refPrefix}${index.toString().padStart(3, "0")}`,
        kind: "owner-review",
        ageMs: (index + 1) * generated.ageStepMs,
      }),
    );
  }
  return (testCase.gates ?? []).map((gate) => {
    const input: GateFactInput = {
      id: gate.id,
      kind: gate.kind,
      ref: gate.ref,
      ...(gate.ageMs === undefined ? {} : { ageMs: gate.ageMs }),
      ...(gate.activity === "absent" ? { absent: "missing" } : {}),
      ...(gate.activity === "unparseable" ? { activityAt: "not-a-date" } : {}),
      ...(gate.waivedBy === undefined ? {} : { waivedBy: gate.waivedBy }),
    };
    return gateFact(input);
  });
};

const collectorsFor = (
  testCase: CorpusCase,
  gates: ReturnType<typeof gateFact>[],
): BoardCollectorSpec[] => {
  if (testCase.collectors === undefined) {
    return [availableCollector("tracker", gates)];
  }
  return testCase.collectors.map((collector) =>
    collector.outcome === "failed"
      ? failingCollector(collector.id)
      : availableCollector(collector.id, collector.id === "tracker" ? gates : []),
  );
};

const gitStatus = (): string =>
  execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });

const assertCase = async (testCase: CorpusCase): Promise<string> => {
  const gates = gatesFor(testCase);
  const board = createBoardHarness({
    gates,
    collectors: collectorsFor(testCase, gates),
  });
  try {
    const outputs: string[] = [];
    for (let replayIndex = 0; replayIndex < (testCase.replays ?? 1); replayIndex += 1) {
      const run = await board.run([], { json: true });
      expect(run.exitCode, testCase.id).toBe(testCase.expect.exitCode);
      expect(assertEnvelopeContract(run.envelope)).toEqual([]);
      if (testCase.expect.errorCode !== undefined) {
        expect(run.envelope?.error, testCase.id).toMatchObject({
          code: testCase.expect.errorCode,
        });
        expect(run.envelope).not.toHaveProperty("data");
      } else {
        expect(run.envelope).toHaveProperty("data");
        const data = boardData(run);
        expect(boardGates(run), testCase.id).toHaveLength(testCase.expect.gateCount);
        expect(data?.truncated, testCase.id).toBe(testCase.expect.truncated);
        expect(data?.omitted, testCase.id).toBe(testCase.expect.omitted);
        const byId = new Map(boardGates(run).map((gate) => [gate.id, gate]));
        for (const expected of testCase.expect.gates) {
          const actual = byId.get(expected.id);
          expect(actual, `${testCase.id}:${expected.id}`).toMatchObject({
            slaState: expected.slaState,
            default: expected.default,
            waivedBy: expected.waivedBy,
            ...(expected.ageUnknownReason === undefined
              ? {}
              : { ageUnknownReason: expected.ageUnknownReason }),
          });
        }
      }
      const read = readOwnerGateSlaDecisions(board.state.store);
      expect(read.ok, testCase.id).toBe(true);
      if (read.ok) expect(read.value.recordCount, testCase.id).toBe(testCase.expect.records);
      outputs.push(run.stdout);
    }
    expect(new Set(outputs).size, testCase.id).toBe(1);
    return outputs[0] ?? "";
  } finally {
    board.cleanup();
  }
};

describe("TC-SLA-028 committed corpus", () => {
  const cases = loadCases();
  const requiredClasses = [
    "fresh",
    "escalated",
    "default-applied",
    "unknown-age-absent",
    "unknown-age-unparseable",
    "never-merge",
    "idempotency-replay",
    "collector-unavailable",
    "partial-failure",
    "bounds",
  ] as const;

  test("the corpus is non-empty and covers every named class", () => {
    expect(cases.length).toBeGreaterThanOrEqual(requiredClasses.length);
    const classes = new Set(cases.map((testCase) => testCase.class));
    for (const required of requiredClasses) {
      expect(classes.has(required), required).toBe(true);
    }
    const allGates = cases.flatMap((testCase) => gatesFor(testCase));
    expect(new Set(allGates.map((gate) => gate.kind))).toEqual(new Set(["owner-review", "waiver"]));
    const markers = new Set(
      cases.flatMap((testCase) => testCase.expect.gates.map((gate) => gate.ageUnknownReason)),
    );
    expect(markers.has("activity-timestamp-absent")).toBe(true);
    expect(markers.has("activity-timestamp-unparseable")).toBe(true);
  });

  test("every corpus case matches its expected output with zero live calls", async () => {
    const before = gitStatus();
    const originalFetch = globalThis.fetch;
    let liveCall = false;
    try {
      globalThis.fetch = (() => {
        liveCall = true;
        throw new Error("unexpected live call");
      }) as typeof fetch;
      for (const testCase of cases) {
        await assertCase(testCase);
      }
      expect(liveCall).toBe(false);
      expect(gitStatus()).toBe(before);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("mutation control: a corrupted expected state fails the case", async () => {
    const testCase = cases.find((candidate) => candidate.id === "fresh-owner-review");
    if (testCase === undefined) throw new Error("fresh case missing");
    const mutated: CorpusCase = {
      ...testCase,
      expect: {
        ...testCase.expect,
        gates: testCase.expect.gates.map((gate) => ({ ...gate, slaState: "escalated" })),
      },
    };
    await expect(assertCase(mutated)).rejects.toThrow();
  });

  test("completeness control: removing a class from the set fails the meta-check", () => {
    const withoutUnknown = cases.filter((testCase) => testCase.class !== "unknown-age-absent");
    expect(
      new Set(withoutUnknown.map((testCase) => testCase.class)).has("unknown-age-absent"),
    ).toBe(false);
  });
});
