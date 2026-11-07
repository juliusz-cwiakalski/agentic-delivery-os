/**
 * TC-SPEND-020 — the envelope data shape, the mode emphasis flag, and the
 * inherited rendering contract: `--json` forces the envelope, `--amplification`
 * changes only the human digest, and the machine block is always present.
 */
import { describe, expect, test } from "bun:test";
import {
  SPEND_AMPLIFICATION_KEYS,
  SPEND_DATA_SCHEMA_ID,
} from "../../packages/core/src/contracts/index";
import { A01, A04 } from "../fixtures/spend/cases";
import {
  foldSeed,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  runSpendCli,
  SPEND_REF,
  seedSpend,
  spendRuntimeOver,
} from "../fixtures/spend/harness";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parse = (text: string): Record<string, unknown> => {
  const value = JSON.parse(text) as unknown;
  if (!isRecord(value)) throw new Error("output is not an envelope");
  return value;
};

const withCase = async (
  testCase: typeof A01,
  body: (runtime: ReturnType<typeof spendRuntimeOver>) => Promise<void>,
): Promise<void> => {
  const root = makeTempRoot(`gh236-envelope-${testCase.id}`);
  try {
    const identity = makeIdentity(root);
    const { store } = openStore(identity);
    seedSpend(store, testCase.seed);
    await body(spendRuntimeOver(store));
  } finally {
    removeRoot(root);
  }
};

describe("TC-SPEND-020 envelope and mode emphasis", () => {
  test("human mode renders the digest and --json forces the envelope", async () => {
    await withCase(A01, async (runtime) => {
      const human = await runSpendCli(["spend", "--ref", SPEND_REF], runtime);
      expect(human.exitCode).toBe(0);
      expect(human.stdout.startsWith("spend")).toBe(true);
      expect(human.stdout.trimStart().startsWith("{")).toBe(false);

      const machine = await runSpendCli(["--json", "spend", "--ref", SPEND_REF], runtime);
      expect(machine.exitCode).toBe(0);
      const envelope = parse(machine.stdout);
      expect(envelope.schemaVersion).toBe("delivery.result.v1");
      expect(Object.hasOwn(envelope, "data")).toBe(true);
      expect(Object.hasOwn(envelope, "error")).toBe(false);
      const data = envelope.data;
      if (!isRecord(data)) throw new Error("data is not an object");
      expect(Object.keys(data).sort()).toEqual([
        "amplification",
        "degradation",
        "perAgent",
        "perPhase",
        "restarts",
        "tokensByClass",
      ]);
      expect(JSON.stringify(data)).not.toContain(SPEND_DATA_SCHEMA_ID);
      const amplification = data.amplification;
      if (!isRecord(amplification)) throw new Error("amplification missing");
      expect(Object.keys(amplification).sort()).toEqual([...SPEND_AMPLIFICATION_KEYS].sort());
      expect(amplification.progressRun).toBeNull();
    });
  });

  test("--amplification changes only the human digest, never the envelope", async () => {
    await withCase(A01, async (runtime) => {
      const plainHuman = await runSpendCli(["spend", "--ref", SPEND_REF], runtime);
      const amplifiedHuman = await runSpendCli(
        ["spend", "--ref", SPEND_REF, "--amplification"],
        runtime,
      );
      expect(amplifiedHuman.stdout).not.toBe(plainHuman.stdout);
      expect(amplifiedHuman.stdout).toContain("ratio      1");
      expect(plainHuman.stdout).not.toContain("ratio      1");

      const plainMachine = await runSpendCli(["--json", "spend", "--ref", SPEND_REF], runtime);
      const amplifiedMachine = await runSpendCli(
        ["--json", "spend", "--ref", SPEND_REF, "--amplification"],
        runtime,
      );
      expect(JSON.parse(amplifiedMachine.stdout)).toEqual(JSON.parse(plainMachine.stdout));
    });
  });

  test("scripted mode renders exactly one line and interactive mode the full envelope", async () => {
    await withCase(A01, async (runtime) => {
      const scripted = await runSpendCli(["--json", "spend", "--ref", SPEND_REF], runtime, {
        mode: "scripted",
      });
      expect(scripted.stdout.trimEnd().split("\n")).toHaveLength(1);
      const line = parse(scripted.stdout);
      expect(Object.keys(line)).toEqual(["data"]);
      const interactive = await runSpendCli(["--json", "spend", "--ref", SPEND_REF], runtime);
      expect(parse(interactive.stdout).schemaVersion).toBe("delivery.result.v1");
    });
  });

  test("a zero-progress fixture survives --json with a named progress run", async () => {
    await withCase(A04, async (runtime) => {
      const machine = await runSpendCli(["--json", "spend", "--ref", SPEND_REF], runtime);
      const envelope = parse(machine.stdout);
      const data = envelope.data;
      if (!isRecord(data) || !isRecord(data.amplification)) throw new Error("data missing");
      expect(data.amplification.ratio).toBeNull();
      expect(data.amplification.progressRun).toBe("run-R2");
    });
  });

  test("a failure renders an error-only envelope with the classified code", async () => {
    const root = makeTempRoot("gh236-envelope-failure");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const runtime = spendRuntimeOver(store);
      const machine = await runSpendCli(["--json", "spend", "--ref", SPEND_REF], runtime);
      expect(machine.exitCode).toBe(1);
      const envelope = parse(machine.stdout);
      expect(Object.hasOwn(envelope, "data")).toBe(false);
      const error = envelope.error;
      if (!isRecord(error)) throw new Error("error missing");
      expect(error.code).toBe("spend.telemetry-absent");
      expect(error.category).toBe("user");
      expect(error.consequence).toBe("not_landed");
    } finally {
      removeRoot(root);
    }
  });

  test("the fold fixtures used by the CLI are the same seeds the engine uses", () => {
    const { fold, root } = foldSeed(A01.seed, "envelope-seed-control");
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      expect(fold.data.tokensByClass.input).toBe(123);
    } finally {
      removeRoot(root);
    }
  });
});
