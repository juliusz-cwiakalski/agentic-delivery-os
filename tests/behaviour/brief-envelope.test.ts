/**
 * TC-BRIEF-011 / TC-BRIEF-012 — collector unavailability is digest data at exit
 * 0, and the exit surface is exactly the shipped `{0,1,2}` projection with
 * containment identities only.
 */
import { describe, expect, test } from "bun:test";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import {
  baseFacts,
  briefRuntime,
  capSizedFacts,
  createStatusRecorder,
  failedEverywhereFacts,
  runBriefCli,
} from "../fixtures/brief/harness";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const envelopeOf = (stdout: string): Record<string, unknown> => {
  const parsed = JSON.parse(stdout) as unknown;
  if (!isRecord(parsed)) throw new Error("envelope is not an object");
  return parsed;
};

const payloadOf = (envelope: Record<string, unknown>): Record<string, unknown> => {
  const data = envelope.data;
  if (!isRecord(data)) throw new Error("data is not an object");
  return data;
};

describe("TC-BRIEF-011 collector unavailability is digest data", () => {
  test("all reads failing still yields one success envelope at exit 0", async () => {
    const run = await runBriefCli(["--json", "brief"], briefRuntime(failedEverywhereFacts()));
    expect(run.exitCode).toBe(0);
    const envelope = envelopeOf(run.stdout);
    expect(assertEnvelopeContract(envelope)).toEqual([]);
    expect(envelope).not.toHaveProperty("error");
    expect(envelope.exitCode).toBe(0);
    const data = payloadOf(envelope);
    expect(data.schemaVersion).toBe("delivery.brief.v1");
    expect(Array.isArray(data.surfaces)).toBe(true);
    expect((data.surfaces as unknown[]).length).toBe(9);
    expect(data.placeholders).toEqual([
      { capability: "gate-sla-states", owningStory: "M1-S5", state: "not-delivered" },
      { capability: "lane-queue-engine", owningStory: "M1-S17", state: "not-delivered" },
    ]);
    expect(run.stderr).toBe("");
    expect(run.stdout).not.toContain("status.collector.");
  });

  test("missing credential, unavailable binding, and anonymous guard keep exit 0", async () => {
    const cases = [
      failedEverywhereFacts(),
      baseFacts({
        repository: {
          binding: { state: "unavailable", reason: "addressing-unresolved" },
          head: { detached: true },
        },
      }),
      baseFacts({
        tracker: {
          ok: false,
          reason: "credential-unavailable",
          failureCode: "config.credential.missing",
        },
        changes: {
          ok: false,
          reason: "credential-unavailable",
          failureCode: "config.credential.missing",
        },
        ci: {
          ok: false,
          reason: "credential-unavailable",
          failureCode: "config.credential.missing",
        },
      }),
    ] as const;
    for (const facts of cases) {
      const run = await runBriefCli(["--json", "brief"], briefRuntime(facts));
      expect(run.exitCode).toBe(0);
      const envelope = envelopeOf(run.stdout);
      expect(envelope).not.toHaveProperty("error");
      expect(assertEnvelopeContract(envelope)).toEqual([]);
    }
  });

  test("human mode holds the bounds and names each gap in place", async () => {
    const run = await runBriefCli(["brief"], briefRuntime(failedEverywhereFacts()));
    expect(run.exitCode).toBe(0);
    const lines = run.stdout.split("\n").filter((line) => line.length > 0);
    expect(lines.length).toBeLessThanOrEqual(24);
    expect(Buffer.byteLength(run.stdout, "utf8")).toBeLessThanOrEqual(4096);
    expect(run.stdout).toContain("not-delivered");
    expect(run.stdout).toContain("unknown");
  });
});

describe("TC-BRIEF-012 exit projection and containment identities", () => {
  test("a rejected invocation is fallback.invocation at exit 1 with zero reads", async () => {
    const recorder = createStatusRecorder();
    const run = await runBriefCli(
      ["--json", "brief", "extra"],
      briefRuntime(baseFacts(), recorder),
      {
        recorder,
      },
    );
    expect(run.exitCode).toBe(1);
    expect(recorder.calls).toEqual([]);
    const envelope = envelopeOf(run.stdout);
    expect(envelope.exitCode).toBe(1);
    const error = envelope.error;
    if (!isRecord(error)) throw new Error("error missing");
    expect(error.code).toBe("fallback.invocation");
    expect(assertEnvelopeContract(envelope)).toEqual([]);
  });

  test("a hostile handler is fallback.internal at exit 2 with exactly one envelope", async () => {
    const runtime = {
      ...briefRuntime(baseFacts()),
      readRepository: (): never => {
        throw new Error("planted-brief-handler-canary");
      },
    };
    const run = await runBriefCli(["--json", "brief"], runtime);
    expect(run.exitCode).toBe(2);
    const envelope = envelopeOf(run.stdout);
    expect(envelope.exitCode).toBe(2);
    const error = envelope.error;
    if (!isRecord(error)) throw new Error("error missing");
    expect(error.code).toBe("fallback.internal");
    expect(run.stdout).not.toContain("planted-brief-handler-canary");
    expect(run.stderr).not.toContain("planted-brief-handler-canary");
    expect(run.stdout.trim().split("\n\n").length).toBe(1);
  });

  test("the success exit code equals the machine exitCode field", async () => {
    const run = await runBriefCli(["--json", "brief"], briefRuntime(capSizedFacts()));
    expect(run.exitCode).toBe(0);
    expect(envelopeOf(run.stdout).exitCode).toBe(run.exitCode);
  });
});
