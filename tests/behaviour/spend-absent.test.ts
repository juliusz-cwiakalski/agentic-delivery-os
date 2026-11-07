/**
 * TC-SPEND-007 — telemetry-absent is a first-class classified outcome: named,
 * scoped, exit 1, with capture-prerequisite remediation, and never an empty
 * success, a zero report, or an unclassified error.
 */
import { describe, expect, test } from "bun:test";
import { A05 } from "../fixtures/spend/cases";
import {
  makeIdentity,
  makeOutcomeRecord,
  makeSessionRecord,
  makeTempRoot,
  OTHER_REF,
  openStore,
  removeRoot,
  runSpendCli,
  SPEND_REF,
  seedSpend,
  spendRuntimeOver,
  tokens,
} from "../fixtures/spend/harness";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parse = (text: string): Record<string, unknown> => {
  const value = JSON.parse(text) as unknown;
  if (!isRecord(value)) throw new Error("output is not an envelope");
  return value;
};

const emptyStore = () => {
  const root = makeTempRoot("gh236-absent");
  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  return { root, store };
};

describe("TC-SPEND-007 telemetry-absent", () => {
  test("a verified-empty store is the classified absence at exit 1", async () => {
    const { root, store } = emptyStore();
    try {
      const machine = await runSpendCli(
        ["--json", "spend", "--ref", SPEND_REF],
        spendRuntimeOver(store),
      );
      expect(machine.exitCode).toBe(1);
      const envelope = parse(machine.stdout);
      expect(Object.hasOwn(envelope, "data")).toBe(false);
      const error = envelope.error;
      if (!isRecord(error)) throw new Error("error missing");
      expect(error.code).toBe("spend.telemetry-absent");
      expect(error.category).toBe("user");
      expect(error.retryable).toBe(false);
      expect(error.consequence).toBe("not_landed");
      expect(error.remediationHint).toContain("Capture harness telemetry");
      expect(String(error.summary)).toContain(SPEND_REF);
    } finally {
      removeRoot(root);
    }
  });

  test("absent per-ref records beside other refs classify and never leak a cross-ref total", async () => {
    const { root, store } = emptyStore();
    try {
      seedSpend(store, {
        records: [
          makeSessionRecord({
            ref: OTHER_REF,
            runId: "run-other",
            tokens: tokens({ input: 999 }),
          }),
        ],
      });
      const machine = await runSpendCli(
        ["--json", "spend", "--ref", SPEND_REF],
        spendRuntimeOver(store),
      );
      expect(machine.exitCode).toBe(1);
      const envelope = parse(machine.stdout);
      const error = envelope.error;
      if (!isRecord(error)) throw new Error("error missing");
      expect(error.code).toBe("spend.telemetry-absent");
      expect(JSON.stringify(envelope)).not.toContain("999");
    } finally {
      removeRoot(root);
    }
  });

  test("the summary names the phase when the selection is filtered", async () => {
    const { root, store } = emptyStore();
    try {
      const machine = await runSpendCli(
        ["--json", "spend", "--ref", SPEND_REF, "--phase", "quality_gates"],
        spendRuntimeOver(store),
      );
      expect(machine.exitCode).toBe(1);
      const envelope = parse(machine.stdout);
      const error = envelope.error;
      if (!isRecord(error)) throw new Error("error missing");
      expect(String(error.summary)).toContain("phase quality_gates");
    } finally {
      removeRoot(root);
    }
  });

  test("the human channel prints a diagnostic and the scripted channel one line", async () => {
    const { root, store } = emptyStore();
    try {
      const human = await runSpendCli(["spend", "--ref", SPEND_REF], spendRuntimeOver(store));
      expect(human.exitCode).toBe(1);
      expect(human.stdout).toContain("spend: no captured harness telemetry");
      expect(human.stderr).toContain("spend.telemetry-absent");
      const scripted = await runSpendCli(
        ["--json", "spend", "--ref", SPEND_REF],
        spendRuntimeOver(store),
        {
          mode: "scripted",
        },
      );
      expect(scripted.stdout.trimEnd().split("\n")).toHaveLength(1);
      const line = parse(scripted.stdout);
      expect(Object.keys(line).sort()).toEqual(["error", "runId"]);
    } finally {
      removeRoot(root);
    }
  });

  test("the positive control renders a report, so absence is not a blanket refusal", async () => {
    const { root, store } = emptyStore();
    try {
      seedSpend(store, {
        records: [makeSessionRecord({ runId: "run-R1", tokens: tokens({ input: 10 }) })],
        outcomes: [makeOutcomeRecord({ runId: "run-R1" })],
      });
      const machine = await runSpendCli(
        ["--json", "spend", "--ref", SPEND_REF],
        spendRuntimeOver(store),
      );
      expect(machine.exitCode).toBe(0);
      expect(Object.hasOwn(parse(machine.stdout), "data")).toBe(true);
    } finally {
      removeRoot(root);
    }
  });

  test("a records-exist all-zero fold is a success report, never absence", async () => {
    const { root, store } = emptyStore();
    try {
      seedSpend(store, A05.seed);
      const machine = await runSpendCli(
        ["--json", "spend", "--ref", SPEND_REF],
        spendRuntimeOver(store),
      );
      expect(machine.exitCode).toBe(0);
      const envelope = parse(machine.stdout);
      expect(Object.hasOwn(envelope, "error")).toBe(false);
      const data = envelope.data;
      if (!isRecord(data) || !isRecord(data.amplification)) throw new Error("data missing");
      expect(data.amplification.ratio).toBeNull();
      expect(data.amplification.progressRun).toBe("run-R2");
    } finally {
      removeRoot(root);
    }
  });
});
