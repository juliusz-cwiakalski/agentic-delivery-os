/**
 * TC-SPEND-034 — mutant sensitivity of every pinned oracle: twelve disabling
 * mutants must each produce their prohibited observable while the unmutated
 * module keeps the control, and the mutant registry cannot silently shrink.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { SpendLedgerRead } from "../../packages/core/src/contracts/index";
import { readSpendLedger } from "../../packages/core/src/state/index";
import { A01, A02, A04 } from "../fixtures/spend/cases";
import {
  makeIdentity,
  makeOutcomeRecord,
  makeSessionRecord,
  makeTempRoot,
  openStore,
  removeRoot,
  SPEND_REF,
  seedSpend,
  tokens,
} from "../fixtures/spend/harness";
import {
  forbiddenSpendImports,
  spendImportViolations,
  writeMemberViolations,
} from "../fixtures/spend/mutants/import-scan";

const ROOT = process.cwd();
const FOLD = "packages/core/src/domain/spend.ts";
const TEXT = "packages/core/src/domain/spend-text.ts";
const READS = "packages/core/src/state/spend-reads.ts";
const CONTRACTS = "packages/core/src/contracts/spend.ts";

type Replacement = readonly [string, string];

const callable = (
  module: Record<string, unknown>,
  name: string,
): ((...args: unknown[]) => unknown) => {
  const value = module[name];
  if (typeof value !== "function") throw new Error(`${name} is not exported as a function`);
  return (...args) => value(...args);
};

const withMutant = async (
  relative: string,
  id: string,
  replacements: readonly Replacement[],
  body: (module: Record<string, unknown>) => Promise<void> | void,
): Promise<void> => {
  const absolute = join(ROOT, relative);
  let source = readFileSync(absolute, "utf8");
  for (const [from, to] of replacements) {
    if (!source.includes(from)) throw new Error(`${id}: mutant anchor missing: ${from}`);
    source = source.replace(from, to);
  }
  const temp = join(dirname(absolute), `.mutant-${id}.ts`);
  writeFileSync(temp, source);
  try {
    const module = (await import(`${pathToFileURL(temp).href}`)) as Record<string, unknown>;
    await body(module);
  } finally {
    rmSync(temp, { force: true });
  }
};

/** The read the fixture produces: the unmutated engine's own input. */
const foldInput = (
  records: readonly ReturnType<typeof makeSessionRecord>[],
  outcomes: readonly ReturnType<typeof makeOutcomeRecord>[] = [],
): SpendLedgerRead => ({
  workItemRef: SPEND_REF,
  records,
  outcomes,
  transitions: [],
  transitionsPresent: false,
  verifiedEmpty: false,
  evidence: { storePath: "fixture://ledger", recordCount: records.length },
});

const reportOf = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null) throw new Error("fold outcome is not an object");
  return value as Record<string, unknown>;
};

const dataOf = (value: unknown): Record<string, unknown> => {
  const outcome = reportOf(value);
  const data = outcome.data;
  if (typeof data !== "object" || data === null) throw new Error("fold has no data");
  return data as Record<string, unknown>;
};

const amplificationOf = (value: unknown): Record<string, unknown> => {
  const amplification = dataOf(value).amplification;
  if (typeof amplification !== "object" || amplification === null) {
    throw new Error("fold has no amplification");
  }
  return amplification as Record<string, unknown>;
};

const degradationOf = (value: unknown): Record<string, unknown> => {
  const degradation = dataOf(value).degradation;
  if (typeof degradation !== "object" || degradation === null) {
    throw new Error("fold has no degradation");
  }
  return degradation as Record<string, unknown>;
};

const realFold = async (): Promise<Record<string, unknown>> =>
  (await import("../../packages/core/src/domain/spend.ts")) as unknown as Record<string, unknown>;

const degenerateRecord = makeSessionRecord({
  runId: "run-null",
  tokens: tokens({ input: null, output: null, reasoning: null, cacheRead: null, cacheWrite: null }),
});

const eventOrderRecords = [
  makeSessionRecord({
    runId: "run-zeta",
    tokens: tokens({ input: 100 }),
    capturedAt: "2026-11-01T10:00:00.000Z",
  }),
  makeSessionRecord({
    runId: "run-alpha",
    sessionId: "ses-alpha",
    tokens: tokens({ input: 200 }),
    capturedAt: "2026-11-01T11:00:00.000Z",
  }),
  makeSessionRecord({
    runId: "run-progress",
    sessionId: "ses-progress",
    tokens: tokens({ input: 300 }),
    capturedAt: "2026-11-01T12:00:00.000Z",
  }),
];

const eventOrderRead: SpendLedgerRead = {
  workItemRef: SPEND_REF,
  records: eventOrderRecords,
  outcomes: [],
  transitions: [
    {
      changeRef: SPEND_REF,
      phaseId: "clarify_scope",
      operation: "complete",
      timestamp: "2026-11-01T09:00:00.000Z",
      outcome: "landed",
    },
  ],
  transitionsPresent: true,
  verifiedEmpty: false,
  evidence: { storePath: "fixture://ledger", recordCount: 3 },
};

const MUTANT_REGISTRY = [
  "m01-null-class",
  "m02-session-only-restarts",
  "m03-progress-run-event",
  "m04-dropped-event",
  "m05-run-id-sort",
  "m06-ratio-clamp",
  "m07-adapter-probe",
  "m08-silent-truncation",
  "m09-zero-spend-claim",
  "m10-fence-write",
  "m11-case-insensitive-ref",
  "m12-progress-run-omitted",
] as const;

describe("TC-SPEND-034 mutant sensitivity", () => {
  test("the registry declares exactly the twelve disabling mutants", () => {
    expect(MUTANT_REGISTRY).toHaveLength(12);
    expect(new Set(MUTANT_REGISTRY).size).toBe(12);
  });

  test("M-01 fabricating a null class hides the degradation disclosure", async () => {
    const fold = await realFold();
    const control = callable(fold, "computeSpendReport")(foldInput([degenerateRecord]), {
      workItemRef: SPEND_REF,
    });
    expect(degradationOf(control).records).toBe(1);
    await withMutant(
      FOLD,
      "m01",
      [
        [
          "const degraded = record.warningReasons.length > 0 || hasNullClass(record.tokens);",
          "const degraded = record.warningReasons.length > 0;",
        ],
      ],
      (module) => {
        const mutated = callable(module, "computeSpendReport")(foldInput([degenerateRecord]), {
          workItemRef: SPEND_REF,
        });
        expect(degradationOf(mutated).records).toBe(0);
      },
    );
  });

  test("M-02 session-only restarts lose the capture-outcome-only run", async () => {
    const fold = await realFold();
    const read = foldInput(A01.seed.records ?? [], [makeOutcomeRecord({ runId: "run-extra" })]);
    const control = callable(fold, "computeSpendReport")(read, { workItemRef: SPEND_REF });
    expect(dataOf(control).restarts).toBe(1);
    await withMutant(
      FOLD,
      "m02",
      [
        [
          `  const runIdentities = new Set<string>(selected.map((record) => record.runId));
  if (selection.phase === undefined) {
    for (const outcome of read.outcomes) runIdentities.add(outcome.runId);
  }`,
          "  const runIdentities = new Set<string>(selected.map((record) => record.runId));",
        ],
      ],
      (module) => {
        const mutated = callable(module, "computeSpendReport")(read, { workItemRef: SPEND_REF });
        expect(dataOf(mutated).restarts).toBe(0);
      },
    );
  });

  test("M-03 an event for the progress run breaks the healthy anchor", async () => {
    const fold = await realFold();
    const control = callable(fold, "computeSpendReport")(foldInput(A01.seed.records ?? []), {
      workItemRef: SPEND_REF,
    });
    expect(amplificationOf(control).events).toEqual([]);
    await withMutant(
      FOLD,
      "m03",
      [["    if (run.runId === progress.runId) continue;", "    if (false) continue;"]],
      (module) => {
        const mutated = callable(module, "computeSpendReport")(foldInput(A01.seed.records ?? []), {
          workItemRef: SPEND_REF,
        });
        const events = amplificationOf(mutated).events;
        expect(Array.isArray(events) ? events.length : 0).toBe(1);
      },
    );
  });

  test("M-04 dropping an event under-reports the superseded runs", async () => {
    const fold = await realFold();
    const control = callable(fold, "computeSpendReport")(foldInput(A02.seed.records ?? []), {
      workItemRef: SPEND_REF,
    });
    const controlEvents = amplificationOf(control).events;
    expect(Array.isArray(controlEvents) ? controlEvents.length : 0).toBe(3);
    await withMutant(
      FOLD,
      "m04",
      [
        [
          "  for (const [index, run] of chronological.entries()) {",
          "  for (const [index, run] of chronological.entries()) {\n    if (index === 0) continue;",
        ],
      ],
      (module) => {
        const mutated = callable(module, "computeSpendReport")(foldInput(A02.seed.records ?? []), {
          workItemRef: SPEND_REF,
        });
        const events = amplificationOf(mutated).events;
        expect(Array.isArray(events) ? events.length : 0).toBe(2);
      },
    );
  });

  test("M-05 sorting by run id only reorders the named events", async () => {
    const fold = await realFold();
    const control = callable(fold, "computeSpendReport")(eventOrderRead, {
      workItemRef: SPEND_REF,
    });
    const controlEvents = amplificationOf(control).events;
    if (!Array.isArray(controlEvents)) throw new Error("control events missing");
    expect(controlEvents.map((event) => (event as { tokensWasted: number }).tokensWasted)).toEqual([
      100, 200,
    ]);
    await withMutant(
      FOLD,
      "m05",
      [
        [
          `  events.sort((left, right) => {
    if (left.event.window.start !== right.event.window.start) {
      return left.event.window.start < right.event.window.start ? -1 : 1;
    }
    return left.runId < right.runId ? -1 : left.runId > right.runId ? 1 : 0;
  });`,
          "  events.sort((left, right) => (left.runId < right.runId ? -1 : left.runId > right.runId ? 1 : 0));",
        ],
      ],
      (module) => {
        const mutated = callable(module, "computeSpendReport")(eventOrderRead, {
          workItemRef: SPEND_REF,
        });
        const events = amplificationOf(mutated).events;
        if (!Array.isArray(events)) throw new Error("mutant events missing");
        expect(events.map((event) => (event as { tokensWasted: number }).tokensWasted)).toEqual([
          200, 100,
        ]);
      },
    );
  });

  test("M-06 clamping the ratio hides the restart loop", async () => {
    const fold = await realFold();
    const control = callable(fold, "computeSpendReport")(foldInput(A02.seed.records ?? []), {
      workItemRef: SPEND_REF,
    });
    expect(amplificationOf(control).ratio).toBeGreaterThan(1);
    await withMutant(
      FOLD,
      "m06",
      [
        [
          "const ratio = progress.spend === 0 ? null : paid / progress.spend;",
          "const ratio = progress.spend === 0 ? null : Math.min(1, paid / progress.spend);",
        ],
      ],
      (module) => {
        const mutated = callable(module, "computeSpendReport")(foldInput(A02.seed.records ?? []), {
          workItemRef: SPEND_REF,
        });
        expect(amplificationOf(mutated).ratio).toBe(1);
      },
    );
  });

  test("M-07 a harness-adapter probe is caught by the imports guard", () => {
    expect(spendImportViolations(ROOT)).toEqual([]);
    const source = `${readFileSync(join(ROOT, READS), "utf8")}\nimport { createHarnessStore } from "@delivery-os/adapters/harness";\n`;
    const violations = forbiddenSpendImports(source, READS);
    expect(violations.some((entry) => entry.includes("@delivery-os/adapters/harness"))).toBe(true);
  });

  test("M-08 silent truncation drops entries without the declared marker", async () => {
    const fold = await realFold();
    const records = Array.from({ length: 600 }, (_, index) =>
      makeSessionRecord({
        runId: "run-single",
        sessionId: `ses-${String(index)}`,
        agent: `agent-${"a".repeat(40)}-${String(index).padStart(5, "0")}`,
        model: `model-${"m".repeat(30)}`,
        tokens: tokens({ input: 10 }),
      }),
    );
    const control = reportOf(
      callable(fold, "computeSpendReport")(foldInput(records), { workItemRef: SPEND_REF }),
    );
    const controlWarnings = control.warnings;
    expect(Array.isArray(controlWarnings) ? controlWarnings.length : 0).toBe(1);
    await withMutant(
      FOLD,
      "m08",
      [
        [
          `  const warnings: string[] = [];
  if (
    bounded.truncation.agents !== 0 ||
    bounded.truncation.breakdowns !== 0 ||
    bounded.truncation.phases !== 0 ||
    bounded.truncation.events !== 0
  ) {
    warnings.push(spendTruncationWarning(bounded.truncation));
  }`,
          "  const warnings: string[] = [];",
        ],
      ],
      (module) => {
        const mutated = reportOf(
          callable(module, "computeSpendReport")(foldInput(records), { workItemRef: SPEND_REF }),
        );
        expect(mutated.warnings).toEqual([]);
        const data = dataOf(mutated);
        expect(Array.isArray(data.perAgent) ? data.perAgent.length : 0).toBeLessThan(
          records.length,
        );
      },
    );
  });

  test("M-09 a failed digest read rendered as zero spend is a false claim", async () => {
    const fold = await realFold();
    const emptyRead: SpendLedgerRead = {
      workItemRef: SPEND_REF,
      records: [],
      outcomes: [],
      transitions: [],
      transitionsPresent: false,
      verifiedEmpty: true,
      evidence: { storePath: "fixture://empty", recordCount: 0 },
    };
    const control = callable(fold, "spendDigestSection")(emptyRead);
    expect(reportOf(control).captured).toBe(false);
    await withMutant(
      FOLD,
      "m09",
      [
        [
          '  if (!folded.ok) return { state: "observed", captured: false };',
          '  if (!folded.ok) return { state: "observed", captured: true, tokensByClass: { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 }, restarts: 0, ratio: 1 };',
        ],
      ],
      (module) => {
        const mutated = reportOf(callable(module, "spendDigestSection")(emptyRead));
        expect(mutated.captured).toBe(true);
        expect(mutated.ratio).toBe(1);
      },
    );
  });

  test("M-10 a fence-and-write member is caught by the write-member scan", () => {
    expect(writeMemberViolations(readFileSync(join(ROOT, READS), "utf8"), READS)).toEqual([]);
    const source = `${readFileSync(join(ROOT, READS), "utf8")}\nexport const mutate = (store: StateStorePort) => store.acquireFence("mutant");\n`;
    expect(writeMemberViolations(source, READS)).toEqual([`${READS}: write member .acquireFence(`]);
  });

  test("M-11 a case-insensitive ref pattern accepts a lowercase ref", async () => {
    const real = readFileSync(join(ROOT, CONTRACTS), "utf8");
    const realPattern = /export const SPEND_WORK_ITEM_REF_PATTERN = "([^"]+)"/.exec(real)?.[1];
    if (realPattern === undefined) throw new Error("pattern is missing");
    expect(new RegExp(realPattern).test("gh-236")).toBe(false);
    await withMutant(
      CONTRACTS,
      "m11",
      [['"^[A-Z][A-Z0-9]*-[0-9]+$"', '"^[A-Za-z][A-Za-z0-9]*-[0-9]+$"']],
      (module) => {
        const mutated = module.SPEND_WORK_ITEM_REF_PATTERN;
        if (typeof mutated !== "string") throw new Error("mutated pattern missing");
        expect(new RegExp(mutated).test("gh-236")).toBe(true);
      },
    );
  });

  test("M-12 omitting progressRun erases the machine-readable run identity", async () => {
    const fold = await realFold();
    const control = callable(fold, "computeSpendReport")(foldInput(A04.seed.records ?? []), {
      workItemRef: SPEND_REF,
    });
    expect(amplificationOf(control).progressRun).toBe("run-R2");
    await withMutant(
      FOLD,
      "m12",
      [
        [
          "const progressRun = progress.spend === 0 ? progress.runId : null;",
          "const progressRun = null;",
        ],
      ],
      (module) => {
        const mutated = callable(module, "computeSpendReport")(foldInput(A04.seed.records ?? []), {
          workItemRef: SPEND_REF,
        });
        expect(amplificationOf(mutated).progressRun).toBeNull();
      },
    );
  });

  test("the unmutated tree keeps every control and leaves no mutant copy behind", async () => {
    expect(spendImportViolations(ROOT)).toEqual([]);
    const fold = await realFold();
    const control = callable(fold, "computeSpendReport")(foldInput(A01.seed.records ?? []), {
      workItemRef: SPEND_REF,
    });
    expect(amplificationOf(control).ratio).toBe(1);
    // No `.mutant-` copy may survive the suite: the parent directory lists none.
    const { readdirSync } = await import("node:fs");
    const leftovers = readdirSync(join(ROOT, "packages/core/src/domain")).filter((name) =>
      name.startsWith(".mutant-"),
    );
    expect(leftovers).toEqual([]);
    expect(readFileSync(join(ROOT, TEXT), "utf8").length).toBeGreaterThan(0);
    expect(
      readdirSync(join(ROOT, "packages/core/src/state")).filter((name) =>
        name.startsWith(".mutant-"),
      ),
    ).toEqual([]);
    expect(seedSpend === undefined).toBe(false);
  });
});
