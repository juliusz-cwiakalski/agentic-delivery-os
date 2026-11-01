/** TC-CLOSE-010/011/015/016/040/052/056/067 — end-to-end transaction flows. */
import { describe, expect, test } from "bun:test";
import { CLOSEOUT_INTEGRATION_BASE } from "../../packages/core/src/contracts/index";
import { GITLAB_CLOSEOUT_CAPABILITIES } from "../fixtures/closeout/capabilities";
import { closeoutData, errorOf, runCloseoutCli } from "../fixtures/closeout/cli";
import {
  makeFacts,
  makeMergedRequest,
  makeProvider,
  makeState,
  makeWorkItem,
  observed,
  WORK_ITEM_REF,
} from "../fixtures/closeout/harness";
import { fakeInvalidPayload, fakeNotFound } from "../fixtures/closeout/read-observation";

describe("TC-CLOSE-010/011 dry-run and apply happy path", () => {
  test("plan performs no mutation and apply executes the seven-step order", async () => {
    const planRun = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--json"]);
    expect(planRun.exitCode).toBe(0);
    expect(planRun.provider.calls).toEqual([]);
    expect(planRun.git.calls).toEqual([]);
    expect(planRun.state.fence.appends).toBe(0);

    const applyRun = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--apply", "--json"]);
    expect(applyRun.exitCode).toBe(0);
    const kinds = applyRun.provider.calls.map((call) => call.kind);
    expect(kinds[0]).toBe("transitionWorkItem");
    expect(kinds).toContain("resolveDeliveryThread");
    expect(kinds.indexOf("transitionWorkItem")).toBeLessThan(kinds.indexOf("writeWorkItem"));
    expect(applyRun.git.calls.map((call) => call.kind)).toEqual([
      "restoreCheckout",
      "deleteBranch",
    ]);
    expect(closeoutData(applyRun.envelope).mode).toBe("applied");
  });

  test("a re-run in a fresh composition performs zero duplicate effects", async () => {
    const state = makeState();
    const first = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--apply", "--json"], {
      state,
    });
    expect(first.exitCode).toBe(0);
    const records = state.records.length;
    const second = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--apply", "--json"], {
      state,
    });
    expect(second.exitCode).toBe(0);
    expect(second.provider.calls).toEqual([]);
    expect(second.git.calls).toEqual([]);
    expect(state.records.length).toBe(records);
  });
});

describe("TC-CLOSE-056 declared-gap transaction", () => {
  test("a GitLab-style declaration succeeds with gaps and falls back to the integration base", async () => {
    const run = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--apply", "--json"], {
      facts: makeFacts({
        observedWorkItem: { observation: "unavailable" },
        mergedRequest: observed(makeMergedRequest()),
        provider: { systemName: "gitlab", capabilities: GITLAB_CLOSEOUT_CAPABILITIES },
      }),
    });
    expect(run.exitCode).toBe(0);
    const data = closeoutData(run.envelope);
    expect(data.baseRef).toBe(CLOSEOUT_INTEGRATION_BASE);
    expect(data.steps.find((step) => step.stepId === "ticket-to-done")?.outcome).toBe(
      "skipped-gap",
    );
    expect(data.steps.find((step) => step.stepId === "comment-resolution")?.outcome).toBe(
      "skipped-gap",
    );
  });
});

describe("TC-CLOSE-052 provider failure and local restore", () => {
  test("apply restores the checkout, retains the branch, and converges on re-run", async () => {
    const state = makeState();
    const failing = makeProvider({
      writeWorkItem: { ok: false, code: "closeout.write.failed", detail: "synthetic" },
    });
    const first = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--apply", "--json"], {
      state,
      provider: failing,
    });
    expect(first.exitCode).toBe(2);
    expect(errorOf(first.envelope).code).toBe("closeout.write.failed");
    expect(first.git.calls.map((call) => call.kind)).toContain("restoreCheckout");
    expect(first.git.calls.map((call) => call.kind)).not.toContain("deleteBranch");

    const healed = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--apply", "--json"], {
      state,
    });
    expect(healed.exitCode).toBe(0);
    expect(healed.git.calls.map((call) => call.kind)).toContain("deleteBranch");
  });
});

describe("TC-CLOSE-067 not-found versus malformed target", () => {
  test("not-found exits 1 with zero writes; invalid exits 2 as provider.payload.invalid", async () => {
    const notFound = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--apply", "--json"], {
      facts: makeFacts({ observedWorkItem: fakeNotFound() }),
    });
    expect(notFound.exitCode).toBe(1);
    expect(errorOf(notFound.envelope).code).toBe("closeout.target.unobserved");
    expect(notFound.state.fence.acquired).toBe(0);
    const invalid = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--json"], {
      facts: makeFacts({ observedWorkItem: fakeInvalidPayload() }),
    });
    expect(invalid.exitCode).toBe(2);
    expect(errorOf(invalid.envelope).code).toBe("provider.payload.invalid");
  });
});

describe("TC-CLOSE-040 thread write failure and retry", () => {
  test("a thread failure is closeout.write.failed and a retry converges", async () => {
    const state = makeState();
    const failing = makeProvider({
      resolveDeliveryThread: { ok: false, code: "closeout.write.failed", detail: "thread" },
    });
    const first = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--apply", "--json"], {
      state,
      provider: failing,
    });
    expect(first.exitCode).toBe(2);
    const second = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--apply", "--json"], {
      state,
    });
    expect(second.exitCode).toBe(0);
    expect(second.provider.calls.some((call) => call.kind === "resolveDeliveryThread")).toBe(true);
  });
});

describe("TC-CLOSE-006 absent merged head refuses deletion", () => {
  test("without a merged head the branch is retained", async () => {
    const run = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--apply", "--json"], {
      facts: makeFacts({
        observedWorkItem: observed(makeWorkItem()),
        mergedRequest: observed(makeMergedRequest({ headSha: undefined })),
      }),
    });
    expect(run.exitCode).toBe(1);
    expect(errorOf(run.envelope).code).toBe("closeout.branch.unsafe");
    expect(run.git.calls.map((call) => call.kind)).not.toContain("deleteBranch");
  });
});
