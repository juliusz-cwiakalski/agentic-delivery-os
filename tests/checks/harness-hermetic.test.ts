/**
 * TC-HARNESS-039 / TC-HARNESS-034 — the whole change's automated surface runs
 * offline: no live harness process, no real store, no socket, no credential
 * resolution, no user state directory, and no process-global child-process mock
 * (NFR-10).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const NEW_SUITES = [
  "tests/behaviour/harness-version-window.test.ts",
  "tests/behaviour/harness-version-probe-seam.test.ts",
  "tests/behaviour/harness-mode-config.test.ts",
  "tests/behaviour/harness-mode-selection.test.ts",
  "tests/behaviour/harness-mode-refusal.test.ts",
  "tests/behaviour/harness-version-gate.test.ts",
  "tests/behaviour/harness-profile-precedence.test.ts",
  "tests/behaviour/harness-profile-neutrality.test.ts",
  "tests/behaviour/harness-profile-propagation.test.ts",
  "tests/behaviour/harness-profile-unrepresentable.test.ts",
  "tests/behaviour/harness-resume-propagation.test.ts",
  "tests/behaviour/harness-attach.test.ts",
  "tests/behaviour/harness-telemetry-shape.test.ts",
  "tests/behaviour/harness-telemetry-generation.test.ts",
  "tests/behaviour/harness-telemetry-attribution.test.ts",
  "tests/behaviour/harness-telemetry-observed-axis-absence.test.ts",
  "tests/conformance/harness-extension-scenarios.test.ts",
  "tests/structure/harness-probe-construction-site.test.ts",
  "tests/checks/fixture-store-shape.test.ts",
];

const FORBIDDEN = [
  "node:net",
  "node:http",
  "node:https",
  "mock.module",
  "child_process",
  "spawnSync",
  "realpathSync(process.env.HOME",
  "process.env.ANTHROPIC",
] as const;

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

describe("TC-HARNESS-039 offline posture", () => {
  test("no new suite opens a socket, mocks a child process, or reads a credential", () => {
    for (const file of NEW_SUITES) {
      const text = read(file);
      expect(text.length).toBeGreaterThan(0);
      for (const forbidden of FORBIDDEN) {
        expect(text, `${file}: ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  test("the harness extractors read only the injected opener and the injected clock", () => {
    for (const file of [
      "packages/adapters/src/harness/telemetry-opencode.ts",
      "packages/adapters/src/harness/telemetry-session-totals.ts",
      "packages/adapters/src/harness/sqlite-loader.ts",
    ]) {
      const text = read(file);
      expect(text).not.toContain("process.env");
      expect(text).not.toContain('from "node:net"');
      expect(text).not.toContain('from "bun:test"');
    }
  });

  test("the conformance extension executes with zero live invocations", async () => {
    const { HARNESS_CONFORMANCE_REGISTRY, runHarnessConformanceScenario } = await import(
      "../../packages/testkit/src/conformance/harness"
    );
    const registration = HARNESS_CONFORMANCE_REGISTRY[0];
    if (registration === undefined) throw new Error("registration missing");
    const outcome = runHarnessConformanceScenario({
      registration,
      scenarioId: "version-window",
      facts: {
        probeOutcome: { status: "answered", stdout: "opencode v2.3.2" },
        requestedMode: "per-invocation-private-server",
      },
    });
    expect(outcome.verdict).toBe("satisfied");
  });
});
