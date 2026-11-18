/**
 * TC-HARNESS-011 — one seat per spawn across N spawns, driven through the port
 * and resolved by the composition (DEC-16, DEC-15, TDR-0040).
 *
 * The test supplies the agent identity as the caller; the composition calls the
 * pure resolver once per spawn and supplies its returned single-seat binding on
 * the sibling member. The oracle is the recorded invocation arguments — never a
 * binding the fixture built.
 */
import { describe, expect, test } from "bun:test";
import type { HarnessBindingResolution } from "../../packages/core/src/domain/index";
import { DECLARED_VARIABLES, SPAWN_ENV_DESCRIPTOR } from "../fixtures/harness/spawn-env";
import {
  THREE_SEAT_AGENTS,
  THREE_SEAT_PROFILE,
  THREE_SEAT_SELECTION,
} from "../fixtures/harness/profile";
import {
  agentArgs,
  createPropagationHarness,
  modelArgs,
  valueAfter,
} from "../fixtures/harness/propagation-harness";

const EXPECTED_MODEL: Readonly<Record<string, string>> = {
  coder: "zai/glm-5#judgment",
  writer: "deepseek/deepseek-flash",
  reviewer: "openrouter/qwen3-coder#thinking",
};

const spawnAgent = (harness: ReturnType<typeof createPropagationHarness>, agent?: string) =>
  harness.port.spawn({
    workItemRef: "GH-335",
    prompt: "synthetic",
    descriptor: SPAWN_ENV_DESCRIPTOR,
    ...(agent === undefined ? {} : { agent }),
  });

describe("TC-HARNESS-011 one seat per spawn", () => {
  test("three named agents produce three spawns, each with exactly its own pair", async () => {
    const harness = createPropagationHarness({
      composed: true,
      versionVerdict: "inside",
      profile: THREE_SEAT_PROFILE,
      selection: THREE_SEAT_SELECTION,
      sessionIds: ["ses-coder", "ses-writer", "ses-reviewer"],
    });
    const handles = [];
    for (const agent of THREE_SEAT_AGENTS) {
      const result = await spawnAgent(harness, agent);
      expect(result.ok, agent).toBe(true);
      if (result.ok) handles.push(result.value);
    }
    expect(handles).toHaveLength(3);
    expect(new Set(handles.map((handle) => handle.sessionId)).size).toBe(3);
    expect(harness.invocations).toHaveLength(3);
    for (const [index, agent] of THREE_SEAT_AGENTS.entries()) {
      const args = harness.invocations[index]?.args ?? [];
      expect(agentArgs(harness.invocations[index]), agent).toHaveLength(1);
      expect(modelArgs(harness.invocations[index]), agent).toHaveLength(1);
      expect(valueAfter(args, "--agent"), agent).toBe(agent);
      expect(valueAfter(args, "--model"), agent).toBe(EXPECTED_MODEL[agent]);
    }
    // The child environment gained no per-seat variable: exactly the declared set.
    for (const invocation of harness.invocations) {
      expect(Object.keys(invocation.options.env).sort()).toEqual([...DECLARED_VARIABLES].sort());
    }
  });

  test("the binding that reaches the invocation is the resolver's own return value", async () => {
    const calls: { agent: string | undefined }[] = [];
    const resolver = (
      _profile: typeof THREE_SEAT_PROFILE,
      _selection: typeof THREE_SEAT_SELECTION,
      agent?: string,
    ): HarnessBindingResolution => {
      calls.push({ agent });
      return {
        outcome: "binding",
        binding: {
          agent: agent ?? "",
          seat: "seat-from-double",
          resolvedModel: "synthetic/resolved-from-double#v",
        },
      };
    };
    const harness = createPropagationHarness({
      composed: true,
      versionVerdict: "inside",
      profile: THREE_SEAT_PROFILE,
      selection: THREE_SEAT_SELECTION,
      resolve: resolver,
    });
    const result = await spawnAgent(harness, "coder");
    expect(result.ok).toBe(true);
    expect(calls).toEqual([{ agent: "coder" }]);
    const args = harness.invocations[0]?.args ?? [];
    expect(valueAfter(args, "--agent")).toBe("coder");
    expect(valueAfter(args, "--model")).toBe("synthetic/resolved-from-double#v");
  });

  test("a present empty-string agent is not the no-agent state and is never sent", async () => {
    const harness = createPropagationHarness({
      composed: true,
      versionVerdict: "inside",
      profile: THREE_SEAT_PROFILE,
      selection: THREE_SEAT_SELECTION,
    });
    const result = await spawnAgent(harness, "");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("config.value.invalid");
    expect(result.error.field).toBe("agent");
    expect(harness.invocations).toHaveLength(0);
  });

  test("a role-less spawn binds nothing and sends neither flag", async () => {
    const harness = createPropagationHarness({
      composed: true,
      versionVerdict: "inside",
      profile: THREE_SEAT_PROFILE,
      selection: THREE_SEAT_SELECTION,
    });
    const result = await spawnAgent(harness);
    expect(result.ok).toBe(true);
    expect(harness.invocations).toHaveLength(1);
    expect(agentArgs(harness.invocations[0])).toHaveLength(0);
    expect(modelArgs(harness.invocations[0])).toHaveLength(0);
  });
});
