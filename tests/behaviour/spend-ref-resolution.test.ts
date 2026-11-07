/**
 * TC-SPEND-026 — ref resolution: explicit values win, the omitted flag resolves
 * the active change context, and every unresolvable case refuses before any read.
 */
import { describe, expect, test } from "bun:test";
import { createSpendCommandRuntime } from "../../packages/cli/src/edge";
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parse = (text: string): Record<string, unknown> => {
  const value = JSON.parse(text) as unknown;
  if (!isRecord(value)) throw new Error("output is not an envelope");
  return value;
};

const codeOf = (stdout: string): string | undefined => {
  const envelope = parse(stdout);
  if (!isRecord(envelope.error)) return undefined;
  return typeof envelope.error.code === "string" ? envelope.error.code : undefined;
};

const seeded = (label: string) => {
  const root = makeTempRoot(`gh236-ref-${label}`);
  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  seedSpend(store, {
    records: [makeSessionRecord({ runId: "run-R1", tokens: tokens({ input: 100 }), calls: 1 })],
  });
  return { root, store };
};

describe("TC-SPEND-026 ref resolution", () => {
  test("an explicit ref wins and the default resolves the same active context", async () => {
    const { root, store } = seeded("default");
    try {
      const explicit = await runSpendCli(
        ["--json", "spend", "--ref", SPEND_REF],
        spendRuntimeOver(store),
      );
      const fallback = await runSpendCli(["--json", "spend"], spendRuntimeOver(store, SPEND_REF));
      expect(explicit.exitCode).toBe(0);
      expect(fallback.exitCode).toBe(0);
      expect(parse(fallback.stdout).data).toEqual(parse(explicit.stdout).data);
    } finally {
      removeRoot(root);
    }
  });

  test("an unresolvable active context refuses before any state read", async () => {
    const { root, store } = seeded("missing-context");
    try {
      const log: string[] = [];
      const run = await runSpendCli(
        ["--json", "spend"],
        spendRuntimeOver(recordingStore(store, log), null),
      );
      expect(run.exitCode).toBe(1);
      expect(codeOf(run.stdout)).toBe("input.value.rejected");
      expect(log).toEqual([]);
      const envelope = parse(run.stdout);
      const error = envelope.error;
      if (!isRecord(error)) throw new Error("error missing");
      expect(String(error.summary)).toContain("no active change context");
    } finally {
      removeRoot(root);
    }
  });

  test("lowercase, padded and non-hyphen ref shapes are rejected case-sensitively", async () => {
    const { root, store } = seeded("shapes");
    try {
      for (const value of ["gh-236", "GH236", `${SPEND_REF} `, "236", ""]) {
        const log: string[] = [];
        const run = await runSpendCli(
          ["--json", "spend", "--ref", value],
          spendRuntimeOver(recordingStore(store, log)),
        );
        expect(run.exitCode, value).toBe(1);
        expect(codeOf(run.stdout), value).toBe("input.value.rejected");
        expect(log, value).toEqual([]);
        expect(countCalls(log, "readRecords")).toBe(0);
      }
    } finally {
      removeRoot(root);
    }
  });

  test("a malformed local context is a refusal, never a silent fall-through", async () => {
    const root = makeTempRoot("gh236-ref-malformed");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const malformed = {
        path: "/pm-context.yaml",
        fs: {
          exists: () => true,
          readText: () => "active_change: [not-a-mapping\nparked_changes: []\n",
        },
      };
      const log: string[] = [];
      const wrapped = recordingStore(store, log);
      const runtime = createSpendCommandRuntime({ store: wrapped, localContext: malformed });
      const run = await runSpendCli(["--json", "spend"], runtime);
      expect(run.exitCode).toBe(1);
      expect(codeOf(run.stdout)).toBe("input.value.rejected");
      expect(log).toEqual([]);
    } finally {
      removeRoot(root);
    }
  });

  test("the resolved ref appears in the absent summary so the selection is visible", async () => {
    const root = makeTempRoot("gh236-ref-absent");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const run = await runSpendCli(["--json", "spend"], spendRuntimeOver(store, SPEND_REF));
      expect(run.exitCode).toBe(1);
      const envelope = parse(run.stdout);
      const error = envelope.error;
      if (!isRecord(error)) throw new Error("error missing");
      expect(String(error.summary)).toContain(SPEND_REF);
    } finally {
      removeRoot(root);
    }
  });
});
