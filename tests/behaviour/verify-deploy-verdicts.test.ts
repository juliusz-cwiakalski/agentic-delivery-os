/**
 * TC-DEPLOY-001..006 — deploy verdicts derive from the execution trace only:
 * verified requires the declared steps and artifacts; created-never-ran is
 * unknown; status fields are disqualified; failed steps are named; absent
 * evidence is disjoint from a read fault.
 */
import { describe, expect, test } from "bun:test";
import {
  createDeployHarness,
  DEPLOY_REF,
  defaultExpectation,
  verifiedTrace,
} from "../fixtures/verify-deploy/harness";

const errorOf = (run: { envelope?: Record<string, unknown> }) =>
  run.envelope?.error as Record<string, unknown> | undefined;
const dataOf = (run: { envelope?: Record<string, unknown> }) =>
  run.envelope?.data as Record<string, unknown> | undefined;

describe("TC-DEPLOY-001 verified from executed steps and produced artifacts", () => {
  test("a complete successful trace yields verified at exit 0 with the trace summary", async () => {
    const harness = createDeployHarness();
    const result = await harness.run();
    expect(result.exitCode).toBe(0);
    const data = dataOf(result);
    expect(data?.verdict).toBe("verified");
    expect(data?.steps).toEqual([
      { name: "build", status: "succeeded" },
      { name: "publish", status: "succeeded" },
      { name: "smoke", status: "succeeded" },
    ]);
    expect(data?.artifacts).toEqual([{ name: "registry:app@9f21c0e" }]);
    expect(Object.hasOwn(data ?? {}, "reason")).toBe(false);
    expect(harness.counts.trace).toBe(1);
  });

  test("text mode prints verdict=verified with the trace summary", async () => {
    const harness = createDeployHarness();
    const result = await harness.run(undefined, { json: false });
    expect(result.stdout).toContain("verdict=verified");
    expect(result.stdout).toContain("step build succeeded");
    expect(result.stdout).toContain("artifact registry:app@9f21c0e");
  });

  test("the artifact-absent-but-status-success variant is not verified", async () => {
    const harness = createDeployHarness({
      trace: {
        ok: true,
        trace: verifiedTrace({ artifacts: [], status: "success" }),
      },
    });
    const result = await harness.run();
    expect(result.exitCode).toBe(1);
    expect(errorOf(result)?.code).toBe("verify.deploy.trace-missing");
  });
});

describe("TC-DEPLOY-002 created-never-ran reads unknown, never green", () => {
  for (const status of ["success", "queued"]) {
    test(`zero executed steps with status ${status} is unknown at trace-missing`, async () => {
      const harness = createDeployHarness({
        trace: { ok: true, trace: verifiedTrace({ steps: [], artifacts: [], status }) },
      });
      const result = await harness.run(undefined, { json: false });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("verdict=unknown");
      expect(result.stderr).toContain("reason=pipeline-created-never-ran");
      expect(result.stderr).toContain("steps=0");
      expect(result.stderr).not.toContain("verdict=verified");
      const scripted = await harness.run();
      expect(errorOf(scripted)?.code).toBe("verify.deploy.trace-missing");
      expect(JSON.stringify(scripted.envelope)).not.toContain("verified");
      expect(harness.counts.trace).toBe(2);
    });
  }

  test("the executed-step control is verified", async () => {
    const harness = createDeployHarness();
    expect((await harness.run()).exitCode).toBe(0);
  });
});

describe("TC-DEPLOY-003 status fields are never evidence", () => {
  test("a standalone green status with no trace is status-stale", async () => {
    const harness = createDeployHarness({
      trace: {
        ok: true,
        trace: verifiedTrace({ located: false, steps: [], artifacts: [], status: "success" }),
      },
    });
    const result = await harness.run();
    expect(result.exitCode).toBe(1);
    expect(errorOf(result)?.code).toBe("verify.deploy.status-stale");
    expect(String(errorOf(result)?.summary)).toContain("reason=status-stale");
  });

  test("a green status contradicting a failed trace is status-stale, never verified", async () => {
    const harness = createDeployHarness({
      trace: {
        ok: true,
        trace: verifiedTrace({
          status: "success",
          steps: [
            { name: "build", status: "succeeded" },
            { name: "publish", status: "succeeded" },
            { name: "smoke", status: "failed" },
          ],
        }),
      },
    });
    const result = await harness.run();
    expect(result.exitCode).toBe(1);
    expect(errorOf(result)?.code).toBe("verify.deploy.status-stale");
    expect(JSON.stringify(result.envelope)).not.toContain('"verified"');
  });

  test("a red status with a fully green trace is status-stale", async () => {
    const harness = createDeployHarness({
      trace: { ok: true, trace: verifiedTrace({ status: "failure" }) },
    });
    const result = await harness.run();
    expect(result.exitCode).toBe(1);
    expect(errorOf(result)?.code).toBe("verify.deploy.status-stale");
  });

  test("a green status with a zero-step trace never upgrades it to green", async () => {
    const harness = createDeployHarness({
      trace: { ok: true, trace: verifiedTrace({ steps: [], artifacts: [], status: "success" }) },
    });
    const result = await harness.run();
    expect(result.exitCode).toBe(1);
    // Adjudicated per spec v1.1 DEC-10/GAP-2: zero executed steps (including
    // the green-status variant) is pipeline-created-never-ran at
    // verify.deploy.trace-missing, never status-stale. TC-DEPLOY-002 pins the
    // same identity for the identical fixture.
    expect(errorOf(result)?.code).toBe("verify.deploy.trace-missing");
    expect(String(errorOf(result)?.summary)).toContain("reason=pipeline-created-never-ran");
    expect(JSON.stringify(result.envelope)).not.toContain('"verified"');
  });

  test("the green-with-green-trace control is verified", async () => {
    const harness = createDeployHarness();
    expect((await harness.run()).exitCode).toBe(0);
  });
});

describe("TC-DEPLOY-004 a failed trace reads failed with the step named", () => {
  test("exit 1, verdict=failed, smoke named, classified trace-failed", async () => {
    const harness = createDeployHarness({
      trace: {
        ok: true,
        trace: verifiedTrace({
          status: undefined,
          artifacts: [{ name: "registry:app@9f21c0e-partial" }],
          steps: [
            { name: "build", status: "succeeded" },
            { name: "publish", status: "succeeded" },
            { name: "smoke", status: "failed" },
          ],
        }),
      },
    });
    const result = await harness.run(undefined, { json: false });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("verdict=failed");
    expect(result.stderr).toContain("failed-step=smoke");
    const scripted = await harness.run();
    expect(errorOf(scripted)?.code).toBe("verify.deploy.trace-failed");
    expect(JSON.stringify(scripted.envelope)).toContain("registry:app@9f21c0e-partial");
  });

  test("the fully green control verifies", async () => {
    const harness = createDeployHarness();
    expect((await harness.run()).exitCode).toBe(0);
  });
});

describe("TC-DEPLOY-005 absent trace evidence is unknown at exit 1", () => {
  test("no trace located and no expectation is trace-missing, never verified", async () => {
    const harness = createDeployHarness({
      resolve: { ok: true, target: { jobId: "deploy-1", pipelineName: "deploy" } },
      trace: {
        ok: true,
        trace: verifiedTrace({ located: false, steps: [], artifacts: [], status: undefined }),
      },
    });
    const result = await harness.run();
    expect(result.exitCode).toBe(1);
    expect(errorOf(result)?.code).toBe("verify.deploy.trace-missing");
    expect(JSON.stringify(result.envelope)).not.toContain("verified");
  });

  test("no declared expectation fails closed even with a successful trace", async () => {
    const harness = createDeployHarness({
      resolve: { ok: true, target: { jobId: "deploy-1", pipelineName: "deploy" } },
      trace: { ok: true, trace: verifiedTrace() },
    });
    const result = await harness.run();
    expect(result.exitCode).toBe(1);
    expect(errorOf(result)?.code).toBe("verify.deploy.trace-missing");
  });

  test("a no-target resolution is classified with a remediation and no crash", async () => {
    const harness = createDeployHarness({ resolve: { ok: false, kind: "no-target" } });
    const result = await harness.run(undefined, { json: false });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("verdict=unknown");
    expect(result.stderr).toContain("remediation=");
    expect(harness.counts.trace).toBe(0);
  });

  test("the read fault is disjoint: exit 2 vs exit 1", async () => {
    const absent = createDeployHarness({ resolve: { ok: false, kind: "no-target" } });
    const fault = createDeployHarness({
      trace: { ok: false, code: "provider.payload.invalid" },
    });
    expect((await absent.run()).exitCode).toBe(1);
    const faulted = await fault.run();
    expect(faulted.exitCode).toBe(2);
    expect(errorOf(faulted)?.code).toBe("provider.payload.invalid");
    expect(errorOf(faulted)?.category).toBe("platform");
    expect(JSON.stringify(faulted.envelope)).not.toContain("verdict=unknown");
  });
});

describe("TC-DEPLOY-006 a trace read fault is exit 2 with a declared platform row", () => {
  for (const code of ["provider.payload.invalid", "provider.outage"]) {
    test(`${code} is a classified read fault, never a verdict`, async () => {
      const harness = createDeployHarness({ trace: { ok: false, code } });
      const result = await harness.run();
      expect(result.exitCode).toBe(2);
      expect(errorOf(result)?.code).toBe(code);
      expect(Object.hasOwn(result.envelope ?? {}, "data")).toBe(false);
      expect(harness.counts.trace).toBe(1);
    });
  }

  test("the readable-empty control stays at exit 1", async () => {
    const harness = createDeployHarness({
      trace: { ok: true, trace: verifiedTrace({ steps: [], artifacts: [] }) },
    });
    expect((await harness.run()).exitCode).toBe(1);
  });

  test("the expected-artifact list is part of the declared expectation set", () => {
    const expectation = defaultExpectation();
    expect(expectation.source).toBe("configuration");
    expect(expectation.steps).toContain("smoke");
    expect(expectation.artifacts[0]).toContain("registry:app@");
    expect(DEPLOY_REF).toBe("GH-305");
  });
});
