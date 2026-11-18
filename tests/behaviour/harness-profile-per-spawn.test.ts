/**
 * TC-HARNESS-015 — propagation is per spawn, not process-global, and a role-less
 * spawn binds nothing in any profile shape (AC-F3-1, AC-F3-2, TDR-0036 A-1).
 */
import { describe, expect, test } from "bun:test";
import type { HarnessBindingResolution } from "../../packages/core/src/domain/index";
import {
  SINGLE_SEAT_PROFILE,
  SINGLE_SEAT_SELECTION,
  THREE_SEAT_PROFILE,
  THREE_SEAT_SELECTION,
} from "../fixtures/harness/profile";
import { createPropagationHarness, valueAfter } from "../fixtures/harness/propagation-harness";
import { SPAWN_ENV_DESCRIPTOR } from "../fixtures/harness/spawn-env";

const MODEL_OF: Readonly<Record<string, string>> = {
  coder: "zai/glm-5#judgment",
  writer: "deepseek/deepseek-flash",
};

const spawn = (harness: ReturnType<typeof createPropagationHarness>, agent?: string) =>
  harness.port.spawn({
    workItemRef: "GH-335",
    prompt: "synthetic",
    descriptor: SPAWN_ENV_DESCRIPTOR,
    ...(agent === undefined ? {} : { agent }),
  });

const pairOf = (harness: ReturnType<typeof createPropagationHarness>, index: number) => {
  const args = harness.invocations[index]?.args ?? [];
  return { agent: valueAfter(args, "--agent"), model: valueAfter(args, "--model") };
};

describe("TC-HARNESS-015 per-spawn propagation", () => {
  test("successive spawns bind their own seats, and reverse order follows the agent", async () => {
    const harness = createPropagationHarness({
      composed: true,
      versionVerdict: "inside",
      profile: THREE_SEAT_PROFILE,
      selection: THREE_SEAT_SELECTION,
    });
    expect((await spawn(harness, "coder")).ok).toBe(true);
    expect((await spawn(harness, "writer")).ok).toBe(true);
    expect(pairOf(harness, 0)).toEqual({ agent: "coder", model: MODEL_OF.coder });
    expect(pairOf(harness, 1)).toEqual({ agent: "writer", model: MODEL_OF.writer });

    const reversed = createPropagationHarness({
      composed: true,
      versionVerdict: "inside",
      profile: THREE_SEAT_PROFILE,
      selection: THREE_SEAT_SELECTION,
    });
    expect((await spawn(reversed, "writer")).ok).toBe(true);
    expect((await spawn(reversed, "coder")).ok).toBe(true);
    expect(pairOf(reversed, 0)).toEqual({ agent: "writer", model: MODEL_OF.writer });
    expect(pairOf(reversed, 1)).toEqual({ agent: "coder", model: MODEL_OF.coder });
  });

  test("concurrent spawns are not contaminated by each other", async () => {
    const harness = createPropagationHarness({
      composed: true,
      versionVerdict: "inside",
      profile: THREE_SEAT_PROFILE,
      selection: THREE_SEAT_SELECTION,
    });
    const [first, second] = await Promise.all([spawn(harness, "coder"), spawn(harness, "writer")]);
    expect(first.ok && second.ok).toBe(true);
    const agents = harness.invocations.map((invocation) => valueAfter(invocation.args, "--agent"));
    expect(agents.sort()).toEqual(["coder", "writer"]);
  });

  test("the named single-seat spawn sends the agent identity, never the seat name", async () => {
    const harness = createPropagationHarness({
      composed: true,
      versionVerdict: "inside",
      profile: SINGLE_SEAT_PROFILE,
      selection: SINGLE_SEAT_SELECTION,
    });
    expect((await spawn(harness, "coder")).ok).toBe(true);
    expect(pairOf(harness, 0)).toEqual({ agent: "coder", model: "zai/glm-5#judgment" });
    expect(harness.invocations[0]?.args).not.toContain("sole-seat");
  });

  test("a role-less spawn binds nothing against a multi-seat AND the single-seat profile", async () => {
    for (const fixture of [
      { profile: THREE_SEAT_PROFILE, selection: THREE_SEAT_SELECTION },
      { profile: SINGLE_SEAT_PROFILE, selection: SINGLE_SEAT_SELECTION },
    ]) {
      const harness = createPropagationHarness({
        composed: true,
        versionVerdict: "inside",
        profile: fixture.profile,
        selection: fixture.selection,
      });
      const result = await spawn(harness);
      expect(result.ok).toBe(true);
      expect(pairOf(harness, 0)).toEqual({ agent: undefined, model: undefined });
    }
  });

  test("the resolver is the composition's call site, once per named spawn", async () => {
    const calls: (string | undefined)[] = [];
    const resolver = (
      _profile: typeof THREE_SEAT_PROFILE,
      _selection: typeof THREE_SEAT_SELECTION,
      agent?: string,
    ): HarnessBindingResolution => {
      calls.push(agent);
      return {
        outcome: "binding",
        binding: {
          agent: agent ?? "",
          seat: "seat-from-double",
          resolvedModel: "synthetic/double#v",
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
    expect((await spawn(harness, "coder")).ok).toBe(true);
    expect(calls).toEqual(["coder"]);
    expect(pairOf(harness, 0)).toEqual({ agent: "coder", model: "synthetic/double#v" });
  });
});
