/**
 * TC-CEREMONY-004 (golden half) — a captured envelope per outcome class keeps
 * the five delivered keys, the data-XOR-error rule, the `{0,1,2}` exit
 * projection, and the rule that a tier finding is data, never an error.
 */
import { describe, expect, test } from "bun:test";
import { createCeremonyCommandDefinition } from "../../packages/cli/src/commands/ceremony";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { bufferSink, SYNTHETIC_BRAND } from "./helpers";

const CASES: readonly {
  readonly name: string;
  readonly result: { ok: true; data: unknown } | { ok: false; error: Record<string, unknown> };
  readonly exit: number;
  readonly branch: "data" | "error";
}[] = [
  {
    name: "verified",
    result: {
      ok: true,
      data: { ceremony: "morning-brief", runId: "run-1", verdict: "verified", steps: [] },
    },
    exit: 0,
    branch: "data",
  },
  {
    name: "dry-run",
    result: {
      ok: true,
      data: { ceremony: "mirror", runId: "run-2", verdict: "dry-run", steps: [] },
    },
    exit: 0,
    branch: "data",
  },
  {
    name: "unverified",
    result: {
      ok: true,
      data: { ceremony: "morning-brief", runId: "run-3", verdict: "unverified", steps: [] },
    },
    exit: 1,
    branch: "data",
  },
  {
    name: "nothing-missed",
    result: { ok: true, data: { outcome: "nothing-missed", ceremonies: [], appendedRuns: 0 } },
    exit: 0,
    branch: "data",
  },
  {
    name: "tier finding",
    result: {
      ok: true,
      data: {
        ceremony: "morning-brief",
        runId: "run-4",
        verdict: "verified",
        steps: [],
        tier: { findings: [{ kind: "unevaluated-trigger", subject: "owner-mood" }] },
      },
    },
    exit: 0,
    branch: "data",
  },
  {
    name: "refusal",
    result: { ok: false, error: { code: "input.value.rejected", summary: "refused" } },
    exit: 1,
    branch: "error",
  },
  {
    name: "torn state",
    result: {
      ok: false,
      error: { code: "state.store.torn", summary: "torn", kind: "state" },
    },
    exit: 2,
    branch: "error",
  },
];

const capture = async (result: (typeof CASES)[number]["result"]) => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const deps: CliDependencies = {
    brand: SYNTHETIC_BRAND,
    clock: { now: () => 1 },
    newRunId: () => "run-golden",
    secrets: [],
    program: {
      commands: {
        ceremony: createCeremonyCommandDefinition({
          list: () => result as never,
          run: () => result as never,
          resume: () => result as never,
          catchUp: () => result as never,
        }),
      },
    },
  };
  const exitCode = await runCli(["ceremony", "list", "--json"], { stdout, stderr }, deps);
  return { exitCode, envelope: JSON.parse(stdout.value) as Record<string, unknown> };
};

describe("golden: ceremony envelopes", () => {
  test.each(CASES)("$name keeps the five keys and the declared exit", async (entry) => {
    const { exitCode, envelope } = await capture(entry.result);
    expect(exitCode).toBe(entry.exit);
    expect(assertEnvelopeContract(envelope)).toEqual([]);
    expect(Object.keys(envelope).sort()).toEqual(
      ["exitCode", "runId", "schemaVersion", "timing", entry.branch].sort(),
    );
    expect(Object.hasOwn(envelope, "ok")).toBe(false);
    expect(Object.hasOwn(envelope, "command")).toBe(false);
    if (entry.branch === "error") {
      expect((envelope.error as { detail?: unknown }).detail).toBeUndefined();
    }
  });

  test("a tier finding is data, never an error row", async () => {
    const finding = CASES.find((entry) => entry.name === "tier finding");
    if (finding === undefined) throw new Error("case missing");
    const { envelope } = await capture(finding.result);
    expect(envelope.data).toMatchObject({
      tier: { findings: [{ kind: "unevaluated-trigger", subject: "owner-mood" }] },
    });
    expect(Object.hasOwn(envelope, "error")).toBe(false);
  });
});
