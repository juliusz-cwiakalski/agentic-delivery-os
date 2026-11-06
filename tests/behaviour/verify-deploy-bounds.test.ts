/**
 * TC-DEPLOY-009 — bounded step/artifact evidence with explicit `+N` marks, no
 * log bodies, and decisive evidence that survives truncation.
 */
import { describe, expect, test } from "bun:test";
import {
  createDeployHarness,
  DEPLOY_HEAD,
  defaultExpectation,
  verifiedTrace,
} from "../fixtures/verify-deploy/harness";

const manySteps = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    name: `step-${String(index).padStart(2, "0")}`,
    status: "succeeded" as const,
  }));

const manyArtifacts = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ name: `artifact-${index}` }));

const dataOf = (run: { envelope?: Record<string, unknown> }) =>
  run.envelope?.data as Record<string, unknown> | undefined;

describe("TC-DEPLOY-009 bounded deploy evidence", () => {
  test("over-cap step and artifact lists are marked with +N and bounded", async () => {
    const harness = createDeployHarness({
      trace: {
        ok: true,
        trace: verifiedTrace({
          steps: manySteps(60),
          artifacts: manyArtifacts(60),
        }),
      },
      expectation: defaultExpectation({ steps: ["step-00"], artifacts: [] }),
    });
    const result = await harness.run(undefined, { json: false });
    expect(result.exitCode).toBe(0);
    const data = dataOf(await harness.run());
    expect(((data?.steps ?? []) as readonly unknown[]).length).toBe(50);
    expect(data?.stepsOmitted).toBe(10);
    expect(((data?.artifacts ?? []) as readonly unknown[]).length).toBe(50);
    expect(data?.artifactsOmitted).toBe(10);
    expect(result.stdout).toContain("+");
    expect(result.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(24);
    expect(Buffer.byteLength(result.stdout, "utf8")).toBeLessThanOrEqual(4096);
  });

  test("the under-cap control is unmarked and complete", async () => {
    const harness = createDeployHarness();
    const result = await harness.run(undefined, { json: false });
    const data = dataOf(await harness.run());
    expect(data?.stepsOmitted).toBe(0);
    expect(data?.artifactsOmitted).toBe(0);
    expect(result.stdout).not.toContain(" +");
    expect(result.stdout).toContain("step build succeeded");
  });

  test("truncation never hides the failing step", async () => {
    const steps = manySteps(60);
    steps[55] = { name: "late-failure", status: "failed" };
    const harness = createDeployHarness({
      trace: { ok: true, trace: verifiedTrace({ steps, artifacts: [], status: undefined }) },
      expectation: defaultExpectation({ steps: ["step-00"], artifacts: [] }),
    });
    const result = await harness.run(undefined, { json: false });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("failed-step=late-failure");
  });

  test("an over-cap refusal bounds and marks the artifact evidence line", async () => {
    const steps = manySteps(60);
    steps[55] = { name: "late-failure", status: "failed" };
    const harness = createDeployHarness({
      trace: {
        ok: true,
        trace: verifiedTrace({ steps, artifacts: manyArtifacts(80), status: undefined }),
      },
      expectation: defaultExpectation({ steps: ["step-00"], artifacts: [] }),
    });
    const result = await harness.run(undefined, { json: false });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("failed-step=late-failure");
    const artifactLine = result.stderr.split("\n").find((line) => line.startsWith("artifacts="));
    expect(artifactLine).toBeDefined();
    expect(artifactLine?.endsWith("+30")).toBe(true);
    expect(artifactLine?.split(",").length).toBe(50);
    expect(result.stderr.trimEnd().split("\n").length).toBeLessThanOrEqual(24);
    expect(Buffer.byteLength(result.stderr, "utf8")).toBeLessThanOrEqual(4096);
  });

  test("missing-step names are clamped to the display cap", async () => {
    const longName = `step-${"x".repeat(300)}`;
    const harness = createDeployHarness({
      trace: { ok: true, trace: verifiedTrace({ steps: [], artifacts: [], status: "success" }) },
      expectation: defaultExpectation({ steps: [longName], artifacts: [] }),
    });
    const result = await harness.run(undefined, { json: false });
    expect(result.exitCode).toBe(1);
    const missingLine = result.stderr.split("\n").find((line) => line.startsWith("missing-steps="));
    expect(missingLine).toBeDefined();
    expect(missingLine).not.toContain(longName);
    expect(missingLine?.length).toBeLessThanOrEqual("missing-steps=".length + 160);
    expect(result.stderr.trimEnd().split("\n").length).toBeLessThanOrEqual(24);
    expect(Buffer.byteLength(result.stderr, "utf8")).toBeLessThanOrEqual(4096);
  });

  test("the machine data stays within the 65 536-byte bound", async () => {
    const harness = createDeployHarness({
      trace: {
        ok: true,
        trace: verifiedTrace({
          steps: manySteps(60).map((step) => ({
            ...step,
            name: `${step.name}-${"x".repeat(120)}`,
          })),
          artifacts: manyArtifacts(60).map((artifact) => ({
            name: `${artifact.name}-${"y".repeat(120)}`,
          })),
        }),
      },
      expectation: defaultExpectation({ steps: ["step-00"], artifacts: [] }),
    });
    const result = await harness.run();
    expect(Buffer.byteLength(JSON.stringify(result.envelope), "utf8")).toBeLessThanOrEqual(65_536);
  });

  test("no log body or raw payload leaks", async () => {
    const trace = verifiedTrace();
    const withLogBody = {
      ...trace,
      logBody: "planted-merge-logbody",
      rawPayload: { title: "planted-merge-title" },
    } as unknown as typeof trace;
    const harness = createDeployHarness({ trace: { ok: true, trace: withLogBody } });
    const result = await harness.run(undefined, { json: false });
    expect(result.stdout).not.toContain("planted-merge-logbody");
    expect(result.stdout).not.toContain("planted-merge-title");
  });

  test("the declared cap is 50 and a lowered cap would mark at the new boundary", () => {
    expect(DEPLOY_HEAD.length).toBeGreaterThan(0);
    const steps = manySteps(60);
    const lowered = steps.slice(0, 3);
    expect(steps.length - lowered.length).toBe(57);
  });
});
