/** TC-VGATES-044/045/052/063 — committed goldens and replay equality. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendMergeGateVerification,
  readMergeGateVerifications,
} from "../../packages/core/src/state/index";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { API_MEMBER, WEB_MEMBER } from "../fixtures/cross-repository/constants";
import {
  declaredMember,
  greenMemberReads,
  landingObservation,
  memberGatesRuntime,
  reviewObservation,
} from "../fixtures/cross-repository/facts";
import { makeAuditStore, removeRoot } from "../fixtures/state/harness";
import { baseFacts, clone, EXPECTED_JOBS, run } from "../fixtures/verify-gates/cases/facts";
import { combinedRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";
import {
  declaredRead,
  invalidRead,
  narrowedJob01Map,
  narrowedMap,
} from "../fixtures/verify-gates/suite-map/cases";
import { type CorpusCase, caseFacts } from "../fixtures/verify-gates/suite-map/parity-corpus";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/verify-gates/golden");
const MATRIX_FILE = join(GOLDEN, "matrix-cells.json");

type CapturedRun = { readonly exitCode: number; readonly stdout: string; readonly stderr: string };
type CapturedCell = { readonly json: CapturedRun; readonly human: CapturedRun };
type MatrixGoldenFile = {
  readonly cells: Readonly<Record<string, CapturedCell>>;
};
const MATRIX = JSON.parse(readFileSync(MATRIX_FILE, "utf8")) as MatrixGoldenFile;
const CORPUS = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/verify-gates/corpus/cases.json"), "utf8"),
) as { cases: CorpusCase[] };

const redFacts = () => {
  const facts = clone(baseFacts());
  facts.checkRuns = {
    ok: true,
    value: {
      items: EXPECTED_JOBS.map((name) =>
        run(name, name === EXPECTED_JOBS[0] ? "failed" : "succeeded"),
      ),
      pageItemCount: 23,
    },
  };
  return facts;
};

describe("TC-VGATES-044/045 golden success data and envelope", () => {
  test("the machine envelope is valid and matches the committed data golden", async () => {
    const result = await runVerify(combinedRuntime(), ["gates", "GH-178"]);
    expect(assertEnvelopeContract(result.envelope)).toEqual([]);
    const golden = JSON.parse(readFileSync(join(GOLDEN, "success-data.json"), "utf8")) as unknown;
    expect(result.envelope?.data).toEqual(golden);
    expect(JSON.stringify(result.envelope?.data).length).toBeLessThanOrEqual(65536);
  });

  test("the human report matches the committed golden exactly", async () => {
    const result = await runVerify(combinedRuntime(), ["gates", "GH-178"], { json: false });
    expect(result.stdout).toBe(readFileSync(join(GOLDEN, "human-success.txt"), "utf8"));
  });
});

describe("TC-VGATES-042/052 failure summary golden and replay", () => {
  test("the failure summary matches the committed golden", async () => {
    const result = await runVerify(combinedRuntime({ facts: redFacts() }), ["gates", "GH-178"]);
    const summary = (result.envelope?.error as { summary?: string } | undefined)?.summary ?? "";
    expect(`${summary}\n`).toBe(readFileSync(join(GOLDEN, "failure-summary.txt"), "utf8"));
  });

  test("replaying the same facts is byte-identical", async () => {
    const first = await runVerify(combinedRuntime(), ["gates", "GH-178"]);
    const second = await runVerify(combinedRuntime(), ["gates", "GH-178"]);
    expect(second.stdout).toBe(first.stdout);
    expect(second.stderr).toBe(first.stderr);
    expect(second.exitCode).toBe(first.exitCode);
  });

  test("TC-VGATES-063 verify change human output matches the pre-change golden", async () => {
    const result = await runVerify(combinedRuntime(), ["change", "GH-178"], { json: false });
    expect(result.stdout).toBe(readFileSync(join(GOLDEN, "verify-change-human.txt"), "utf8"));
  });
});

describe("TC-VGATES-073 the outcome matrix is byte-identical with the real append wired", () => {
  /** The delivered real append over one fixture store (the TC-VGATES-073 precondition). */
  const realAppendOver =
    (store: ReturnType<typeof makeAuditStore>["store"]) =>
    (
      record: Parameters<typeof appendMergeGateVerification>[1]["record"],
    ):
      | {
          readonly ok: true;
        }
      | {
          readonly ok: false;
          readonly code: string;
        } => {
      const appended = appendMergeGateVerification(store, {
        record,
        fenceToken: "vg-golden-verify",
      });
      return appended.ok ? { ok: true } : { ok: false, code: appended.error.code };
    };

  const runCell = async (
    runtime: Parameters<typeof runVerify>[0],
    ref: string,
  ): Promise<CapturedCell> => {
    const json = await runVerify(runtime, ["gates", ref], { json: true });
    const human = await runVerify(runtime, ["gates", ref], { json: false });
    return {
      json: { exitCode: json.exitCode, stdout: json.stdout, stderr: json.stderr },
      human: { exitCode: human.exitCode, stdout: human.stdout, stderr: human.stderr },
    };
  };

  /** Rebuild one captured cell exactly as the capture entry constructed it. */
  const rebuildCell = async (id: string): Promise<CapturedCell> => {
    const fixture = makeAuditStore("vg-golden-verify");
    try {
      const append = realAppendOver(fixture.store);
      if (id.startsWith("corpus:")) {
        const entry = CORPUS.cases.find((candidate) => `corpus:${candidate.id}` === id);
        if (entry === undefined) throw new Error(`no corpus case for ${id}`);
        return await runCell(
          combinedRuntime({ facts: caseFacts(entry), appendVerification: append }),
          "GH-178",
        );
      }
      switch (id) {
        case "narrowed-scope":
          return await runCell(
            combinedRuntime({
              suiteMap: declaredRead(narrowedJob01Map()),
              appendVerification: append,
            }),
            "GH-178",
          );
        case "suite-map-unmirrored":
          return await runCell(
            combinedRuntime({ suiteMap: declaredRead(narrowedMap()), appendVerification: append }),
            "GH-178",
          );
        case "config-suite-map-invalid":
          return await runCell(
            combinedRuntime({
              suiteMap: () => invalidRead("matrix capture"),
              appendVerification: append,
            }),
            "GH-178",
          );
        case "config-gate-set-invalid":
          return await runCell(
            combinedRuntime({
              gateSet: () => ({
                ok: false as const,
                code: "config.value.invalid",
                detail: "matrix capture gate-set failure",
              }),
              appendVerification: append,
            }),
            "GH-178",
          );
        case "member-green": {
          const world = {
            members: [
              declaredMember(API_MEMBER, { gates: ["ci-green", "push-parity", "owner-gate"] }),
              declaredMember(WEB_MEMBER, { gates: ["ci-green", "push-parity"] }),
            ],
            reads: {
              [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
              [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER),
            },
            landings: [
              landingObservation(API_MEMBER, false),
              landingObservation(WEB_MEMBER, false),
            ],
            reviews: [
              reviewObservation(API_MEMBER, ["pass"]),
              reviewObservation(WEB_MEMBER, ["pass"]),
            ],
          };
          const runtime = memberGatesRuntime(world);
          const gates = runtime.gates;
          if (gates === undefined) throw new Error("member runtime is missing the gates member");
          return await runCell(
            { ...runtime, gates: { ...gates, appendVerification: append } },
            "GH-310",
          );
        }
        default:
          throw new Error(`unknown captured cell ${id}`);
      }
    } finally {
      removeRoot(fixture.root);
    }
  };

  test("every captured matrix cell reproduces byte-identical output in both modes", async () => {
    // A 0-byte delta is the acceptance bar: any difference is a defect in the
    // change, never a golden-update trigger (DEC-3, NFR-2; no regeneration).
    const drift: string[] = [];
    for (const [id, cell] of Object.entries(MATRIX.cells)) {
      const fresh = await rebuildCell(id);
      if (JSON.stringify(fresh.json) !== JSON.stringify(cell.json)) drift.push(`${id}/json`);
      if (JSON.stringify(fresh.human) !== JSON.stringify(cell.human)) drift.push(`${id}/human`);
    }
    expect(drift).toEqual([]);
  });

  test("the committed success and failure goldens hold with the append wired", async () => {
    const fixture = makeAuditStore("vg-golden-committed");
    try {
      const append = realAppendOver(fixture.store);
      const pass = await runVerify(combinedRuntime({ appendVerification: append }), [
        "gates",
        "GH-178",
      ]);
      expect(pass.exitCode).toBe(0);
      const golden = JSON.parse(readFileSync(join(GOLDEN, "success-data.json"), "utf8")) as unknown;
      expect(pass.envelope?.data).toEqual(golden);
      const human = await runVerify(
        combinedRuntime({ appendVerification: append }),
        ["gates", "GH-178"],
        {
          json: false,
        },
      );
      expect(human.stdout).toBe(readFileSync(join(GOLDEN, "human-success.txt"), "utf8"));
      const redFacts = () => {
        const facts = clone(baseFacts());
        facts.checkRuns = {
          ok: true,
          value: {
            items: EXPECTED_JOBS.map((name, index) =>
              run(name, index === 0 ? "failed" : "succeeded"),
            ),
            pageItemCount: 23,
          },
        };
        return facts;
      };
      const fail = await runVerify(
        combinedRuntime({ facts: redFacts(), appendVerification: append }),
        ["gates", "GH-178"],
      );
      const summary = (fail.envelope?.error as { summary?: string } | undefined)?.summary ?? "";
      expect(`${summary}\n`).toBe(readFileSync(join(GOLDEN, "failure-summary.txt"), "utf8"));
      // The append ran for every non-refused evaluation in this test: one
      // record per verify-gates invocation (three runs on this store).
      const records = readMergeGateVerifications(fixture.store, "GH-178");
      expect(records.ok && records.records).toHaveLength(3);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("the member cell's envelope data equals the committed member-form golden", async () => {
    const fixture = makeAuditStore("vg-golden-member");
    try {
      const append = realAppendOver(fixture.store);
      const world = {
        members: [
          declaredMember(API_MEMBER, { gates: ["ci-green", "push-parity", "owner-gate"] }),
          declaredMember(WEB_MEMBER, { gates: ["ci-green", "push-parity"] }),
        ],
        reads: {
          [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
          [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER),
        },
        landings: [landingObservation(API_MEMBER, false), landingObservation(WEB_MEMBER, false)],
        reviews: [reviewObservation(API_MEMBER, ["pass"]), reviewObservation(WEB_MEMBER, ["pass"])],
      };
      const runtime = memberGatesRuntime(world);
      const gates = runtime.gates;
      if (gates === undefined) throw new Error("member runtime is missing the gates member");
      const run = await runVerify({ ...runtime, gates: { ...gates, appendVerification: append } }, [
        "gates",
        "GH-310",
      ]);
      expect(run.exitCode).toBe(0);
      const memberGolden = JSON.parse(
        readFileSync(
          join(ROOT, "tests/fixtures/cross-repository/goldens/gates-members-green.json"),
          "utf8",
        ),
      ) as unknown;
      const envelope = run.envelope as { readonly data: unknown } | undefined;
      expect(envelope?.data).toEqual(memberGolden);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("replay byte-equality holds on the pass and fail cells with the append wired", async () => {
    const first = makeAuditStore("vg-golden-replay-a");
    const second = makeAuditStore("vg-golden-replay-b");
    try {
      const runPass = (store: ReturnType<typeof makeAuditStore>["store"]) =>
        runVerify(
          combinedRuntime({ appendVerification: realAppendOver(store) }),
          ["gates", "GH-178"],
          { json: true },
        );
      const passA = await runPass(first.store);
      const passB = await runPass(second.store);
      expect(passB.stdout).toBe(passA.stdout);
      expect(passB.exitCode).toBe(passA.exitCode);
      const redFacts = () => {
        const facts = clone(baseFacts());
        facts.checkRuns = {
          ok: true,
          value: {
            items: EXPECTED_JOBS.map((name, index) =>
              run(name, index === 0 ? "failed" : "succeeded"),
            ),
            pageItemCount: 23,
          },
        };
        return facts;
      };
      const runFail = (store: ReturnType<typeof makeAuditStore>["store"]) =>
        runVerify(
          combinedRuntime({ facts: redFacts(), appendVerification: realAppendOver(store) }),
          ["gates", "GH-178"],
          { json: true },
        );
      const failA = await runFail(first.store);
      const failB = await runFail(second.store);
      expect(failB.stdout).toBe(failA.stdout);
      expect(failB.exitCode).toBe(failA.exitCode);
    } finally {
      removeRoot(first.root);
      removeRoot(second.root);
    }
  });
});
