/**
 * TC-SPAR-001 / TC-SPAR-003 / TC-SPAR-006 — scoped undeclared-map parity.
 *
 * Every delivered corpus case runs in JSON and human modes with no map and must
 * be byte-identical to the pre-change baseline captured at branch base
 * `8a1f77ad`. The scope manifest classifies every document state exactly once,
 * so no state is claimed as both parity and refusal.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  VERIFY_SUITE_MAP_DOCUMENT_STATES,
  type VerifySuiteMapDocumentState,
} from "../../packages/core/src/contracts/index";
import {
  resolveVerifySuiteMap,
  resolveVerifySuiteMapFromConfig,
  suiteMapReadOfDocument,
} from "../../packages/core/src/domain/index";
import { combinedRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";
import {
  DEFECTS,
  declaredRead,
  invalidRead,
  REFERENCE_JOB,
  REFERENCE_SUITES,
  validEqualityMap,
} from "../fixtures/verify-gates/suite-map/cases";
import { type CorpusCase, caseFacts } from "../fixtures/verify-gates/suite-map/parity-corpus";

const ROOT = process.cwd();
const SUITE_MAP = join(ROOT, "tests/fixtures/verify-gates/suite-map");
const CORPUS = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/verify-gates/corpus/cases.json"), "utf8"),
) as { cases: CorpusCase[] };

type BaselineEntry = {
  readonly caseId: string;
  readonly mode: "json" | "human";
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  readonly records: readonly string[];
};

type Baseline = {
  readonly provenance: {
    readonly baseSha: string;
    readonly corpusCaseCount: number;
    readonly modes: readonly string[];
    readonly captureCommand: string;
    readonly capturedAt: string;
  };
  readonly entries: readonly BaselineEntry[];
};

type ScopeState = {
  readonly id: string;
  readonly documentState: VerifySuiteMapDocumentState;
  readonly classification: "parity" | "refusal" | "resolved-equality";
  readonly baselineEntry: boolean;
};

const baseline = JSON.parse(
  readFileSync(join(SUITE_MAP, "parity-baseline.json"), "utf8"),
) as Baseline;
const scope = JSON.parse(readFileSync(join(SUITE_MAP, "parity-scope.json"), "utf8")) as {
  readonly baseline: string;
  readonly states: readonly ScopeState[];
};

const entryFor = (caseId: string, mode: "json" | "human"): BaselineEntry | undefined =>
  baseline.entries.find((entry) => entry.caseId === caseId && entry.mode === mode);

const runCase = async (entry: CorpusCase, mode: "json" | "human") => {
  const records: string[] = [];
  const runtime = combinedRuntime({
    facts: caseFacts(entry),
    appendVerification: (record) => {
      records.push(JSON.stringify(record));
      return { ok: true as const };
    },
  });
  const result = await runVerify(runtime, ["gates", "GH-178"], { json: mode === "json" });
  return { result, records };
};

const suiteFacts = () => {
  const facts = caseFacts(CORPUS.cases[0] as CorpusCase);
  return facts;
};

describe("TC-SPAR-001 the undeclared-map path is byte-identical to the baseline", () => {
  test("the baseline provenance is the pre-change capture", () => {
    expect(baseline.provenance.baseSha).toBe("8a1f77ad");
    expect(baseline.provenance.corpusCaseCount).toBe(48);
    expect(baseline.provenance.modes).toEqual(["json", "human"]);
    expect(baseline.provenance.capturedAt.length).toBeGreaterThan(0);
    expect(baseline.entries).toHaveLength(96);
  });

  test("every corpus case in both modes matches stdout, stderr, exit, and record bytes", async () => {
    const mismatches: string[] = [];
    for (const entry of CORPUS.cases) {
      for (const mode of ["json", "human"] as const) {
        const expected = entryFor(entry.id, mode);
        if (expected === undefined) {
          mismatches.push(`${entry.id}/${mode}: baseline entry missing`);
          continue;
        }
        const actual = await runCase(entry, mode);
        if (actual.result.stdout !== expected.stdout)
          mismatches.push(`${entry.id}/${mode}: stdout`);
        if (actual.result.stderr !== expected.stderr)
          mismatches.push(`${entry.id}/${mode}: stderr`);
        if (actual.result.exitCode !== expected.exitCode) {
          mismatches.push(`${entry.id}/${mode}: exit`);
        }
        if (JSON.stringify(actual.records) !== JSON.stringify(expected.records)) {
          mismatches.push(`${entry.id}/${mode}: record`);
        }
        if (actual.result.stdout.includes("suiteBreadth")) {
          mismatches.push(`${entry.id}/${mode}: breadth leaked`);
        }
        if (actual.result.stdout.includes("mirrorsJob")) {
          mismatches.push(`${entry.id}/${mode}: mirror leaked`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  test("a corpus case replays identically twice", async () => {
    const entry = CORPUS.cases[0] as CorpusCase;
    const first = await runCase(entry, "json");
    const second = await runCase(entry, "json");
    expect(second.result.stdout).toBe(first.result.stdout);
    expect(second.result.exitCode).toBe(first.result.exitCode);
  });
});

describe("TC-SPAR-006 parity is scoped and the two sets are disjoint", () => {
  test("the manifest classifies every document state and every state exactly once", () => {
    const states = scope.states.map((state) => state.documentState);
    for (const documentState of VERIFY_SUITE_MAP_DOCUMENT_STATES) {
      expect(states, documentState).toContain(documentState);
    }
    const ids = scope.states.map((state) => state.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const state of scope.states) {
      expect(["parity", "refusal", "resolved-equality"]).toContain(state.classification);
      expect(state.baselineEntry).toBe(state.classification === "parity");
    }
  });

  test("parity and refusal states are disjoint and unusable states carry no baseline entry", () => {
    const parity = scope.states.filter((state) => state.classification === "parity");
    const refusal = scope.states.filter((state) => state.classification === "refusal");
    expect(parity.length).toBeGreaterThan(0);
    expect(refusal.length).toBeGreaterThan(0);
    const parityIds = new Set(parity.map((state) => state.id));
    for (const state of refusal) expect(parityIds.has(state.id)).toBe(false);
    const corpusIds = new Set(CORPUS.cases.map((entry) => entry.id));
    for (const state of refusal) {
      expect(corpusIds.has(state.id), state.id).toBe(false);
      expect(state.baselineEntry).toBe(false);
    }
    expect(scope.baseline).toContain("parity-baseline.json");
  });

  test("the two no-selection states are the parity path and declare nothing", async () => {
    const states = [
      {
        id: "absent-document",
        read: () => suiteMapReadOfDocument({ ok: true, state: "absent" }),
      },
      {
        id: "parsed-without-node",
        read: () => resolveVerifySuiteMapFromConfig({ provider: { defaultChain: "zai" } }),
      },
    ];
    for (const state of states) {
      expect(state.read(), state.id).toEqual({ ok: true, declared: false });
      const withNoNode = await runVerify(
        combinedRuntime({ facts: suiteFacts(), suiteMap: state.read }),
        ["gates", "GH-178"],
      );
      const control = await runVerify(combinedRuntime({ facts: suiteFacts() }), [
        "gates",
        "GH-178",
      ]);
      expect(withNoNode.stdout, state.id).toBe(control.stdout);
      expect(withNoNode.exitCode, state.id).toBe(control.exitCode);
    }
  });

  test("a selection naming a missing or unreadable path is a refusal with no parity claim", async () => {
    for (const detail of ["selected-unusable", "document.unreadable"]) {
      const result = await runVerify(
        combinedRuntime({ facts: suiteFacts(), suiteMap: () => invalidRead(detail) }),
        ["gates", "GH-178"],
      );
      expect(result.exitCode).toBe(1);
      expect(result.envelope?.error?.code).toBe("config.value.invalid");
      const baselineMatches = baseline.entries.some((entry) => entry.stdout === result.stdout);
      expect(baselineMatches).toBe(false);
    }
  });

  test("the tolerance stops at the node: outside defects report, inside and parser defects refuse", async () => {
    const outside = resolveVerifySuiteMap(validEqualityMap());
    if (!outside.ok || !outside.declared) throw new Error("expected a declared map");
    const tolerated = await runVerify(
      combinedRuntime({
        facts: suiteFacts(),
        suiteMap: () => resolveVerifySuiteMap(outside.value),
      }),
      ["gates", "GH-178"],
    );
    expect(tolerated.exitCode).toBe(0);
    const data = tolerated.envelope?.data as Record<string, unknown>;
    expect(data.suiteBreadth).toEqual([...REFERENCE_SUITES]);
    expect(data.mirrorsJob).toBe("job-01");

    const inside = await runVerify(
      combinedRuntime({
        facts: suiteFacts(),
        suiteMap: () => resolveVerifySuiteMap(DEFECTS["schema-version-unsupported"]),
      }),
      ["gates", "GH-178"],
    );
    expect(inside.exitCode).toBe(1);
    expect(inside.envelope?.error?.code).toBe("config.value.invalid");

    const parser = await runVerify(
      combinedRuntime({ facts: suiteFacts(), suiteMap: () => invalidRead("document.unparseable") }),
      ["gates", "GH-178"],
    );
    expect(parser.exitCode).toBe(1);
    expect(parser.envelope?.error?.code).toBe("config.value.invalid");
    expect(REFERENCE_JOB.length).toBeGreaterThan(0);
    expect(declaredRead(validEqualityMap())).toBeTypeOf("function");
  });
});

describe("TC-SPAR-003 the CI gate is unchanged by the map", () => {
  test("the ci-green record is deep-equal with and without a declared map", async () => {
    const withoutMap = await runVerify(combinedRuntime({ facts: suiteFacts() }), [
      "gates",
      "GH-178",
    ]);
    const extraJobMap = {
      ...validEqualityMap(),
      jobs: [...validEqualityMap().jobs, { job: "not-a-workflow-job", suites: ["tests"] }],
    };
    const withMap = await runVerify(
      combinedRuntime({ facts: suiteFacts(), suiteMap: declaredRead(extraJobMap) }),
      ["gates", "GH-178"],
    );
    const ciOf = (envelope: Record<string, unknown> | undefined) => {
      const data = envelope?.data as { readonly gates?: readonly { readonly id: string }[] };
      return data.gates?.find((gate) => gate.id === "ci-green");
    };
    expect(JSON.stringify(ciOf(withMap.envelope))).toBe(JSON.stringify(ciOf(withoutMap.envelope)));
    const data = withMap.envelope?.data as { readonly gates: readonly Record<string, unknown>[] };
    expect(JSON.stringify(data.gates)).not.toContain("not-a-workflow-job");
    expect(JSON.stringify(data.gates)).not.toContain("suiteBreadth");
  });
});
