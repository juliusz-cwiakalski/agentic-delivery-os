/**
 * The GH-388 pre-change golden capture entry (test plan §6 binding procedure).
 *
 * A fixture module, never a `*.test.ts` suite: run it explicitly, at the
 * change's branch point, to capture the outcome-matrix cells that lack a
 * committed golden (every corpus fail/unavailable class, the narrowed-scope
 * refusal, the configuration refusals, the member cell) plus the
 * production-composition success cell. The committed goldens (success data,
 * machine envelope, human report, failure summary) are the pre-change oracle
 * for the pure-fixture world and are never touched by this entry.
 *
 * Semantics: with the golden files absent the entry captures and writes them;
 * with the files present it re-runs every cell and verifies byte identity,
 * exiting non-zero on any drift. It writes only the two files it owns
 * (`matrix-cells.json`, `production-success.json`) — never a blanket rewrite
 * of the golden directory.
 *
 * Run: TMPDIR=$PWD/tmp/tmpdir bun tests/fixtures/verify-gates/golden/matrix-golden-run.ts
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { VerifyGatesCommandRuntime } from "../../../../packages/cli/src/commands/verify-gates";
import {
  appendMergeGateVerification,
  readMergeGateVerifications,
} from "../../../../packages/core/src/state/index";
import { API_MEMBER, WEB_MEMBER } from "../../cross-repository/constants";
import {
  declaredMember,
  greenMemberReads,
  landingObservation,
  memberGatesRuntime,
  reviewObservation,
} from "../../cross-repository/facts";
import { makeAuditStore, removeRoot } from "../../state/harness";
import { combinedRuntime, runVerify } from "../cases/harness";
import { createNoNetworkGuard } from "../cases/network-guard";
import {
  createVerifyGatesProductionHarness,
  normalizeProductionBytes,
  VG_PROD_REF,
} from "../production-composition";
import { declaredRead, invalidRead, narrowedJob01Map, narrowedMap } from "../suite-map/cases";
import { type CorpusCase, caseFacts } from "../suite-map/parity-corpus";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/verify-gates/golden");
const MATRIX_FILE = join(GOLDEN, "matrix-cells.json");
const PRODUCTION_FILE = join(GOLDEN, "production-success.json");

const CORPUS = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/verify-gates/corpus/cases.json"), "utf8"),
) as { cases: CorpusCase[] };

type CapturedRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

type CapturedCell = {
  readonly json: CapturedRun;
  readonly human: CapturedRun;
};

type MatrixGolden = {
  readonly provenance: {
    readonly baseSha: string;
    readonly captureCommand: string;
    readonly capturedAt: string;
    readonly corpusCaseCount: number;
    readonly modes: readonly string[];
  };
  readonly cells: Readonly<Record<string, CapturedCell>>;
};

type ProductionGolden = {
  readonly provenance: {
    readonly baseSha: string;
    readonly captureCommand: string;
    readonly capturedAt: string;
    readonly normalization: readonly string[];
  };
  readonly machine: CapturedRun;
  readonly human: CapturedRun;
};

const baseSha = (): string => {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("the capture entry requires a git checkout");
  return result.stdout.trim();
};

/** The real fenced append over the capture store (the delivered append contract). */
const realAppendOf =
  (
    store: ReturnType<typeof makeAuditStore>["store"],
  ): VerifyGatesCommandRuntime["appendVerification"] =>
  (record) => {
    const appended = appendMergeGateVerification(store, {
      record,
      fenceToken: "matrix-golden-capture",
    });
    return appended.ok ? { ok: true } : { ok: false, code: appended.error.code };
  };

/** Run one pure-world cell in both modes with the real append wired. */
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

const captureMatrix = async (): Promise<MatrixGolden> => {
  const fixture = makeAuditStore("vg-golden-matrix");
  const appended = readMergeGateVerifications(fixture.store, "capture-probe");
  if (!appended.ok) throw new Error("the capture store did not open");
  const append = realAppendOf(fixture.store);
  const cells: Record<string, CapturedCell> = {};
  try {
    for (const entry of CORPUS.cases) {
      // The handler-level bytes are the captured artifact (the delivered
      // parity baseline pins the same cells' handler bytes); the corpus
      // manifest's expectedExit is evaluator-level and is not re-derived here.
      cells[`corpus:${entry.id}`] = await runCell(
        combinedRuntime({ facts: caseFacts(entry), appendVerification: append }),
        "GH-178",
      );
    }
    cells["narrowed-scope"] = await runCell(
      combinedRuntime({
        suiteMap: declaredRead(narrowedJob01Map()),
        appendVerification: append,
      }),
      "GH-178",
    );
    cells["suite-map-unmirrored"] = await runCell(
      combinedRuntime({
        suiteMap: declaredRead(narrowedMap()),
        appendVerification: append,
      }),
      "GH-178",
    );
    cells["config-suite-map-invalid"] = await runCell(
      combinedRuntime({
        suiteMap: () => invalidRead("matrix capture"),
        appendVerification: append,
      }),
      "GH-178",
    );
    cells["config-gate-set-invalid"] = await runCell(
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
    const memberRuntime = memberGatesRuntime(world);
    const memberGates = memberRuntime.gates;
    if (memberGates === undefined) throw new Error("member runtime is missing the gates member");
    cells["member-green"] = await runCell(
      { ...memberRuntime, gates: { ...memberGates, appendVerification: append } },
      "GH-310",
    );
    for (const [id, cell] of Object.entries(cells)) {
      const declared =
        id === "narrowed-scope" ||
        id === "suite-map-unmirrored" ||
        id === "config-suite-map-invalid" ||
        id === "config-gate-set-invalid"
          ? 1
          : undefined;
      if (declared !== undefined && cell.json.exitCode !== declared) {
        throw new Error(`cell ${id} exited ${String(cell.json.exitCode)}, expected ${declared}`);
      }
    }
    if (cells["member-green"]?.json.exitCode !== 0) {
      throw new Error("the member cell must pass");
    }
  } finally {
    removeRoot(fixture.root);
  }
  return {
    provenance: {
      baseSha: baseSha(),
      captureCommand:
        "TMPDIR=$PWD/tmp/tmpdir bun tests/fixtures/verify-gates/golden/matrix-golden-run.ts",
      capturedAt: new Date().toISOString(),
      corpusCaseCount: CORPUS.cases.length,
      modes: ["json", "human"],
    },
    cells,
  };
};

const captureProduction = async (): Promise<ProductionGolden> => {
  const guard = createNoNetworkGuard();
  const harness = createVerifyGatesProductionHarness({ label: "gh388-golden-capture" });
  try {
    const json = await harness.run(["--json", "verify", "gates", VG_PROD_REF]);
    const human = await harness.run(["verify", "gates", VG_PROD_REF]);
    if (json.exitCode !== 0) {
      throw new Error(`the production cell refused: ${json.stderr}`);
    }
    if (human.exitCode !== 0) {
      throw new Error(`the production human cell refused: ${human.stderr}`);
    }
    const identity = {
      headSha: harness.headSha,
      checkout: harness.checkout,
      hostRoot: harness.host.hostRoot,
    };
    const normalize = (run: CapturedRun): CapturedRun => ({
      exitCode: run.exitCode,
      stdout: normalizeProductionBytes(run.stdout, identity),
      stderr: normalizeProductionBytes(run.stderr, identity),
    });
    return {
      provenance: {
        baseSha: baseSha(),
        captureCommand:
          "TMPDIR=$PWD/tmp/tmpdir bun tests/fixtures/verify-gates/golden/matrix-golden-run.ts",
        capturedAt: new Date().toISOString(),
        normalization: [
          "the checkout head SHA (full and 7-char forms) -> <head-sha>/<head-sha-7>",
          "the fixture checkout and host paths -> <checkout>/<host-root>",
          'the envelope duration member -> "totalMs":0',
        ],
      },
      machine: normalize({
        exitCode: json.exitCode,
        stdout: json.stdout,
        stderr: json.stderr,
      }),
      human: normalize({
        exitCode: human.exitCode,
        stdout: human.stdout,
        stderr: human.stderr,
      }),
    };
  } finally {
    guard.restore();
    harness.dispose();
  }
};

const writeGolden = (path: string, value: unknown): void => {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const run = async (): Promise<number> => {
  const matrixExists = existsSync(MATRIX_FILE);
  const productionExists = existsSync(PRODUCTION_FILE);
  if (matrixExists !== productionExists) {
    console.error(
      "the capture pair is half-present; delete both files and recapture at the branch point",
    );
    return 2;
  }
  if (!matrixExists) {
    const matrix = await captureMatrix();
    const production = await captureProduction();
    writeGolden(MATRIX_FILE, matrix);
    writeGolden(PRODUCTION_FILE, production);
    console.log(
      `captured ${Object.keys(matrix.cells).length} matrix cells and the production success cell at ${matrix.provenance.baseSha}`,
    );
    return 0;
  }
  const committedMatrix = JSON.parse(readFileSync(MATRIX_FILE, "utf8")) as MatrixGolden;
  const committedProduction = JSON.parse(readFileSync(PRODUCTION_FILE, "utf8")) as ProductionGolden;
  const freshMatrix = await captureMatrix();
  const freshProduction = await captureProduction();
  const drift: string[] = [];
  for (const [id, cell] of Object.entries(freshMatrix.cells)) {
    const committed = committedMatrix.cells[id];
    if (committed === undefined) {
      drift.push(`${id}: cell missing from the committed goldens`);
      continue;
    }
    if (JSON.stringify(cell) !== JSON.stringify(committed)) drift.push(`${id}: bytes drifted`);
  }
  for (const id of Object.keys(committedMatrix.cells)) {
    if (freshMatrix.cells[id] === undefined) drift.push(`${id}: cell no longer captured`);
  }
  const runKeys = ["machine", "human"] as const;
  for (const key of runKeys) {
    if (JSON.stringify(freshProduction[key]) !== JSON.stringify(committedProduction[key])) {
      drift.push(`production ${key}: bytes drifted`);
    }
  }
  if (drift.length > 0) {
    console.error(`golden drift at ${baseSha()}:`);
    for (const line of drift) console.error(`  - ${line}`);
    return 1;
  }
  console.log(
    `verified ${Object.keys(freshMatrix.cells).length} matrix cells and the production success cell: byte-identical`,
  );
  return 0;
};

const exitCode = await run();
process.exit(exitCode);
