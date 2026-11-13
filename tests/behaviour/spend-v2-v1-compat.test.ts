/**
 * TC-TELEMETRY-017 — v1 additive compatibility (DEC-6): the delivered six-key
 * `delivery.spend.v1` payload keeps its names and semantics, the schema
 * identity is unchanged, and every v2 addition sits beside them under `data`.
 */
import { afterEach, describe, expect, test } from "bun:test";
import {
  SPEND_DATA_KEYS,
  SPEND_DATA_SCHEMA_ID,
  SPEND_FLAGS,
  SPEND_HUMAN_AMPLIFICATION_FLAG,
  SPEND_V2_DATA_KEYS,
  type SpendReport,
} from "../../packages/core/src/contracts/index";
import { createSpendCommandDefinition } from "../../packages/cli/src/commands/spend";
import { runSpendCli, spendRuntimeOver } from "../fixtures/spend/harness";
import {
  foldTelemetryStore,
  makeStepRecord,
  makeV1Record,
  removeRoot,
  TELEMETRY_REF,
  tokens,
} from "../fixtures/telemetry";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const V1_KEYS = [
  "tokensByClass",
  "perPhase",
  "perAgent",
  "restarts",
  "amplification",
  "degradation",
] as const;

const folded = (seed: Parameters<typeof foldTelemetryStore>[0], label: string) => {
  const seeded = foldTelemetryStore(seed, label);
  roots.push(seeded.root);
  if (seeded.fold === undefined || !seeded.fold.ok) throw new Error("fold failed");
  return seeded;
};

describe("TC-TELEMETRY-017 v1 additive compatibility", () => {
  test("the six v1 keys keep their exact names and declared order", () => {
    expect(SPEND_DATA_KEYS).toEqual([...V1_KEYS]);
    expect(SPEND_DATA_SCHEMA_ID).toBe("delivery.spend.v1");
  });

  test("a v1-only store renders the six keys with unchanged semantics", () => {
    const seeded = folded(
      {
        v1: [
          makeV1Record({
            sessionId: "ses_v1",
            agent: "planner",
            model: "sonnet",
            tokens: tokens({ input: 10, output: 5 }),
            calls: 2,
          }),
        ],
      },
      "compat-v1-only",
    );
    const report = seeded.fold as { ok: true; data: SpendReport };
    expect(report.data.tokensByClass).toEqual({
      input: 10,
      output: 5,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
    });
    expect(report.data.perAgent).toEqual([
      { agent: "planner", model: "sonnet", calls: 2, tokens: 15 },
    ]);
    expect(report.data.perPhase[0]?.phase).toBe("unknown");
    expect(report.data.restarts).toBe(0);
    expect(report.data.amplification.ratio).toBe(1);
    expect(Object.keys(report.data.amplification).sort()).toEqual([
      "events",
      "progressRun",
      "ratio",
    ]);
    for (const key of V1_KEYS) {
      expect(Object.hasOwn(report.data, key), key).toBe(true);
    }
  });

  test("the v2 additions appear strictly beside the six keys", () => {
    const seeded = folded(
      { steps: [makeStepRecord({ tokens: tokens({ input: 1 }) })] },
      "compat-v2",
    );
    const report = seeded.fold as { ok: true; data: SpendReport };
    for (const key of SPEND_V2_DATA_KEYS) {
      expect(Object.hasOwn(report.data, key), key).toBe(true);
    }
    const keys = Object.keys(report.data).sort();
    expect(keys).toEqual([...V1_KEYS, ...SPEND_V2_DATA_KEYS].sort());
    // No v1 key was renamed or shadowed by a v2 key.
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(11);
  });

  test("the delivered v1 grammar stays declared and unchanged", () => {
    expect([...SPEND_FLAGS].slice(0, 3)).toEqual([
      "--ref",
      "--phase",
      SPEND_HUMAN_AMPLIFICATION_FLAG,
    ]);
    const definition = createSpendCommandDefinition(
      spendRuntimeOver(foldTelemetryStore({}, "compat-grammar").store),
    );
    expect(definition.positionals).toEqual({ max: 8 });
    expect(definition.flags).toContain("--ref");
    expect(definition.flags).toContain("--phase");
    expect(definition.flags).toContain(SPEND_HUMAN_AMPLIFICATION_FLAG);
  });

  test("the CLI renders a v1-only store and a v2 store through the same command", async () => {
    for (const [label, seed] of [
      [
        "compat-cli-v1",
        { v1: [makeV1Record({ sessionId: "ses_cli_v1", tokens: tokens({ input: 3 }) })] },
      ],
      [
        "compat-cli-v2",
        { steps: [makeStepRecord({ sessionId: "ses_cli_v2", tokens: tokens({ input: 4 }) })] },
      ],
    ] as const) {
      const seeded = foldTelemetryStore(seed, label);
      roots.push(seeded.root);
      const run = await runSpendCli(
        ["--json", "spend", "--ref", TELEMETRY_REF],
        spendRuntimeOver(seeded.store),
      );
      expect(run.exitCode, label).toBe(0);
      const envelope = JSON.parse(run.stdout) as {
        readonly data?: Record<string, unknown>;
      };
      expect(Object.keys(envelope.data ?? {}).sort()).toEqual(
        [...V1_KEYS, ...SPEND_V2_DATA_KEYS].sort(),
      );
    }
    expect(TELEMETRY_REF).toBe("GH-291");
  });
});
