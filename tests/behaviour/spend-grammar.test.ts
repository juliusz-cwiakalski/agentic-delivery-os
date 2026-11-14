/**
 * TC-SPEND-025 — the locked grammar: the declared flag set, undeclared flags at
 * the shared parser, positionals and missing values in the handler, and the
 * render-free/exit-free handler contract.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSpendCommandDefinition } from "../../packages/cli/src/commands/spend";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { SPEND_FLAGS } from "../../packages/core/src/contracts/index";
import {
  countCalls,
  makeIdentity,
  makeSessionRecord,
  makeTempRoot,
  openStore,
  recordingStore,
  removeRoot,
  runSpendCli,
  SPEND_REF,
  seedSpend,
  spendRuntimeOver,
  tokens,
} from "../fixtures/spend/harness";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const codeOf = (stdout: string): string | undefined => {
  const value = JSON.parse(stdout) as unknown;
  if (!isRecord(value) || !isRecord(value.error)) return undefined;
  return typeof value.error.code === "string" ? value.error.code : undefined;
};

const seeded = (label: string) => {
  const root = makeTempRoot(`gh236-grammar-${label}`);
  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  seedSpend(store, {
    records: [makeSessionRecord({ runId: "run-R1", tokens: tokens({ input: 10 }) })],
  });
  return { root, store };
};

describe("TC-SPEND-025 locked grammar", () => {
  test("the declared flag set keeps the v1 grammar and adds --breakdown and the window-evidence flags", () => {
    // The delivered v1 grammar is a prefix; GH-291 adds --breakdown (F-5);
    // GH-294 adds the window-evidence flags (F-6, DM-5).
    expect([...SPEND_FLAGS]).toEqual([
      "--ref",
      "--phase",
      "--amplification",
      "--breakdown",
      "--window-evidence",
      "--from",
      "--through",
    ]);
    const root = makeTempRoot("gh236-grammar-def");
    try {
      const definition = createSpendCommandDefinition(
        spendRuntimeOver(openStore(makeIdentity(root)).store),
      );
      expect(definition.flags).toEqual([
        "--ref",
        "--phase",
        "--amplification",
        "--breakdown",
        "--window-evidence",
        "--from",
        "--through",
      ]);
      expect(definition.flags).not.toContain("--help");
      expect(definition.positionals).toEqual({ max: 8 });
      expect(definition.requiresValue).toBeUndefined();
    } finally {
      removeRoot(root);
    }
  });

  test("an undeclared flag classifies fallback.invocation at the shared parser with zero reads", async () => {
    const { root, store } = seeded("bogus");
    try {
      const log: string[] = [];
      const run = await runSpendCli(
        ["--json", "spend", "--ref", SPEND_REF, "--bogus"],
        spendRuntimeOver(recordingStore(store, log)),
      );
      expect(run.exitCode).toBe(1);
      expect(codeOf(run.stdout)).toBe("fallback.invocation");
      expect(log).toEqual([]);
    } finally {
      removeRoot(root);
    }
  });

  test("an unexpected positional is input.value.rejected with zero reads", async () => {
    const { root, store } = seeded("positional");
    try {
      const log: string[] = [];
      const run = await runSpendCli(
        ["--json", "spend", "--ref", SPEND_REF, "extra"],
        spendRuntimeOver(recordingStore(store, log)),
      );
      expect(run.exitCode).toBe(1);
      expect(codeOf(run.stdout)).toBe("input.value.rejected");
      expect(log).toEqual([]);
    } finally {
      removeRoot(root);
    }
  });

  test("missing flag values are input.value.rejected with zero reads", async () => {
    const { root, store } = seeded("missing-value");
    try {
      for (const argv of [
        ["--json", "spend", "--ref"],
        ["--json", "spend", "--ref", SPEND_REF, "--phase"],
      ]) {
        const log: string[] = [];
        const run = await runSpendCli(argv, spendRuntimeOver(recordingStore(store, log)));
        expect(run.exitCode, argv.join(" ")).toBe(1);
        expect(codeOf(run.stdout)).toBe("input.value.rejected");
        expect(log).toEqual([]);
      }
    } finally {
      removeRoot(root);
    }
  });

  test("the handler performs no stream write and chooses no exit code", () => {
    const source = readFileSync(join(process.cwd(), "packages/cli/src/commands/spend.ts"), "utf8");
    expect(source).not.toContain(".write(");
    expect(source).not.toContain("exitCode");
    expect(source).not.toContain("process.exit");
  });

  test("the composition is opt-in: a program without spend contains the command", async () => {
    const stdout = bufferSink();
    const stderr = bufferSink();
    const deps: CliDependencies = {
      brand: SYNTHETIC_BRAND,
      clock: { now: () => 0 },
      newRunId: () => "run-opt-in",
      secrets: [],
      program: { commands: {} },
    };
    const exitCode = await runCli(
      ["--json", "spend", "--ref", SPEND_REF],
      { stdout, stderr },
      deps,
    );
    expect(exitCode).toBe(1);
    expect(codeOf(stdout.value)).toBe("fallback.invocation");
  });

  test("--json is a global flag the handler never inspects", () => {
    const source = readFileSync(join(process.cwd(), "packages/cli/src/commands/spend.ts"), "utf8");
    expect(source).not.toContain('"--json"');
  });

  test("a read-only invocation performs exactly the bounded read set", async () => {
    const { root, store } = seeded("reads");
    try {
      const log: string[] = [];
      const run = await runSpendCli(
        ["spend", "--ref", SPEND_REF],
        spendRuntimeOver(recordingStore(store, log)),
      );
      expect(run.exitCode).toBe(0);
      expect(countCalls(log, "readRecords")).toBeGreaterThan(0);
      expect(countCalls(log, "readRecords")).toBeLessThanOrEqual(4);
      expect(countCalls(log, "acquireFence")).toBe(0);
    } finally {
      removeRoot(root);
    }
  });
});
