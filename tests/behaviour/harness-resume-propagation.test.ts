/**
 * TC-HARNESS-016 / TC-HARNESS-017 — spawn, deliver and resume share one
 * propagation contract, and a resume continues identity and tree root.
 */
import { describe, expect, test } from "bun:test";
import { canonicalHarnessJson } from "../../packages/core/src/domain/harness-canonical";
import { SINGLE_SEAT_PROFILE, SINGLE_SEAT_SELECTION } from "../fixtures/harness/profile";
import { createPropagationHarness } from "../fixtures/harness/propagation-harness";
import { SPAWN_ENV_DESCRIPTOR } from "../fixtures/harness/spawn-env";

const AGENT = "coder";
const MODEL = "zai/glm-5#judgment";

const pairOf = (args: readonly string[]): string =>
  canonicalHarnessJson({
    agent: args[args.indexOf("--agent") + 1],
    model: args[args.indexOf("--model") + 1],
  });

describe("TC-HARNESS-016 one propagation contract", () => {
  test("spawn, deliver and resume each carry exactly the same single pair", async () => {
    const harness = createPropagationHarness({
      composed: true,
      versionVerdict: "inside",
      profile: SINGLE_SEAT_PROFILE,
      selection: SINGLE_SEAT_SELECTION,
    });
    const spawned = await harness.port.spawn({
      workItemRef: "GH-335",
      prompt: "synthetic",
      descriptor: SPAWN_ENV_DESCRIPTOR,
      agent: AGENT,
    });
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    const delivered = await harness.port.deliver({
      handle: spawned.value,
      prompt: "synthetic",
      descriptor: SPAWN_ENV_DESCRIPTOR,
      agent: AGENT,
    });
    expect(delivered.ok).toBe(true);
    const resumed = await harness.port.resume({
      handle: spawned.value,
      prompt: "synthetic",
      descriptor: SPAWN_ENV_DESCRIPTOR,
      agent: AGENT,
    });
    expect(resumed.ok).toBe(true);
    expect(harness.invocations).toHaveLength(3);
    const pairs = harness.invocations.map((invocation) => pairOf(invocation.args));
    expect(new Set(pairs).size).toBe(1);
    expect(pairs[0]).toBe(canonicalHarnessJson({ agent: AGENT, model: MODEL }));
    for (const invocation of harness.invocations) {
      expect(invocation.args.filter((value) => value === "--agent")).toHaveLength(1);
      expect(invocation.args.filter((value) => value === "--model")).toHaveLength(1);
      expect(invocation.args.filter((value) => value === AGENT)).toHaveLength(1);
    }
  });

  test("a resume that supplies no binding reuses its spawn's single binding", async () => {
    const harness = createPropagationHarness({
      composed: true,
      versionVerdict: "inside",
      profile: SINGLE_SEAT_PROFILE,
      selection: SINGLE_SEAT_SELECTION,
    });
    const spawned = await harness.port.spawn({
      workItemRef: "GH-335",
      prompt: "synthetic",
      descriptor: SPAWN_ENV_DESCRIPTOR,
      agent: AGENT,
    });
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    const resumed = await harness.port.resume({
      handle: spawned.value,
      prompt: "synthetic",
      descriptor: SPAWN_ENV_DESCRIPTOR,
    });
    expect(resumed.ok).toBe(true);
    const args = harness.invocations[1]?.args ?? [];
    expect(args[args.indexOf("--agent") + 1]).toBe(AGENT);
    expect(args[args.indexOf("--model") + 1]).toBe(MODEL);
    // No seat is added by the resume.
    expect(args.filter((value) => value === "--agent")).toHaveLength(1);
  });
});

describe("TC-HARNESS-017 resume continues identity and tree root", () => {
  test("the resumed handle keeps the session identity and the tree root", async () => {
    const harness = createPropagationHarness({
      composed: true,
      versionVerdict: "inside",
      profile: SINGLE_SEAT_PROFILE,
      selection: SINGLE_SEAT_SELECTION,
      sessionIds: ["ses-continued"],
    });
    const spawned = await harness.port.spawn({
      workItemRef: "GH-335",
      prompt: "synthetic",
      descriptor: SPAWN_ENV_DESCRIPTOR,
      agent: AGENT,
    });
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    const resumed = await harness.port.resume({
      handle: spawned.value,
      prompt: "synthetic",
      descriptor: SPAWN_ENV_DESCRIPTOR,
      agent: AGENT,
    });
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.value.sessionId).toBe(spawned.value.sessionId);
    expect(resumed.value.treeRoot).toBe(spawned.value.treeRoot);
    expect(resumed.value.workItemRef).toBe("GH-335");
    const collected = await harness.port.collect({ handle: resumed.value });
    expect(collected.ok).toBe(true);
  });
});
