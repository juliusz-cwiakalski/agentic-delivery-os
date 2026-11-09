/**
 * TC-HDA-010 / TC-HDA-012 / TC-HDA-015 / TC-HDA-016 / TC-HDA-017 — the shipped
 * default allowlist starts a synthetic `opencode` on a controlled `PATH`, the
 * real child receives exactly the declared and present entries, no undeclared
 * ambient variable leaks, and the optional TMPDIR pair forwards or omits.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import type { DeliveryResultToken } from "../../packages/core/src/contracts/index";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import {
  createControlledParent,
  createSyntheticOpencode,
  expectedChildKeys,
  legacyDefaultDescriptor,
  readArgvDump,
  readEnvironmentDump,
  repairedDefaultDescriptor,
} from "../fixtures/harness/default-spawn";

const invoke = async (
  options: Parameters<typeof createCommandScenario>[0],
): Promise<{
  readonly scenario: ReturnType<typeof createCommandScenario>;
  readonly run: Awaited<ReturnType<ReturnType<typeof createCommandScenario>["invoke"]>>;
}> => {
  const scenario = createCommandScenario(options);
  return { scenario, run: await scenario.invoke(["dispatch", "GH-277", "--json"]) };
};

describe("TC-HDA-010 zero-configuration default spawn over a synthetic opencode", () => {
  test("the repaired default spawns the fake CLI, records one attempt, and classifies", async () => {
    const controlled = createControlledParent();
    try {
      const descriptor = repairedDefaultDescriptor(controlled.workDirectory);
      const synthetic = createSyntheticOpencode({
        parentEnvironment: controlled.parentEnvironment,
      });
      const { scenario, run } = await invoke({
        harnessPort: synthetic.port,
        descriptor,
        prompt: (ref) => `deliver ${ref}`,
      });
      try {
        expect(run.envelope?.data?.result).toBeDefined();
        const result = run.envelope?.data?.result as DeliveryResultToken;
        expect(result).not.toBe("dispatch.session.spawn-failed");
        expect(run.envelope?.data?.outcome).toBeDefined();

        const read = readDispatchAttempts(scenario.state.store);
        expect(read.ok).toBe(true);
        if (!read.ok) return;
        expect(read.records).toHaveLength(1);
        expect(read.records[0]?.token).toBe(run.envelope?.data?.result);
        expect(read.records[0]?.outcome).toBe(run.envelope?.data?.outcome);
        expect((read.records[0]?.attemptId ?? "").length).toBeGreaterThan(0);

        expect(existsSync(controlled.markerPath)).toBe(true);
        const child = readEnvironmentDump(controlled);
        expect(Object.keys(child).sort()).toEqual([...expectedChildKeys({ tmpdirPresent: false })]);
        expect(child.DELIVERY_WORK_PATH).toBe(descriptor.workDirectory);
        expect(child.DELIVERY_WORK_PATH).not.toBe(controlled.canaries.DELIVERY_WORK_PATH);

        // Bare command and delivered spawn args, never an absolute command path.
        expect(synthetic.starterCalls[0]?.file).toBe("opencode");
        expect(synthetic.starterCalls[0]?.file).not.toContain("/");
        expect(synthetic.starterCalls[0]?.args).toEqual(["run", "--format", "json"]);
        expect(synthetic.starterCalls[0]?.args.some((arg) => arg.startsWith("/"))).toBe(false);
        const argv = readArgvDump(controlled);
        expect(argv.some((arg) => arg.endsWith("/opencode") || arg === "opencode")).toBe(true);

        // No ambient leakage: canaries, OC_ADOS_*, and synthesized HARNESS_* names.
        for (const name of Object.keys(controlled.canaries)) {
          expect(Object.hasOwn(child, name)).toBe(false);
        }
        expect(Object.hasOwn(child, "HARNESS_MODEL")).toBe(false);
        expect(Object.hasOwn(child, "HARNESS_SMALL_MODEL")).toBe(false);
        const serialized = JSON.stringify(child);
        for (const value of Object.values(controlled.canaries)) {
          expect(serialized).not.toContain(value);
        }
      } finally {
        scenario.dispose();
      }
    } finally {
      controlled.dispose();
    }
  });

  test("the pre-change descriptor still fails closed with the named model variable", async () => {
    const controlled = createControlledParent();
    try {
      const descriptor = legacyDefaultDescriptor(controlled.workDirectory);
      const synthetic = createSyntheticOpencode({
        parentEnvironment: controlled.parentEnvironment,
      });
      const { scenario, run } = await invoke({ harnessPort: synthetic.port, descriptor });
      try {
        expect(run.envelope?.data?.result).toBe("failed");
        expect(run.envelope?.data?.error?.code).toBe("dispatch.session.spawn-failed");
        expect(run.envelope?.data?.error?.detail).toEqual({
          kind: "harness",
          code: "harness.spawn.variable-missing",
          field: "HARNESS_MODEL",
        });
        expect(existsSync(controlled.markerPath)).toBe(false);
      } finally {
        scenario.dispose();
      }
    } finally {
      controlled.dispose();
    }
  });
});

describe("TC-HDA-012 deny-by-default in the real child", () => {
  test("the child key set is exactly the declared and present set", async () => {
    const controlled = createControlledParent();
    try {
      const descriptor = repairedDefaultDescriptor(controlled.workDirectory);
      const synthetic = createSyntheticOpencode({
        parentEnvironment: controlled.parentEnvironment,
      });
      const { scenario, run } = await invoke({ harnessPort: synthetic.port, descriptor });
      try {
        expect(run.envelope?.data?.result).not.toBe("dispatch.session.spawn-failed");
        const child = readEnvironmentDump(controlled);
        expect(Object.keys(child).sort()).toEqual([...expectedChildKeys({ tmpdirPresent: false })]);
        expect(JSON.stringify(child)).not.toContain(controlled.canaries.SYNTHETIC_UNDECLARED_TOKEN);
        expect(JSON.stringify(child)).not.toContain(controlled.canaries.OC_ADOS_MAIN_MODEL);
        expect(JSON.stringify(child)).not.toContain(controlled.canaries.OC_ADOS_SMALL_MODEL);
      } finally {
        scenario.dispose();
      }
    } finally {
      controlled.dispose();
    }
  });
});

describe("TC-HDA-015 / TC-HDA-016 the optional TMPDIR pair", () => {
  test("absent TMPDIR is omitted and does not abort the spawn", async () => {
    const controlled = createControlledParent();
    try {
      const descriptor = repairedDefaultDescriptor(controlled.workDirectory);
      const synthetic = createSyntheticOpencode({
        parentEnvironment: controlled.parentEnvironment,
      });
      const { scenario, run } = await invoke({ harnessPort: synthetic.port, descriptor });
      try {
        expect(run.envelope?.data?.result).not.toBe("dispatch.session.spawn-failed");
        const child = readEnvironmentDump(controlled);
        expect(Object.hasOwn(child, "TMPDIR")).toBe(false);
        expect(child.TMPDIR).toBeUndefined();
      } finally {
        scenario.dispose();
      }
    } finally {
      controlled.dispose();
    }
  });

  test("present TMPDIR is forwarded unchanged through the child", async () => {
    const controlled = createControlledParent({ tmpdirValue: "/synthetic/tmp-gh277" });
    try {
      const descriptor = repairedDefaultDescriptor(controlled.workDirectory);
      const synthetic = createSyntheticOpencode({
        parentEnvironment: controlled.parentEnvironment,
      });
      const { scenario, run } = await invoke({ harnessPort: synthetic.port, descriptor });
      try {
        expect(run.envelope?.data?.result).not.toBe("dispatch.session.spawn-failed");
        const child = readEnvironmentDump(controlled);
        expect(child.TMPDIR).toBe("/synthetic/tmp-gh277");
        expect(Object.keys(child).sort()).toEqual([...expectedChildKeys({ tmpdirPresent: true })]);
      } finally {
        scenario.dispose();
      }
    } finally {
      controlled.dispose();
    }
  });
});
