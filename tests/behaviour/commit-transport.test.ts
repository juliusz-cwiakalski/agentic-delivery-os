/**
 * TC-TRANSPORT-001..006 — ordered selection, headless one-shot context,
 * template fallback, classified failover, quota-park fallthrough, and safety
 * before transport selection.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { createHarnessOneShotTransport } from "../../packages/adapters/src/session/commit-one-shot";
import { withCommitHarness } from "../fixtures/commit/harness";
import {
  COMMIT_REF,
  commitDataOf,
  commitPaths,
  seedDirtyTree,
  telemetryPayloads,
  validMessage,
} from "./commit-support";

const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;

describe("TC-TRANSPORT-001 seam order", () => {
  test("core available calls core once and never constructs the harness", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(harness.coreTransport.calls).toHaveLength(1);
        expect(harness.harnessTransport.calls).toHaveLength(0);
        expect(commitDataOf(run).transport).toBe("core-inference");
      },
      { seedFiles: SEED, availability: { harnessOneShot: { available: true } } },
    );
  });

  test("core unavailable calls the harness once and never the template", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        harness.harnessTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(harness.coreTransport.calls).toHaveLength(0);
        expect(harness.harnessTransport.calls).toHaveLength(1);
        expect(commitDataOf(run).transport).toBe("harness-one-shot");
      },
      {
        seedFiles: SEED,
        availability: {
          coreInference: { available: false, reason: "no-route" },
          harnessOneShot: { available: true },
        },
      },
    );
  });

  test("neither available lands the template with zero transport calls", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(commitDataOf(run).messageSource).toBe("template");
        expect(commitDataOf(run).transport).toBe("none");
        expect(harness.coreTransport.calls).toHaveLength(0);
        expect(harness.harnessTransport.calls).toHaveLength(0);
      },
      {
        seedFiles: SEED,
        availability: {
          coreInference: { available: false },
          harnessOneShot: { available: false },
        },
      },
    );
  });
});

describe("TC-TRANSPORT-002 harness one-shot is headless in a temporary empty context", () => {
  test("runs in an empty temp project, passes a sanitized environment, and cleans up", async () => {
    const seen: { cwd?: string; env?: Record<string, string>; prompt?: unknown } = {};
    const transport = createHarnessOneShotTransport({
      command: "fixture-harness",
      environment: { SAFE_KEY: "safe-value", DELIVERY_SESSION_ID: undefined },
      runner: async (_file, args, options) => {
        seen.cwd = options.cwd;
        seen.env = { ...options.env };
        const promptPath = args[args.length - 1] as string;
        seen.prompt = JSON.parse(await Bun.file(promptPath).text()) as unknown;
        return {
          stdout: JSON.stringify({
            subject: `feat(${COMMIT_REF}): harness one-shot`,
            breaking: false,
            usage: { inputTokens: 10, outputTokens: 5 },
          }),
          stderr: "",
          status: 0,
          timedOut: false,
        };
      },
    });
    const outcome = await transport.generate({
      skeleton: {
        ref: COMMIT_REF,
        refSource: "argument",
        type: "feat",
        scope: COMMIT_REF,
        breaking: false,
      },
      bundle: {
        skeleton: {
          ref: COMMIT_REF,
          refSource: "argument",
          type: "feat",
          scope: COMMIT_REF,
          breaking: false,
        },
        files: [],
        lastCommitSubjects: [],
        totalInputChars: 0,
        trimmed: false,
      },
      temperature: 0.1,
      maxOutputTokens: 512,
      schemaId: "delivery.commit.message.v1",
    });
    expect(outcome.ok).toBe(true);
    expect(seen.cwd).toBeDefined();
    expect(seen.env).toEqual({ SAFE_KEY: "safe-value" });
    expect(seen.prompt).toMatchObject({ schemaId: "delivery.commit.message.v1" });
    if (seen.cwd !== undefined) expect(existsSync(seen.cwd)).toBe(false);
  });
});

describe("TC-TRANSPORT-003 no transport → template commit lands", () => {
  test("the commit lands on the first invocation with zero spend", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        const data = commitDataOf(run);
        expect(data.messageSource).toBe("template");
        expect(data.transport).toBe("none");
        expect(telemetryPayloads(harness)[0]).toMatchObject({
          messageSource: "template",
          transport: "none",
          tokenSpend: { inputTokens: 0, outputTokens: 0 },
        });
        expect(commitPaths(harness).length).toBeGreaterThan(0);
      },
      {
        seedFiles: SEED,
        availability: {
          coreInference: { available: false },
          harnessOneShot: { available: false },
        },
      },
    );
  });
});

describe("TC-TRANSPORT-004 failover is classified in the emitted event", () => {
  test("a core failure falls through to the harness with the reason recorded", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        harness.coreTransport.push({ kind: "failure", code: "provider.outage" });
        harness.harnessTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(commitDataOf(run).transport).toBe("harness-one-shot");
        const event = telemetryPayloads(harness)[0];
        expect(event?.transport).toBe("harness-one-shot");
        expect(event?.failover).toEqual([
          { transport: "core-inference", reason: "provider.outage" },
        ]);
      },
      {
        seedFiles: SEED,
        availability: {
          coreInference: { available: true },
          harnessOneShot: { available: true },
        },
      },
    );
  });

  test("both failing chains land the template and classify both reasons", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        harness.coreTransport.push({ kind: "failure", code: "provider.outage" });
        harness.harnessTransport.push({ kind: "failure", code: "harness.failed" });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        const event = telemetryPayloads(harness)[0];
        expect(event?.transport).toBe("none");
        expect(event?.failover).toEqual([
          { transport: "core-inference", reason: "provider.outage" },
          { transport: "harness-one-shot", reason: "harness.failed" },
        ]);
      },
      {
        seedFiles: SEED,
        availability: {
          coreInference: { available: true },
          harnessOneShot: { available: true },
        },
      },
    );
  });
});

describe("TC-TRANSPORT-005 quota park falls through without waiting", () => {
  test("a parked core route falls straight to the template", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(commitDataOf(run).messageSource).toBe("template");
        expect(harness.coreTransport.calls).toHaveLength(0);
        expect(telemetryPayloads(harness)[0]?.failover).toEqual([
          { transport: "core-inference", reason: "quota-parked" },
          { transport: "harness-one-shot", reason: "unavailable" },
        ]);
      },
      {
        seedFiles: SEED,
        availability: {
          coreInference: {
            available: true,
            parkedUntil: "2099-01-01T00:00:00Z",
          },
          harnessOneShot: { available: false },
        },
      },
    );
  });
});

describe("TC-TRANSPORT-006 safety precedes transport selection", () => {
  test("a secret STOP never constructs a transport or bundle", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        harness.safety.setFindings([{ class: "secret-content", path: "src/existing.ts" }]);
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(1);
        expect(harness.coreTransport.calls).toHaveLength(0);
        expect(harness.harnessTransport.calls).toHaveLength(0);
        expect(harness.safety.calls).toHaveLength(1);
      },
      { seedFiles: SEED },
    );
  });
});
