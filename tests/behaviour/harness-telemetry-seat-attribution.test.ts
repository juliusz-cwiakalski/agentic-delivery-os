/**
 * TC-HARNESS-011 — the pinned M3-HARNESS-001 scenario at row grain: one seat per
 * spawn across N spawns, and seat-attributed rows whose models agree (AC-F3-1,
 * AC-F5-1, TDR-0040).
 */
import { describe, expect, test } from "bun:test";
import {
  SINGLE_SEAT_PROFILE,
  SINGLE_SEAT_SELECTION,
  THREE_SEAT_AGENTS,
  THREE_SEAT_PROFILE,
  THREE_SEAT_SELECTION,
} from "../fixtures/harness/profile";
import { createPropagationHarness, valueAfter } from "../fixtures/harness/propagation-harness";
import { SPAWN_ENV_DESCRIPTOR } from "../fixtures/harness/spawn-env";
import {
  CHILD_MODEL_ID,
  ROOT_MODEL_ID,
  buildOpencodeStore,
} from "../fixtures/harness/opencode-store/build";
import { extractOpencode } from "../fixtures/harness/telemetry-attempts";

const spawn = (harness: ReturnType<typeof createPropagationHarness>, agent?: string) =>
  harness.port.spawn({
    workItemRef: "GH-335",
    prompt: "synthetic",
    descriptor: SPAWN_ENV_DESCRIPTOR,
    ...(agent === undefined ? {} : { agent }),
  });

describe("TC-HARNESS-011 seat-attributed rows", () => {
  test("three named agents spawn three sessions, each with its own pair", async () => {
    const harness = createPropagationHarness({
      composed: true,
      versionVerdict: "inside",
      profile: THREE_SEAT_PROFILE,
      selection: THREE_SEAT_SELECTION,
      sessionIds: ["ses-coder", "ses-writer", "ses-reviewer"],
    });
    const sessions: string[] = [];
    for (const agent of THREE_SEAT_AGENTS) {
      const result = await spawn(harness, agent);
      expect(result.ok, agent).toBe(true);
      if (result.ok) sessions.push(result.value.sessionId);
    }
    expect(new Set(sessions).size).toBe(3);
    expect(harness.invocations).toHaveLength(3);
    const models = harness.invocations.map((invocation) => valueAfter(invocation.args, "--model"));
    expect(new Set(models).size).toBe(3);
  });

  test("the rows carry the resolved seats and agree with the observed models", () => {
    const store = buildOpencodeStore({ variant: "multi-group" });
    const captured = extractOpencode({
      store,
      heldSessionIds: store.heldSessionIds,
      bindings: {
        ses_root: { agent: "agent-a", seat: "seat-judgment", resolvedModel: ROOT_MODEL_ID },
        ses_child_a: { agent: "agent-b", seat: "seat-execution", resolvedModel: CHILD_MODEL_ID },
      },
    });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const seats = captured.value.records
      .map((row) => row.seat)
      .filter((seat): seat is string => seat !== null);
    expect(seats.length).toBeGreaterThan(0);
    expect(new Set(seats).size).toBe(seats.length);
    for (const row of captured.value.records) {
      if (row.seat === null) continue;
      expect(row.schemaId).toBe("delivery.harness.telemetry.v1");
      expect(row.resolvedModel).toBe(row.model);
    }
  });

  test("the role-less control binds nothing and still reports the observed identity", async () => {
    const harness = createPropagationHarness({
      composed: true,
      versionVerdict: "inside",
      profile: SINGLE_SEAT_PROFILE,
      selection: SINGLE_SEAT_SELECTION,
    });
    const result = await spawn(harness);
    expect(result.ok).toBe(true);
    expect(harness.invocations[0]?.args).not.toContain("--agent");
    expect(harness.invocations[0]?.args).not.toContain("--model");
  });
});
