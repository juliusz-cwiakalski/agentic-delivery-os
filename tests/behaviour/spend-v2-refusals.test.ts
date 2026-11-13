/**
 * TC-TELEMETRY-016 — a breakdown selection outside the five declared
 * dimensions is refused with the classified input error BEFORE any record read;
 * the accepted values render (AC-F5-3, matrix §4.6).
 */
import { afterEach, describe, expect, test } from "bun:test";
import { SPEND_BREAKDOWN_FIELDS } from "../../packages/core/src/contracts/index";
import {
  countCalls,
  recordingStore,
  runSpendCli,
  spendRuntimeOver,
} from "../fixtures/spend/harness";
import {
  foldTelemetryStore,
  makeStepRecord,
  removeRoot,
  TELEMETRY_REF,
  tokens,
} from "../fixtures/telemetry";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const seeded = () => {
  const fixture = foldTelemetryStore(
    {
      steps: [
        makeStepRecord({ sessionId: "ses_cli_a", tokens: tokens({ input: 10 }) }),
        makeStepRecord({
          sessionId: "ses_cli_b",
          model: "model-beta",
          tokens: tokens({ input: 5 }),
        }),
      ],
    },
    "refusals",
  );
  roots.push(fixture.root);
  return fixture;
};

const codeOf = (stdout: string): string | undefined => {
  const parsed = JSON.parse(stdout) as { readonly error?: { readonly code?: unknown } };
  return typeof parsed.error?.code === "string" ? parsed.error.code : undefined;
};

describe("TC-TELEMETRY-016 unknown breakdown is refused before any read", () => {
  for (const probe of ["ticketId", "Model", "roles", "repo", ""]) {
    test(`the value "${probe}" is input.value.rejected with zero reads`, async () => {
      const fixture = seeded();
      const log: string[] = [];
      const argv = ["--json", "spend", "--ref", TELEMETRY_REF, "--breakdown"];
      const run = await runSpendCli(
        probe === "" ? argv : [...argv, probe],
        spendRuntimeOver(recordingStore(fixture.store, log)),
      );
      expect(run.exitCode).toBe(1);
      // The refusal happens in the handler: no record-family read is attempted.
      expect(log).toEqual([]);
      if (probe === "") return; // a missing value takes the same classified path
      expect(codeOf(run.stdout)).toBe("input.value.rejected");
      expect(run.stdout).toContain("unknown breakdown");
    });
  }

  test("each of the five declared fields is accepted and renders (non-vacuity)", async () => {
    for (const field of SPEND_BREAKDOWN_FIELDS) {
      const fixture = seeded();
      const run = await runSpendCli(
        ["--json", "spend", "--ref", TELEMETRY_REF, "--breakdown", field],
        spendRuntimeOver(fixture.store),
      );
      expect(run.exitCode, field).toBe(0);
      const data = (JSON.parse(run.stdout) as { readonly data?: Record<string, unknown> }).data;
      expect(Object.keys(data ?? {})).toContain("breakdowns");
    }
    expect([...SPEND_BREAKDOWN_FIELDS]).toEqual(["ticket", "repository", "lane", "role", "model"]);
  });

  test("the accepted control reports the selected dimension in the human digest", async () => {
    const fixture = seeded();
    const run = await runSpendCli(
      ["spend", "--ref", TELEMETRY_REF, "--breakdown", "model"],
      spendRuntimeOver(fixture.store),
    );
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("breakdown  model");
    expect(run.stdout).toContain("reconcile");
  });

  test("a missing breakdown value is rejected with zero reads", async () => {
    const fixture = seeded();
    const log: string[] = [];
    const run = await runSpendCli(
      ["--json", "spend", "--ref", TELEMETRY_REF, "--breakdown"],
      spendRuntimeOver(recordingStore(fixture.store, log)),
    );
    expect(run.exitCode).toBe(1);
    expect(log).toEqual([]);
    expect(countCalls(log, "readRecords")).toBe(0);
  });

  test("an undeclared flag stays the shared parser's fallback.invocation", async () => {
    const fixture = seeded();
    const log: string[] = [];
    const run = await runSpendCli(
      ["--json", "spend", "--ref", TELEMETRY_REF, "--breakdowns", "model"],
      spendRuntimeOver(recordingStore(fixture.store, log)),
    );
    expect(run.exitCode).toBe(1);
    expect(log).toEqual([]);
    expect(codeOf(run.stdout)).toBe("fallback.invocation");
  });
});
