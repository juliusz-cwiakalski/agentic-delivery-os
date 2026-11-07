/**
 * TC-HARN-004 — identical classification through both adapters over injected
 * harness I/O, including premature end.
 */
import { describe, expect, test } from "bun:test";
import { canonicalHarnessJson } from "../../packages/core/src/domain/index";
import {
  HARNESS_CONFORMANCE_REGISTRY,
  HARNESS_CONFORMANCE_SCENARIOS,
  type HarnessConformanceDeps,
  type HarnessConformanceRegistration,
  harnessConformanceViolations,
} from "../../packages/testkit/src/conformance/harness";
import {
  assembleLiveness,
  CLAUDE_COMMAND,
  CLAUDE_HEADLESS_ARGS,
  classifier,
  createFakeCredentialPort,
  declaredBuildEnvironment,
  HARNESS_COMMAND,
  LIST_ARGS,
  RESUME_ARGS,
  SPAWN_ARGS,
  TIMEOUT_MS,
} from "../fixtures/harness/harness-io";
import { CLASSIFICATION_SCENARIOS } from "../fixtures/harness/scenarios/classification";

const deps = (command: string, spawnArgs: readonly string[]): HarnessConformanceDeps => ({
  command,
  spawnArgs,
  resumeArgs: RESUME_ARGS,
  listArgs: LIST_ARGS,
  buildEnvironment: declaredBuildEnvironment(createFakeCredentialPort()),
  classify: classifier,
  assembleLiveness,
  now: () => "2026-11-06T00:00:00Z",
  timeoutMs: TIMEOUT_MS,
});

const registration = (kind: "opencode" | "claude-code"): HarnessConformanceRegistration => {
  const found = HARNESS_CONFORMANCE_REGISTRY.find((entry) => entry.kind === kind);
  if (found === undefined) throw new Error(`missing registration ${kind}`);
  return found;
};

const runScenario = async (
  kind: "opencode" | "claude-code",
  scenario: (typeof CLASSIFICATION_SCENARIOS)[number],
) => {
  const entry = registration(kind);
  const io = kind === "opencode" ? scenario.opencode : scenario.claude;
  const session = entry.build(
    io,
    deps(
      kind === "opencode" ? HARNESS_COMMAND : CLAUDE_COMMAND,
      kind === "opencode" ? SPAWN_ARGS : CLAUDE_HEADLESS_ARGS,
    ),
  );
  const spawned = await session.spawn({
    workItemRef: "GH-233",
    prompt: "scenario prompt",
    descriptor: {
      kind: "host",
      workDirectory: "/synthetic/work",
      environment: [],
    },
  });
  expect(spawned.ok).toBe(true);
  if (!spawned.ok) throw new Error("scenario spawn failed");
  const collected = await session.collect({ handle: spawned.value });
  expect(collected.ok).toBe(true);
  if (!collected.ok) throw new Error("scenario collect failed");
  return { evidence: collected.value, classified: session.classify(collected.value) };
};

describe("TC-HARN-004 identical classification", () => {
  test("the case floor is six and both adapters supply every scenario", () => {
    expect(CLASSIFICATION_SCENARIOS).toHaveLength(6);
    expect([...HARNESS_CONFORMANCE_SCENARIOS]).toHaveLength(6);
    expect(harnessConformanceViolations(HARNESS_CONFORMANCE_REGISTRY)).toEqual([]);
  });

  test("each scenario classifies identically on both adapters and matches its token", async () => {
    for (const scenario of CLASSIFICATION_SCENARIOS) {
      expect(JSON.stringify(scenario.opencode)).not.toBe(JSON.stringify(scenario.claude));
      const opencode = await runScenario("opencode", scenario);
      const claude = await runScenario("claude-code", scenario);
      expect(opencode.classified.token, scenario.id).toBe(scenario.expectedToken);
      expect(claude.classified.token, scenario.id).toBe(scenario.expectedToken);
      expect(opencode.classified.token).toBe(claude.classified.token);
      expect(opencode.classified.outcome).toBe(claude.classified.outcome);
    }
  });

  test("premature end is distinct from completed and failed on both adapters", async () => {
    const scenarios = new Map(CLASSIFICATION_SCENARIOS.map((scenario) => [scenario.id, scenario]));
    for (const kind of ["opencode", "claude-code"] as const) {
      const premature = await runScenario(kind, scenarios.get("premature-end") as never);
      const completed = await runScenario(kind, scenarios.get("completed") as never);
      const failed = await runScenario(kind, scenarios.get("harness-failure") as never);
      expect(premature.classified.outcome).toBe("premature-end");
      expect(
        new Set([premature.classified.token, completed.classified.token, failed.classified.token])
          .size,
      ).toBe(3);
    }
  });

  test("the evidence is the neutral shape with no token inside it", async () => {
    for (const scenario of CLASSIFICATION_SCENARIOS) {
      for (const kind of ["opencode", "claude-code"] as const) {
        const { evidence, classified } = await runScenario(kind, scenario);
        const keys = Object.keys(evidence)
          .filter((key) => key !== "warnings")
          .sort();
        expect(keys, `${kind}/${scenario.id}`).toEqual([
          "completionMarker",
          "exitStatus",
          "failureReported",
          "spawnRefused",
          "timedOut",
          "toolFailure",
        ]);
        expect(JSON.stringify(evidence)).not.toContain(classified.token);
      }
    }
  });

  test("both adapters expose the same classifier reference and replay identically", async () => {
    const opencode = registration("opencode");
    const claude = registration("claude-code");
    const scenario = CLASSIFICATION_SCENARIOS[0] as (typeof CLASSIFICATION_SCENARIOS)[number];
    const opencodeSession = opencode.build(scenario.opencode, deps(HARNESS_COMMAND, SPAWN_ARGS));
    const claudeSession = claude.build(scenario.claude, deps(CLAUDE_COMMAND, CLAUDE_HEADLESS_ARGS));
    expect(opencodeSession.classify).toBe(claudeSession.classify);

    const first = await runScenario("opencode", scenario);
    const second = await runScenario("opencode", scenario);
    expect(canonicalHarnessJson(first.evidence)).toBe(canonicalHarnessJson(second.evidence));
    expect(first.classified.token).toBe(second.classified.token);
  });

  test("the coverage meta-check fails a registered harness with no case", () => {
    const broken: HarnessConformanceRegistration[] = HARNESS_CONFORMANCE_REGISTRY.map((entry) =>
      entry.kind === "claude-code" ? { ...entry, scenarios: ["completed"] } : entry,
    );
    const violations = harnessConformanceViolations(broken);
    expect(violations.join("\n")).toContain("claude-code: missing classification scenario timeout");
  });
});
