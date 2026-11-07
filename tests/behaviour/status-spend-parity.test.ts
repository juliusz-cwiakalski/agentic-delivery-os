/**
 * TC-SPEND-030 — one fold, two surfaces: the command and the status digest
 * report identical totals, restarts and ratio from the same seeded store.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SpendDigestSection, StatusDigest } from "../../packages/core/src/contracts/index";
import { aggregateStatus, spendDigestSection } from "../../packages/core/src/domain/index";
import { readSpendLedger } from "../../packages/core/src/state/index";
import { A01, A02, type AmplificationCase } from "../fixtures/spend/cases";
import {
  makeIdentity,
  makeSessionRecord,
  makeTempRoot,
  openStore,
  removeRoot,
  runSpendCli,
  SPEND_REF,
  seedSpend,
  spendRuntimeOver,
  tokens,
} from "../fixtures/spend/harness";
import { P12, T1, T2 } from "../fixtures/spend/transitions";
import { baseFacts } from "../fixtures/status/harness";

const T1_MINUS = new Date(Date.parse(T1) - 30 * 60_000).toISOString();
const T2_PLUS = new Date(Date.parse(T2) + 30 * 60_000).toISOString();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const digestSectionFor = (root: string, testCase: AmplificationCase) => {
  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  seedSpend(store, testCase.seed);
  const read = readSpendLedger(store, SPEND_REF);
  if (!read.ok) throw new Error(`read failed: ${read.error.code}`);
  return { store, projection: spendDigestSection(read.value) };
};

const parity = async (testCase: AmplificationCase, label: string): Promise<void> => {
  const root = makeTempRoot(`gh236-parity-${label}`);
  try {
    const { store, projection } = digestSectionFor(root, testCase);
    const command = await runSpendCli(
      ["--json", "spend", "--ref", SPEND_REF],
      spendRuntimeOver(store),
    );
    expect(command.exitCode).toBe(0);
    const envelope = JSON.parse(command.stdout) as unknown;
    if (!isRecord(envelope) || !isRecord(envelope.data)) throw new Error("data missing");
    const data = envelope.data;
    if (projection.state !== "observed" || !projection.captured) {
      throw new Error("projection is not captured");
    }
    expect(data.tokensByClass).toEqual(projection.tokensByClass);
    expect(data.restarts).toBe(projection.restarts);
    const amplification = data.amplification;
    if (!isRecord(amplification)) throw new Error("amplification missing");
    expect(amplification.ratio).toBe(projection.ratio);

    const digest = aggregateStatus(
      baseFacts({ spend: projection as SpendDigestSection }),
    ) as StatusDigest;
    const section = digest.sections[7];
    if (section === undefined) throw new Error("spend section missing");
    expect(section.spend).toEqual(projection);
    expect(section.state).toBe("observed");
  } finally {
    removeRoot(root);
  }
};

describe("TC-SPEND-030 one fold, two surfaces", () => {
  test("the healthy fixture reads identically in both surfaces", async () => {
    await parity(A01, "healthy");
  });

  test("the restart-loop fixture reads identically in both surfaces", async () => {
    await parity(A02, "loop");
  });

  test("a degraded-record fixture reads identically in both surfaces", async () => {
    const records = (A02.seed.records ?? []).map((record, index) =>
      index === 0
        ? {
            ...record,
            warnings: [{ reason: "optional-field-absent" as const, field: "tokens.input" }],
          }
        : record,
    );
    await parity({ ...A02, id: "degraded", seed: { ...A02.seed, records } }, "degraded");
  });

  test("the digest delegates to the one fold and never re-aggregates", () => {
    const domain = readFileSync(join(process.cwd(), "packages/core/src/domain/status.ts"), "utf8");
    expect(domain).not.toContain("computeSpendReport");
    const fold = readFileSync(join(process.cwd(), "packages/core/src/domain/spend.ts"), "utf8");
    expect(fold).toContain("export const spendDigestSection");
    const digestBody = fold.slice(fold.indexOf("export const spendDigestSection"));
    expect(digestBody).toContain("computeSpendReport(read, { workItemRef: read.workItemRef })");
  });

  test("the digest scope is the ref, not a phase-scoped command selection", async () => {
    const twoPhase: AmplificationCase = {
      ...A01,
      id: "two-phase",
      seed: {
        transitions: P12,
        records: [
          makeSessionRecord({
            runId: "run-spec",
            capturedAt: T1_MINUS,
            tokens: tokens({ input: 300 }),
          }),
          makeSessionRecord({
            runId: "run-planning",
            capturedAt: T2_PLUS,
            tokens: tokens({ input: 700 }),
          }),
        ],
      },
    };
    const root = makeTempRoot("gh236-parity-scope");
    try {
      const { store, projection } = digestSectionFor(root, twoPhase);
      const scoped = await runSpendCli(
        ["--json", "spend", "--ref", SPEND_REF, "--phase", "specification"],
        spendRuntimeOver(store),
      );
      expect(scoped.exitCode).toBe(0);
      const envelope = JSON.parse(scoped.stdout) as unknown;
      if (!isRecord(envelope) || !isRecord(envelope.data)) throw new Error("data missing");
      const data = envelope.data;
      if (projection.state !== "observed" || !projection.captured) throw new Error("projection");
      expect(projection.tokensByClass.input).toBe(1000);
      const scopedTokens = isRecord(data.tokensByClass) ? data.tokensByClass.input : undefined;
      expect(scopedTokens).toBe(300);
    } finally {
      removeRoot(root);
    }
  });
});
