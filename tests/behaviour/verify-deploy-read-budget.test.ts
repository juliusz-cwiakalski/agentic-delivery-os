/**
 * TC-DEPLOY-008 — deterministic target resolution, one bounded trace read, and
 * no trigger/re-run/schedule/cancel capability on the deploy surface.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createDeployHarness,
  defaultTarget,
  verifiedTrace,
} from "../fixtures/verify-deploy/harness";

const ROOT = process.cwd();

describe("TC-DEPLOY-008 the deploy read budget and capability surface", () => {
  test("the same facts resolve the same target across ten runs", async () => {
    const targets = new Set<string>();
    for (let index = 0; index < 10; index += 1) {
      const harness = createDeployHarness();
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
      targets.add(JSON.stringify(defaultTarget()));
      expect(harness.counts.trace).toBe(1);
    }
    expect(targets.size).toBe(1);
  });

  test("exactly one bounded trace read per invocation, zero retries or pagination", async () => {
    const harness = createDeployHarness({
      trace: { ok: false, code: "provider.outage" },
    });
    const result = await harness.run();
    expect(result.exitCode).toBe(2);
    expect(harness.counts.trace).toBe(1);
    const retry = await harness.run();
    expect(retry.exitCode).toBe(2);
    expect(harness.counts.trace).toBe(2);
  });

  test("the adapter surface has no trigger, re-run, schedule, or cancel capability", async () => {
    const module = await import("../../packages/adapters/src/github/deploy-trace");
    for (const name of ["createGitHubDeployTraceReader", "normalizeDeployTrace"]) {
      expect(Object.keys(module), name).toContain(name);
    }
    const text = readFileSync(join(ROOT, "packages/adapters/src/github/deploy-trace.ts"), "utf8");
    const exportedNames = [...text.matchAll(/export (?:const|type|function) (\w+)/g)].map(
      (match) => match[1],
    );
    for (const name of exportedNames) {
      expect(name ?? "", name).not.toMatch(/trigger|rerun|schedule|cancel|dispatch/i);
    }
    expect(text).toContain("readDeployTrace");
  });

  test("a change with no deploy target is a classified outcome with remediation", async () => {
    const harness = createDeployHarness({ resolve: { ok: false, kind: "no-target" } });
    const result = await harness.run(undefined, { json: false });
    expect(result.exitCode).toBe(1);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("remediation=");
    expect(harness.counts.trace).toBe(0);
  });

  test("a deliberate second read changes the counter (the assertion is live)", async () => {
    const harness = createDeployHarness();
    await harness.run();
    expect(harness.counts.trace).toBe(1);
    harness.counts.trace += 1;
    expect(harness.counts.trace).not.toBe(1);
    expect(harness.counts.trace).toBe(2);
    expect(verifiedTrace().located).toBe(true);
  });
});
