/**
 * TC-TELEMETRY-038 — mutant sensitivity of every honesty rule (GH-291).
 *
 * Ten disabling mutants must each produce their prohibited observable on an
 * unchanged fixture, while the real module produces none. Mutant copies live in
 * temp files beside their module and are removed in teardown; nothing in the
 * live tree is modified.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { SpendLedgerRead } from "../../packages/core/src/contracts/index";
import { computeSpendReport } from "../../packages/core/src/domain/spend";
import { decodeTelemetryStepFrame } from "../../packages/core/src/domain/telemetry-ingest";
import { completeTokenFrame, omittedClassFrame } from "../fixtures/harness/scenarios/stream";
import { frameContext, tokens } from "../fixtures/telemetry";

const ROOT = process.cwd();

const withMutant = async (
  relative: string,
  id: string,
  replacements: readonly (readonly [string, string])[],
  body: (module: Record<string, unknown>) => Promise<void> | void,
): Promise<void> => {
  const absolute = join(ROOT, relative);
  let source = readFileSync(absolute, "utf8");
  for (const [from, to] of replacements) {
    if (!source.includes(from)) throw new Error(`${id}: mutant anchor missing: ${from}`);
    source = source.replace(from, to);
  }
  const temp = join(dirname(absolute), `.mutant-telemetry-${id}.ts`);
  writeFileSync(temp, source);
  try {
    const module = (await import(`${pathToFileURL(temp).href}`)) as Record<string, unknown>;
    await body(module);
  } finally {
    rmSync(temp, { force: true });
  }
};

const callable = (
  module: Record<string, unknown>,
  name: string,
): ((...args: unknown[]) => unknown) => {
  const value = module[name];
  if (typeof value !== "function") throw new Error(`${name} is not a function export`);
  return (...args) => value(...args);
};

const decodeOf = (module: Record<string, unknown>, line: string) =>
  callable(module, "decodeTelemetryStepFrame")(JSON.parse(line), frameContext()) as {
    readonly kind: string;
    readonly record?: {
      readonly tokens: Record<string, number | null>;
      readonly warnings: readonly { readonly field: string }[];
    };
  };

const readOf = (overrides: Partial<SpendLedgerRead> = {}): SpendLedgerRead => ({
  workItemRef: "GH-291",
  records: [],
  outcomes: [],
  transitions: [],
  transitionsPresent: false,
  verifiedEmpty: false,
  evidence: { storePath: "fixture://ledger", recordCount: 0 },
  ...overrides,
});

const foldOf = (module: Record<string, unknown>, read: SpendLedgerRead) => {
  const outcome = callable(module, "computeSpendReport")(read, { workItemRef: "GH-291" }) as {
    readonly ok: boolean;
    readonly data?: Record<string, unknown>;
  };
  return outcome;
};

describe("TC-TELEMETRY-038 mutant meta-suite", () => {
  test("fabricate-class-to-zero turns an omitted class into a fabricated zero", async () => {
    const real = decodeOf({ decodeTelemetryStepFrame }, omittedClassFrame("ses_mutant"));
    expect(real.record?.tokens.reasoning).toBeNull();
    await withMutant(
      "packages/core/src/domain/telemetry-ingest.ts",
      "m01",
      [
        [
          `    if (source === undefined || !Object.hasOwn(source, tokenClass)) {
      warnings.push({
        reason: "optional-field-absent",
        field: \`\${TELEMETRY_FRAME_TOKENS_FIELD}.\${tokenClass}\`,
      });
      tokens[tokenClass] = null;`,
          `    if (source === undefined || !Object.hasOwn(source, tokenClass)) {
      warnings.push({
        reason: "optional-field-absent",
        field: \`\${TELEMETRY_FRAME_TOKENS_FIELD}.\${tokenClass}\`,
      });
      tokens[tokenClass] = 0;`,
        ],
      ],
      (module) => {
        const mutated = decodeOf(module, omittedClassFrame("ses_mutant"));
        expect(mutated.record?.tokens.reasoning).toBe(0);
      },
    );
  });

  test("sum-null-as-zero fabricates a cost total from missing cost", async () => {
    const read = readOf({
      steps: [
        {
          schemaId: "delivery.harness.telemetry.step.v1",
          storageVersion: "delivery.telemetry.storage.v1",
          workItemRef: "GH-291",
          runId: "run-1",
          sessionId: "ses_1",
          harnessKind: "opencode",
          harnessVersion: null,
          treeRoot: null,
          model: "model-alpha",
          ticket: "GH-291",
          repository: null,
          lane: null,
          agentRole: "coder",
          tokens: tokens({ input: 10 }),
          calls: 1,
          cost: null,
          startedAt: null,
          finishedAt: null,
          warnings: [],
          capturedAt: "2026-11-12T08:00:00.000Z",
        },
      ],
    });
    const real = foldOf({ computeSpendReport }, read);
    const realCost = (real.data?.costTotals as { total: number | null } | undefined)?.total;
    expect(realCost).toBeNull();
    await withMutant(
      "packages/core/src/domain/spend.ts",
      "m02",
      [
        [
          `  return { total: priced === 0 ? null : total, models: modelList, sparse };`,
          `  return { total, models: modelList, sparse };`,
        ],
      ],
      (module) => {
        const mutated = foldOf(module, read);
        const cost = (mutated.data?.costTotals as { total: number | null } | undefined)?.total;
        expect(cost).toBe(0);
      },
    );
  });

  test("default-attribution guesses an unattributable dimension", async () => {
    const real = decodeOf({ decodeTelemetryStepFrame }, completeTokenFrame("ses_mutant"));
    expect(real.record).toBeDefined();
    const realDecoded = decodeTelemetryStepFrame(JSON.parse(completeTokenFrame("ses_mutant")), {
      ...frameContext(),
      claimed: { agentRole: null, lane: null },
    });
    if (realDecoded.kind !== "captured") throw new Error("decode failed");
    expect(realDecoded.record.lane).toBeNull();
    await withMutant(
      "packages/core/src/domain/telemetry-attribution.ts",
      "m03",
      [
        [
          `  const normalized = attributedValue(value);
  if (normalized === null) warnings.push({ reason: "unattributable-step", field });
  return normalized;`,
          `  const normalized = attributedValue(value);
  if (normalized === null) warnings.push({ reason: "unattributable-step", field });
  return normalized ?? "unknown";`,
        ],
      ],
      (module) => {
        const attribute = callable(module, "attributeStep");
        const attribution = attribute({
          workItemRef: "GH-291",
          runId: "run-1",
          sessionId: "ses_1",
          repository: null,
          model: null,
          claimed: { agentRole: null, lane: null },
        }) as { readonly lane: string | null; readonly model: string | null };
        expect(attribution.lane).toBe("unknown");
        expect(attribution.model).toBe("unknown");
      },
    );
  });

  test("re-estimate-timing synthesizes a duration for an open phase", () => {
    const read = readOf({
      steps: [
        {
          schemaId: "delivery.harness.telemetry.step.v1",
          storageVersion: "delivery.telemetry.storage.v1",
          workItemRef: "GH-291",
          runId: "run-1",
          sessionId: "ses_1",
          harnessKind: "opencode",
          harnessVersion: null,
          treeRoot: null,
          model: "model-alpha",
          ticket: "GH-291",
          repository: null,
          lane: null,
          agentRole: "coder",
          tokens: tokens({ input: 1 }),
          calls: 1,
          cost: null,
          startedAt: null,
          finishedAt: null,
          warnings: [],
          capturedAt: "2026-11-12T08:10:00.000Z",
        },
      ],
      transitions: [
        {
          changeRef: "GH-291",
          phaseId: "specification",
          operation: "complete",
          timestamp: "2026-11-12T08:00:00.000Z",
          outcome: "landed",
        },
      ],
    });
    const real = foldOf({ computeSpendReport }, read);
    const realTiming = real.data?.phaseTiming as readonly { durationMs: number | null }[];
    expect(realTiming[0]?.durationMs).toBeNull();
    return withMutant(
      "packages/core/src/domain/spend.ts",
      "m04",
      [
        [
          `      durationMs: end === null ? null : Math.max(0, Date.parse(end) - Date.parse(start)),`,
          `      durationMs: end === null ? 0 : Math.max(0, Date.parse(end) - Date.parse(start)),`,
        ],
      ],
      (module) => {
        const mutated = foldOf(module, read);
        const timing = mutated.data?.phaseTiming as readonly { durationMs: number | null }[];
        expect(timing[0]?.durationMs).toBe(0);
      },
    );
  });

  test("drop-on-migrate loses a record on the version read", async () => {
    const { makeTelemetryStore, makeStepRecord, removeRoot, seedSteps } = await import(
      "../fixtures/telemetry"
    );
    const { readTelemetryStepsAtVersion } = await import("../../packages/core/src/state/index");
    const fixture = makeTelemetryStore("mutant-migrate");
    try {
      seedSteps(fixture.store, [
        makeStepRecord({ sessionId: "ses_1" }),
        makeStepRecord({ sessionId: "ses_2" }),
      ]);
      const real = readTelemetryStepsAtVersion(
        fixture.store,
        "GH-291",
        "delivery.telemetry.storage.v1",
      );
      expect(real.ok && real.value.records.length).toBe(2);
      await withMutant(
        "packages/core/src/state/telemetry.ts",
        "m05",
        [
          [
            `  return ok({
    records: read.value.records.map((record) => telemetryStepAtVersion(record, version)),`,
            `  return ok({
    records: read.value.records.slice(0, -1).map((record) => telemetryStepAtVersion(record, version)),`,
          ],
        ],
        (module) => {
          const read = callable(module, "readTelemetryStepsAtVersion") as (...args: unknown[]) => {
            readonly ok: boolean;
            readonly value?: { readonly records: readonly unknown[] };
          };
          const mutated = read(fixture.store, "GH-291", "delivery.telemetry.storage.v1");
          expect(mutated.ok).toBe(true);
          expect(mutated.value?.records.length).toBe(1);
        },
      );
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("v1-key-break renames a delivered six-key entry", async () => {
    await withMutant(
      "packages/core/src/contracts/spend.ts",
      "m06",
      [
        [
          `export const SPEND_DATA_KEYS = [
  "tokensByClass",`,
          `export const SPEND_DATA_KEYS = [
  "tokens",`,
        ],
      ],
      (module) => {
        expect(module.SPEND_DATA_KEYS).toContain("tokens");
        expect(module.SPEND_DATA_KEYS).not.toContain("tokensByClass");
      },
    );
  });

  test("clamp-outside-to-within hides a deviation beyond tolerance", async () => {
    const step = {
      schemaId: "delivery.harness.telemetry.step.v1",
      storageVersion: "delivery.telemetry.storage.v1",
      workItemRef: "GH-291",
      runId: "run-1",
      sessionId: "ses_1",
      harnessKind: "opencode",
      harnessVersion: null,
      treeRoot: null,
      model: "model-alpha",
      ticket: "GH-291",
      repository: null,
      lane: null,
      agentRole: "coder",
      tokens: tokens({ input: 140 }),
      calls: 1,
      cost: null,
      startedAt: null,
      finishedAt: null,
      warnings: [],
      capturedAt: "2026-11-12T08:00:00.000Z",
    } as const;
    const read = readOf({
      steps: [step],
      baselines: [
        {
          schemaId: "delivery.harness.telemetry.baseline.v1",
          storageVersion: "delivery.telemetry.storage.v1",
          workItemRef: "GH-291",
          runId: "run-1",
          sessionId: "ses_1",
          tokens: tokens({ input: 100 }),
          calls: 1,
          cost: null,
          capturedAt: "2026-11-12T08:00:00.000Z",
          warnings: [],
        },
      ],
    });
    const real = foldOf({ computeSpendReport }, read);
    const realReconciliation = real.data?.reconciliation as { verdict: string } | undefined;
    expect(realReconciliation?.verdict).toBe("outside");
    await withMutant(
      "packages/core/src/domain/spend.ts",
      "m07",
      [
        [
          `        ? TELEMETRY_VERDICT_WITHIN
        : TELEMETRY_VERDICT_OUTSIDE;`,
          `        ? TELEMETRY_VERDICT_WITHIN
        : TELEMETRY_VERDICT_WITHIN;`,
        ],
      ],
      (module) => {
        const mutated = foldOf(module, read);
        const reconciliation = mutated.data?.reconciliation as { verdict: string } | undefined;
        expect(reconciliation?.verdict).toBe("within");
      },
    );
  });

  test("omit-reconciliation drops the line from the human summary", async () => {
    const read = readOf({
      steps: [
        {
          schemaId: "delivery.harness.telemetry.step.v1",
          storageVersion: "delivery.telemetry.storage.v1",
          workItemRef: "GH-291",
          runId: "run-1",
          sessionId: "ses_1",
          harnessKind: "opencode",
          harnessVersion: null,
          treeRoot: null,
          model: "model-alpha",
          ticket: "GH-291",
          repository: null,
          lane: null,
          agentRole: "coder",
          tokens: tokens({ input: 1 }),
          calls: 1,
          cost: null,
          startedAt: null,
          finishedAt: null,
          warnings: [],
          capturedAt: "2026-11-12T08:00:00.000Z",
        },
      ],
    });
    const folded = computeSpendReport(read, { workItemRef: "GH-291" });
    if (!folded.ok) throw new Error("fold failed");
    const { renderSpendHuman } = await import("../../packages/core/src/domain/spend-text");
    const real = renderSpendHuman(folded.data, {
      brand: { binaryName: "x" } as never,
      amplification: false,
    });
    expect(real).toContain("reconcile");
    await withMutant(
      "packages/core/src/domain/spend-text.ts",
      "m08",
      [[`    reconciliationLine(report),`, `    "reconcile  withheld",`]],
      async (module) => {
        const render = callable(module, "renderSpendHuman") as (...args: unknown[]) => string;
        const mutated = render(folded.data, {
          brand: { binaryName: "x" },
          amplification: false,
        });
        expect(mutated).not.toContain("tolerance");
      },
    );
  });

  test("absent-to-zeros renders a zero report for an absent selection", async () => {
    const read = readOf({});
    const real = foldOf({ computeSpendReport }, read);
    expect(real.ok).toBe(false);
    await withMutant(
      "packages/core/src/domain/spend.ts",
      "m09",
      [
        [
          `  if (steps.length === 0 && read.records.length === 0 && read.outcomes.length === 0) {
    return { ok: false, absence: absenceFor(selection) };
  }`,
          `  if (steps.length === 0 && read.records.length === 0 && read.outcomes.length === 0) {
    // mutant: fall through and render zeros
  }`,
        ],
      ],
      (module) => {
        const mutated = foldOf(module, read);
        expect(mutated.ok).toBe(true);
        const totals = mutated.data?.tokensByClass as { input: number } | undefined;
        expect(totals?.input).toBe(0);
      },
    );
  });

  test("truncate-totals destroys the totals when the bound cuts a tail", () => {
    const many = Array.from({ length: 600 }, (_, index) => ({
      schemaId: "delivery.harness.telemetry.step.v1" as const,
      storageVersion: "delivery.telemetry.storage.v1" as const,
      workItemRef: "GH-291",
      runId: `run-${String(index)}`,
      sessionId: `ses-${String(index)}`,
      harnessKind: "opencode" as const,
      harnessVersion: null,
      treeRoot: null,
      model: `model-${"m".repeat(30)}-${String(index)}`,
      ticket: "GH-291",
      repository: null,
      lane: null,
      agentRole: `agent-${"a".repeat(40)}-${String(index)}`,
      tokens: tokens({ input: 10 }),
      calls: 1,
      cost: 0.01,
      startedAt: null,
      finishedAt: null,
      warnings: [],
      capturedAt: "2026-11-12T08:00:00.000Z",
    }));
    const read = readOf({ steps: many });
    const real = foldOf({ computeSpendReport }, read);
    const realTotals = real.data?.tokensByClass as { input: number } | undefined;
    expect(realTotals?.input).toBe(6000);
    return withMutant(
      "packages/core/src/domain/spend.ts",
      "m10",
      [
        [
          `    ...report,
    perAgent: agentRows,`,
          `    ...report,
    tokensByClass: { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
    perAgent: agentRows,`,
        ],
      ],
      (module) => {
        const mutated = foldOf(module, read);
        const totals = mutated.data?.tokensByClass as { input: number } | undefined;
        expect(totals?.input).toBe(0);
      },
    );
  });
});
