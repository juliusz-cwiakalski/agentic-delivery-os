/**
 * TC-HARNESS-033 / TC-HARNESS-034 — the extension scenarios execute through the
 * additive executor beside the delivered registry and prove their property
 * (AC-F7-2, AC-F7-3, OQ-9, OQ-12).
 */
import { describe, expect, test } from "bun:test";
import {
  DEFAULT_HARNESS_MODE,
  type HarnessSeatBinding,
} from "../../packages/core/src/contracts/index";
import {
  HARNESS_CONFORMANCE_EXTENSION_SCENARIOS,
  HARNESS_CONFORMANCE_REGISTRY,
  type HarnessConformanceFacts,
  runHarnessConformanceScenario,
} from "../../packages/testkit/src/conformance/harness";

const registration = HARNESS_CONFORMANCE_REGISTRY.find((entry) => entry.kind === "opencode");
if (registration === undefined) throw new Error("the opencode registration is required");

const BINDING: HarnessSeatBinding = {
  agent: "coder",
  seat: "seat-judgment",
  resolvedModel: "zai/glm-5#judgment",
};

const baseFacts = (overrides: Partial<HarnessConformanceFacts> = {}): HarnessConformanceFacts => ({
  probeOutcome: { status: "answered", stdout: "opencode v2.3.2" },
  requestedMode: DEFAULT_HARNESS_MODE,
  ...overrides,
});

const run = (
  scenarioId: (typeof HARNESS_CONFORMANCE_EXTENSION_SCENARIOS)[number],
  facts: HarnessConformanceFacts,
) => runHarnessConformanceScenario({ registration, scenarioId, facts });

describe("TC-HARNESS-033 the extension scenarios", () => {
  test("version-window asserts both directions", () => {
    expect(run("version-window", baseFacts()).verdict).toBe("satisfied");
    const outside = run(
      "version-window",
      baseFacts({ probeOutcome: { status: "answered", stdout: "opencode v2.1.7" } }),
    );
    expect(outside.verdict).toBe("satisfied");
    expect(outside.versionVerdict).toBe("outside");
  });

  test("version-unknown asserts the unknown identity with a null version", () => {
    const timedOut = run("version-unknown", baseFacts({ probeOutcome: { status: "timed-out" } }));
    expect(timedOut.verdict).toBe("satisfied");
    expect(timedOut.observedVersion).toBeNull();
    expect(timedOut.versionVerdict).toBe("indeterminate");
  });

  test("mode-unavailable asserts the identity and the requested mode", () => {
    const refused = run(
      "mode-unavailable",
      baseFacts({ requestedMode: "managed-background-service" }),
    );
    expect(refused.verdict).toBe("satisfied");
  });

  test("profile-propagation asserts one pair per invocation and the binding", () => {
    const satisfied = run(
      "profile-propagation",
      baseFacts({
        agent: "coder",
        binding: BINDING,
        invocationArgs: ["--agent", "coder", "--model", "zai/glm-5#judgment"],
      }),
    );
    expect(satisfied.verdict).toBe("satisfied");

    const doubled = run(
      "profile-propagation",
      baseFacts({
        agent: "coder",
        binding: BINDING,
        invocationArgs: ["--agent", "coder", "--model", "zai/glm-5#judgment", "--agent", "writer"],
      }),
    );
    expect(doubled.verdict).toBe("mismatch");
    expect(doubled.reasons.join(" ")).toContain("exactly one --agent");
  });

  test("a role-less spawn binds nothing, and a doubled model pair fails too", () => {
    expect(run("profile-propagation", baseFacts({ invocationArgs: [] })).verdict).toBe("satisfied");
    const doubled = run(
      "profile-propagation",
      baseFacts({
        agent: "coder",
        binding: BINDING,
        invocationArgs: [
          "--agent",
          "coder",
          "--model",
          "zai/glm-5#judgment",
          "--model",
          "deepseek/deepseek-flash",
        ],
      }),
    );
    expect(doubled.verdict).toBe("mismatch");
  });

  test("every extension scenario is declared by the registration and runs offline", () => {
    for (const scenario of HARNESS_CONFORMANCE_EXTENSION_SCENARIOS) {
      expect(registration.extensionScenarios).toContain(scenario);
    }
    // No live harness, store, or socket: the executor is pure over injected data.
    expect(run("version-window", baseFacts()).reasons).toEqual([]);
  });

  test("a floor id is refused by the executor, and an unregistered id fails naming both", () => {
    const floor = runHarnessConformanceScenario({
      registration,
      scenarioId: "completed",
      facts: baseFacts(),
    });
    expect(floor.verdict).toBe("mismatch");
    const mutant = { ...registration, extensionScenarios: [] };
    const missing = runHarnessConformanceScenario({
      registration: mutant,
      scenarioId: "mode-unavailable",
      facts: baseFacts({ requestedMode: "managed-background-service" }),
    });
    expect(missing.verdict).toBe("mismatch");
    expect(missing.reasons.join(" ")).toContain("opencode");
    expect(missing.reasons.join(" ")).toContain("mode-unavailable");
  });
});
