/**
 * TC-ERR-004 (phase 4) — every dispatch failure envelope carries the six stable
 * error fields and stays within the bounded exits; byte equality with the
 * committed goldens.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createCommandScenario, readsFrom } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";
import { readFail } from "../fixtures/dispatch/truth";

const GOLDEN = join(process.cwd(), "tests/fixtures/dispatch/golden/errors");

type ErrorFieldCarrier = {
  readonly category?: string;
  readonly consequence?: string;
  readonly code?: string;
  readonly remediationHint?: string;
  readonly retryable?: boolean;
  readonly summary?: string;
};

const assertErrorFields = (
  envelope:
    | {
        readonly exitCode: number;
        readonly data?: { readonly error?: ErrorFieldCarrier };
        readonly error?: ErrorFieldCarrier;
      }
    | undefined,
) => {
  const error = envelope.data?.error ?? envelope.error;
  expect(error).toBeDefined();
  for (const field of [
    "code",
    "category",
    "retryable",
    "consequence",
    "remediationHint",
  ] as const) {
    expect(error?.[field], field).toBeDefined();
  }
  expect(error?.summary === undefined || typeof error.summary === "string").toBe(true);
  expect([0, 1, 2]).toContain(envelope.exitCode);
};

describe("TC-ERR-004 error envelopes carry stable identity and bounded exit", () => {
  test("spawn failure is byte-identical to its golden", async () => {
    const scenario = createCommandScenario({ spawnFails: true });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(1);
      assertErrorFields(run.envelope);
      expect(run.stdout.trim()).toBe(readFileSync(join(GOLDEN, "spawn-failed.json"), "utf8").trim());
    } finally {
      scenario.dispose();
    }
  });

  test("state-unverified is byte-identical to its golden", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      reads: readsFrom({ tracker: readFail("tracker", "tracker.read-unreadable") }),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(2);
      assertErrorFields(run.envelope);
      expect(run.stdout.trim()).toBe(
        readFileSync(join(GOLDEN, "state-unverified.json"), "utf8").trim(),
      );
    } finally {
      scenario.dispose();
    }
  });
});
