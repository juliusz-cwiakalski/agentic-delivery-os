/**
 * TC-HARNESS-014 — the two pre-session profile refusals (M-05, M-11).
 *
 * An unrepresentable seat model refuses through
 * `harness.profile.model-unrepresentable`; an unassigned named agent refuses
 * through the delivered `provider.profile.invalid` with its facts in the bounded
 * summary and no envelope member. Both refuse before any session.
 */
import { describe, expect, test } from "bun:test";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import { runDispatch } from "../../packages/core/src/app/dispatch";
import {
  HARNESS_FAILURE_CODES,
  type HarnessSeatBinding,
} from "../../packages/core/src/contracts/index";
import { resolveHarnessAdmissionBinding } from "../../packages/cli/src/production";
import { createDispatchState } from "../fixtures/dispatch/harness";
import { readsFrom } from "../fixtures/dispatch/golden/harness";
import {
  MULTI_SEAT_UNASSIGNED_PROFILE,
  MULTI_SEAT_UNASSIGNED_SELECTION,
  REPRESENTABLE_MODEL,
  UNREPRESENTABLE_MODELS,
} from "../fixtures/harness/profile";
import { createPropagationHarness } from "../fixtures/harness/propagation-harness";
import { SPAWN_ENV_DESCRIPTOR } from "../fixtures/harness/spawn-env";

const spawnWithBinding = (
  harness: ReturnType<typeof createPropagationHarness>,
  binding: HarnessSeatBinding,
) =>
  harness.port.spawn({
    workItemRef: "GH-335",
    prompt: "synthetic",
    descriptor: SPAWN_ENV_DESCRIPTOR,
    binding,
  });

describe("TC-HARNESS-014 an unrepresentable seat model (M-05)", () => {
  test("each expressibility variant refuses with the seat named and no invocation", async () => {
    for (const variant of UNREPRESENTABLE_MODELS) {
      const harness = createPropagationHarness({ versionVerdict: "inside" });
      const result = await spawnWithBinding(harness, {
        agent: "coder",
        seat: "seat-judgment",
        resolvedModel: variant.model,
      });
      expect(result.ok, variant.id).toBe(false);
      if (result.ok) continue;
      expect(result.error.code, variant.id).toBe("harness.profile.model-unrepresentable");
      expect(result.error.field, variant.id).toBe("seat");
      expect(result.error.summary ?? "", variant.id).toContain("seat-judgment");
      expect(harness.invocations, variant.id).toHaveLength(0);
    }
  });

  test("the paired representable control carries its single pair and spawns", async () => {
    const harness = createPropagationHarness({ versionVerdict: "inside" });
    const result = await spawnWithBinding(harness, {
      agent: "coder",
      seat: "seat-judgment",
      resolvedModel: REPRESENTABLE_MODEL,
    });
    expect(result.ok).toBe(true);
    expect(harness.invocations).toHaveLength(1);
    const args = harness.invocations[0]?.args ?? [];
    expect(args[args.indexOf("--agent") + 1]).toBe("coder");
    expect(args[args.indexOf("--model") + 1]).toBe(REPRESENTABLE_MODEL);
  });
});

describe("TC-HARNESS-014 an unassigned named agent (M-11)", () => {
  test("the admission resolution refuses through provider.profile.invalid with its facts", () => {
    const result = resolveHarnessAdmissionBinding({
      agent: "writer",
      profile: MULTI_SEAT_UNASSIGNED_PROFILE,
      selection: MULTI_SEAT_UNASSIGNED_SELECTION,
      profileName: "synthetic-profile",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("provider.profile.invalid");
    expect(result.error.field).toBe("agent");
    expect(result.error.summary ?? "").toContain("writer");
    expect(result.error.summary ?? "").toContain("synthetic-profile");
    expect(result.error.summary ?? "").toContain("seat-judgment");
    expect(result.error.summary ?? "").toContain("seat-execution");
    // No envelope member for this refusal (TDR-0036 A-2).
    expect(result.error.harness).toBeUndefined();
  });

  test("an agent an override assigns is the paired control", () => {
    const result = resolveHarnessAdmissionBinding({
      agent: "coder",
      profile: MULTI_SEAT_UNASSIGNED_PROFILE,
      selection: MULTI_SEAT_UNASSIGNED_SELECTION,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.binding.seat).toBe("seat-judgment");
    expect(result.binding.resolvedModel).toBe("zai/glm-5#judgment");
  });

  test("the closed failure vocabulary is set-identical and adds no unassigned code", () => {
    expect(HARNESS_FAILURE_CODES).toHaveLength(13);
    expect(HARNESS_FAILURE_CODES as readonly string[]).not.toContain("provider.profile.invalid");
    expect(
      (HARNESS_FAILURE_CODES as readonly string[]).filter((code) =>
        code.startsWith("harness.profile."),
      ),
    ).toEqual(["harness.profile.model-unrepresentable"]);
  });

  test("an admission refusal claims no lease and appends no attempt record", async () => {
    const state = createDispatchState("unassigned");
    let claims = 0;
    const result = await runDispatch({
      store: state.store,
      fenceToken: state.fenceToken,
      harness: createPropagationHarness({ versionVerdict: "inside" }).port,
      harnessKind: "opencode",
      descriptor: { kind: "host", workDirectory: state.root, environment: [] },
      prompt: "synthetic",
      ref: "GH-335",
      evidenceClass: "production",
      repository: "github.com/owner/repo",
      handoverState: "authoritative",
      nowIso: () => "2026-11-18T10:00:00.000Z",
      newAttemptId: () => "attempt-1",
      newDivergenceId: () => "DIV-1",
      readTruth: async () => readsFrom(),
      claimLease: () => {
        claims += 1;
        return { ok: true, leaseId: "lease-1" };
      },
      releaseLease: () => true,
      phaseLedger: { completed: 0, total: 9, variant: "full" },
      harnessAdmission: async () => ({
        ok: false,
        error: {
          kind: "provider",
          code: "provider.profile.invalid",
          field: "agent",
          summary:
            "agent writer has no seat in profile synthetic-profile (declared seats: seat-judgment, seat-execution)",
        },
      }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("provider.profile.invalid");
    expect(result.error.harness).toBeUndefined();
    expect(claims).toBe(0);
    expect(readDispatchAttempts(state.store).records).toHaveLength(0);
  });
});

/**
 * GH-335 review remediation F-3 — the two refusal identities do not swap:
 * a present empty/whitespace agent identity is invalid input
 * (`config.value.invalid` naming the field, DEC-17), while an unassigned named
 * agent is the delivered profile refusal (`provider.profile.invalid` naming the
 * agent, the profile, and the declared seats, AC-F3-4).
 */
describe("F-3 the refusal identities are aligned", () => {
  test("the admission helper refuses an empty agent as invalid input", () => {
    for (const agent of ["", "   ", "\t"]) {
      const result = resolveHarnessAdmissionBinding({
        agent,
        profile: MULTI_SEAT_UNASSIGNED_PROFILE,
        selection: MULTI_SEAT_UNASSIGNED_SELECTION,
        profileName: "synthetic-profile",
      });
      expect(result.ok, JSON.stringify(agent)).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe("config.value.invalid");
      expect(result.error.kind).toBe("config");
      expect(result.error.field).toBe("agent");
      // Never the profile identity, and never a fabricated seat.
      expect(result.error.code).not.toBe("provider.profile.invalid");
    }
  });

  test("the mounted port refuses an unassigned agent through provider.profile.invalid", async () => {
    const harness = createPropagationHarness({
      composed: true,
      versionVerdict: "inside",
      profile: MULTI_SEAT_UNASSIGNED_PROFILE,
      selection: MULTI_SEAT_UNASSIGNED_SELECTION,
    });
    const result = await harness.port.spawn({
      workItemRef: "GH-335",
      prompt: "synthetic",
      descriptor: SPAWN_ENV_DESCRIPTOR,
      agent: "writer",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("provider.profile.invalid");
    expect(result.error.kind).toBe("provider");
    expect(result.error.summary ?? "").toContain("writer");
    expect(result.error.summary ?? "").toContain("seat-judgment");
    expect(harness.invocations).toHaveLength(0);
  });

  test("the mounted port still refuses an empty agent as invalid input", async () => {
    const harness = createPropagationHarness({
      composed: true,
      versionVerdict: "inside",
      profile: MULTI_SEAT_UNASSIGNED_PROFILE,
      selection: MULTI_SEAT_UNASSIGNED_SELECTION,
    });
    const result = await harness.port.spawn({
      workItemRef: "GH-335",
      prompt: "synthetic",
      descriptor: SPAWN_ENV_DESCRIPTOR,
      agent: "",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("config.value.invalid");
    expect(result.error.field).toBe("agent");
    expect(harness.invocations).toHaveLength(0);
  });
});
