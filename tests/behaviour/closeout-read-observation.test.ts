/**
 * TC-CLOSE-067 (engine boundary) — the discriminated target read never
 * collapses not-found, unavailable, and invalid into one outcome.
 */
import { describe, expect, test } from "bun:test";
import { buildCloseoutPlan, runCloseout } from "../../packages/core/src/domain/closeout";
import {
  CLOSEOUT_TIMESTAMP,
  makeFacts,
  makeGit,
  makeProvider,
  makeState,
} from "../fixtures/closeout/harness";
import {
  fakeInvalidPayload,
  fakeNotFound,
  fakeUnavailableSurface,
} from "../fixtures/closeout/read-observation";

const run = async (
  observedWorkItem: ReturnType<typeof fakeNotFound>,
): Promise<{
  readonly result: Awaited<ReturnType<typeof runCloseout>>;
  readonly state: ReturnType<typeof makeState>;
  readonly provider: ReturnType<typeof makeProvider>;
  readonly git: ReturnType<typeof makeGit>;
}> => {
  const state = makeState();
  const provider = makeProvider();
  const git = makeGit();
  const result = await runCloseout({
    plan: buildCloseoutPlan(makeFacts({ observedWorkItem })),
    provider: provider.runtime,
    git: git.runtime,
    state: state.runtime,
    timestamp: CLOSEOUT_TIMESTAMP,
    fenceToken: "fence-1",
    apply: true,
  });
  return { result, state, provider, git };
};

describe("TC-CLOSE-067 target read discrimination", () => {
  test("explicit not-found fails closeout.target.unobserved with zero writes", async () => {
    const { result, state, provider, git } = await run(fakeNotFound());
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toMatchObject({ kind: "closeout", code: "closeout.target.unobserved" });
    expect(state.fence.acquired).toBe(0);
    expect(provider.calls).toEqual([]);
    expect(git.calls).toEqual([]);
  });

  test("a malformed payload is provider.payload.invalid, never the not-found code", async () => {
    const { result, state, provider, git } = await run(fakeInvalidPayload());
    expect(result.ok).toBe(false);
    expect(state.fence.acquired).toBe(0);
    expect(provider.calls).toEqual([]);
    expect(git.calls).toEqual([]);
    if (!result.ok) {
      expect(result.error.code).toBe("provider.payload.invalid");
      expect(result.error.code).not.toBe("closeout.target.unobserved");
    }
  });

  test("an unavailable surface is a declared gap, not a target failure", async () => {
    const { result } = await run(fakeUnavailableSurface());
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ticket = result.data.steps.find((step) => step.stepId === "ticket-to-done");
      expect(ticket?.outcome).toBe("skipped-gap");
      expect(ticket?.reason).toBe("provider-unsupported");
    }
  });
});
