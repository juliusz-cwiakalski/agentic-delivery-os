/**
 * TC-SPEND-018 / TC-SPEND-021 / TC-SPEND-022 — the committed spend goldens
 * (healthy A-01, loop A-02, degraded, over-cap) are byte-compared and never
 * rewritten by the suite.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { computeSpendReport, renderSpendHuman } from "../../packages/core/src/domain/index";
import { readSpendLedger } from "../../packages/core/src/state/index";
import { A01, A02, type AmplificationCase } from "../fixtures/spend/cases";
import {
  makeIdentity,
  makeOutcomeRecord,
  makeSessionRecord,
  makeTempRoot,
  openStore,
  removeRoot,
  SYNTHETIC_BRAND,
  seedSpend,
  tokens,
  warning,
} from "../fixtures/spend/harness";

const ROOT = process.cwd();
const GOLDEN_DIR = join(ROOT, "tests/golden/fixtures/spend");

const golden = (name: string): string => readFileSync(join(GOLDEN_DIR, name), "utf8");

const renderCase = (testCase: AmplificationCase) => {
  const root = makeTempRoot("golden-compare");
  try {
    const identity = makeIdentity(root);
    const { store } = openStore(identity);
    seedSpend(store, testCase.seed);
    const read = readSpendLedger(store, "GH-236");
    if (!read.ok) throw new Error("read failed");
    const fold = computeSpendReport(read.value, { workItemRef: "GH-236" });
    if (!fold.ok) throw new Error("fold failed");
    return {
      machine: `${JSON.stringify(fold.data, null, 2)}\n`,
      human: renderSpendHuman(fold.data, { brand: SYNTHETIC_BRAND, amplification: true }),
    };
  } finally {
    removeRoot(root);
  }
};

const degradedCase: AmplificationCase = {
  id: "degraded",
  seed: {
    records: [
      makeSessionRecord({
        runId: "run-R1",
        tokens: tokens({ input: 100, output: 20, reasoning: null }),
        calls: 2,
        warnings: [warning("optional-field-absent")],
      }),
      makeSessionRecord({
        runId: "run-R1",
        sessionId: "ses-2",
        agent: "coder",
        model: "opus",
        tokens: tokens({ input: 40, cacheWrite: null }),
        calls: 1,
        warnings: [warning("non-numeric-value", "tokens.cacheWrite")],
      }),
    ],
    outcomes: [
      makeOutcomeRecord({
        runId: "run-R1",
        degraded: 1,
        warnings: [warning("session-capture-failed", "sessions")],
      }),
    ],
  },
  paid: 160,
  progress: 160,
  progressRun: null,
  restarts: 0,
  events: [],
};

const overCapRecords = Array.from({ length: 600 }, (_, index) =>
  makeSessionRecord({
    runId: "run-single",
    sessionId: `ses-${String(index)}`,
    agent: `agent-${"a".repeat(40)}-${String(index).padStart(5, "0")}`,
    model: `model-${"m".repeat(30)}`,
    tokens: tokens({ input: 10 }),
    calls: 1,
  }),
);

describe("spend goldens", () => {
  test("A-01 healthy renders byte-identically in both modes", () => {
    const rendered = renderCase(A01);
    expect(rendered.machine).toBe(golden("a01-healthy.machine.json"));
    expect(rendered.human).toBe(golden("a01-healthy.human.txt"));
  });

  test("A-02 loop renders byte-identically in both modes", () => {
    const rendered = renderCase(A02);
    expect(rendered.machine).toBe(golden("a02-loop.machine.json"));
    expect(rendered.human).toBe(golden("a02-loop.human.txt"));
  });

  test("the degraded fixture renders byte-identically in both modes", () => {
    const rendered = renderCase(degradedCase);
    expect(rendered.machine).toBe(golden("degraded.machine.json"));
    expect(rendered.human).toBe(golden("degraded.human.txt"));
    expect(rendered.human).toContain("session-capture-failed=1");
  });

  test("the over-cap human golden is truncated, bounded and declared", () => {
    const fold = computeSpendReport({
      workItemRef: "GH-236",
      records: overCapRecords,
      outcomes: [],
      transitions: [],
      transitionsPresent: false,
      verifiedEmpty: false,
      evidence: { storePath: "fixture://ledger", recordCount: overCapRecords.length },
    });
    if (!fold.ok) throw new Error("fold failed");
    // The human renderer states the machine truncation the fold declared, then
    // drops its own tail under the human bounds (NFR-2).
    const human = renderSpendHuman(fold.data, {
      brand: SYNTHETIC_BRAND,
      amplification: true,
      ...(fold.truncation === undefined ? {} : { truncation: fold.truncation }),
    });
    expect(human).toBe(golden("over-cap.human.txt"));
    expect(human).toContain("truncated");
    expect(human.split("\n").filter((line) => line !== "").length).toBeLessThanOrEqual(200);
    expect(Buffer.byteLength(human, "utf8")).toBeLessThanOrEqual(16_384);
  });

  test("the suite never rewrites a golden", () => {
    const names = ["a01-healthy.human.txt", "a02-loop.machine.json", "over-cap.human.txt"];
    const before = names.map((name) => statSync(join(GOLDEN_DIR, name)).mtimeMs);
    renderCase(A01);
    renderCase(A02);
    const after = names.map((name) => statSync(join(GOLDEN_DIR, name)).mtimeMs);
    expect(after).toEqual(before);
  });
});
