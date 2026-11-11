/**
 * GH-289 TC-ATTEMPT-015 and 016 — the failure cells and the empty-history rule.
 *
 * A verified empty read is success at exit 0 with an empty page; a torn,
 * unreadable, or permission-denied store keeps its own `state.*` identity at
 * exit 2 and is never reported as an empty history.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type {
  DispatchAttemptsData,
  StateFailureCode,
  StateStorePort,
} from "../../packages/core/src/contracts/index";
import { ATTEMPTS_REF, ledgerOf } from "../fixtures/dispatch/attempt-records";
import { type AttemptsHarness, createAttemptsHarness } from "../fixtures/dispatch/attempts-harness";
import { ledgerPath } from "../fixtures/state/harness";

const failingStore = (store: StateStorePort, code: StateFailureCode): StateStorePort => ({
  ...store,
  readRecords: () => ({
    ok: false,
    error: { kind: "state", code, consequence: "not_landed", location: { path: "ledger.jsonl" } },
  }),
});

const withHarness = async (
  options: Parameters<typeof createAttemptsHarness>[0],
  body: (harness: AttemptsHarness) => Promise<void> | void,
): Promise<void> => {
  const harness = createAttemptsHarness(options);
  try {
    await body(harness);
  } finally {
    harness.dispose();
  }
};

describe("TC-ATTEMPT-015 a verified empty history is success", () => {
  test("an empty ledger exits 0 with an empty page and no error", async () => {
    await withHarness({ label: "empty", records: [] }, async (harness) => {
      const result = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--json",
      ]);
      expect(result.exit).toBe(0);
      const data = result.data as DispatchAttemptsData;
      expect(data.attempts).toEqual([]);
      expect(data.matched).toBe(0);
      expect(data.hasMore).toBe(false);
      expect(result.error).toBeUndefined();
      expect(result.readCount).toBe(1);
      expect(`${result.stdout}${result.stderr}`).not.toMatch(/attempts\./);
    });
  });
});

describe("TC-ATTEMPT-016 a store fault keeps its state identity", () => {
  // The exit is the delivered projection of the row, not a hardcoded literal:
  // `state.store.torn` projects a platform fault (exit 2) while the delivered
  // `state.permission.denied` row projects user validation (exit 1).
  for (const [code, expectedExit] of [
    ["state.store.torn", 2],
    ["state.store.unknown", 2],
    ["state.permission.denied", 1],
  ] as const) {
    test(`${code} keeps its identity and is never an empty history`, async () => {
      await withHarness(
        {
          label: `fault-${code}`,
          records: ledgerOf(2),
          wrap: (store) => failingStore(store, code),
        },
        async (harness) => {
          const result = await harness.invoke([
            "dispatch",
            "attempts",
            "--ref",
            ATTEMPTS_REF,
            "--json",
          ]);
          expect(result.exit).toBe(expectedExit);
          expect(result.error?.code).toBe(code);
          expect(result.error?.category).toBeDefined();
          expect(result.error?.retryable).toBeDefined();
          expect(result.error?.consequence).toBeDefined();
          expect(result.error?.remediationHint).toBeDefined();
          expect(result.data).toBeUndefined();
        },
      );
    });
  }

  test("a structurally unreadable ledger fails closed instead of reporting empty", async () => {
    await withHarness({ label: "fault-directory", records: ledgerOf(2) }, async (harness) => {
      const path = ledgerPath(harness.store.identity);
      rmSync(path, { force: true });
      mkdirSync(join(path), { recursive: true });
      const result = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--json",
      ]);
      expect(result.exit).toBe(2);
      expect(result.error?.code).toMatch(/^state\./);
      expect(result.data).toBeUndefined();
    });
  });
});
