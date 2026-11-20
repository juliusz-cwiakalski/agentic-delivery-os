/**
 * TC-F4-013 — a close that did not land or whose read-back did not observe
 * closed gates at `closeout.write.failed` with no capsule close and converges
 * on retry (GH-349 F-4, AC-F4-8, RSK-11).
 */
import { describe, expect, test } from "bun:test";
import { GITHUB_ADAPTER_CONTRACT } from "../../packages/adapters/src/github/capabilities";
import { ADAPTER_OPERATIONS } from "../../packages/core/src/contracts/index";
import { buildCloseoutPlan, runCloseout } from "../../packages/core/src/domain/closeout";
import { eventsText, makeChangeTree, makeEvent, payloadFor } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";
import {
  CLOSEOUT_TIMESTAMP,
  makeFacts,
  makeGit,
  makeProvider,
  makeState,
  makeWorkItem,
  observed,
  WORK_ITEM_REF,
} from "../fixtures/closeout/harness";
import {
  MILESTONE_DECLARATION,
  MILESTONE_TITLE,
  satisfyingMilestone,
} from "../fixtures/closeout/milestone";

const GITHUB_CAPABILITIES = {
  supportedOperations: [...ADAPTER_OPERATIONS],
  declaredGaps: [],
  writableCarriers: [],
  readableCarriers: [],
} as const;

const validCapsuleTree = () =>
  makeChangeTree({
    ref: WORK_ITEM_REF,
    month: "2026-11",
    name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
    files: {
      "events.jsonl": eventsText([
        makeEvent(1, "capsule.opened", "closeout", payloadFor("capsule.opened")),
        makeEvent(2, "commit.landed", "commit", payloadFor("commit.landed")),
      ]),
    },
  });

const facts = () =>
  makeFacts({
    provider: { systemName: "github", capabilities: GITHUB_CAPABILITIES },
    observedWorkItem: observed(makeWorkItem({ milestone: MILESTONE_TITLE })),
    milestone: { declaration: MILESTONE_DECLARATION, observation: satisfyingMilestone() },
  });

const run = async (closeMilestone: {
  readonly ok: false;
  readonly code: string;
  readonly detail: string;
}) => {
  const change = validCapsuleTree();
  try {
    const provider = makeProvider({ closeMilestone });
    const git = makeGit();
    const state = makeState();
    const capsule = makeCapsuleRuntime(change.changes);
    const result = await runCloseout({
      plan: buildCloseoutPlan(facts()),
      provider: provider.runtime,
      git: git.runtime,
      state: state.runtime,
      timestamp: CLOSEOUT_TIMESTAMP,
      fenceToken: "fence-write-failure",
      apply: true,
      capsule,
    });
    const history = capsule.read(WORK_ITEM_REF);
    const events = history.ok ? history.events : [];
    return {
      result,
      closeCalls: provider.calls.filter((call) => call.kind === "closeMilestone").length,
      capsuleClosed: events.some((event) => event.kind === "capsule.closed"),
    };
  } finally {
    change.cleanup();
  }
};

describe("TC-F4-013 a close write failure gates at closeout.write.failed", () => {
  for (const [name, closeMilestone] of [
    [
      "the close request fails",
      { ok: false as const, code: "provider.payload.invalid", detail: "close request failed" },
    ],
    [
      "the read-back does not observe closed",
      {
        ok: false as const,
        code: "provider.payload.invalid",
        detail: "read-back did not observe closed",
      },
    ],
  ] as const) {
    test(`${name} returns the gating identity with no capsule close`, async () => {
      const outcome = await run(closeMilestone);
      expect(outcome.result.ok).toBe(false);
      if (outcome.result.ok) return;
      expect(outcome.result.error.kind).toBe("closeout");
      expect(outcome.result.error.code).toBe("closeout.write.failed");
      expect(outcome.closeCalls).toBe(1);
      expect(outcome.capsuleClosed).toBe(false);
    });
  }

  test("a retry against a healthy provider converges to applied", async () => {
    const change = validCapsuleTree();
    try {
      const provider = makeProvider();
      const git = makeGit();
      const state = makeState();
      const capsule = makeCapsuleRuntime(change.changes);
      const result = await runCloseout({
        plan: buildCloseoutPlan(facts()),
        provider: provider.runtime,
        git: git.runtime,
        state: state.runtime,
        timestamp: CLOSEOUT_TIMESTAMP,
        fenceToken: "fence-write-retry",
        apply: true,
        capsule,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.steps.find((step) => step.stepId === "milestone-sync")?.outcome).toBe(
        "applied",
      );
      expect(provider.calls.filter((call) => call.kind === "closeMilestone")).toHaveLength(1);
    } finally {
      change.cleanup();
    }
  });

  test("the declared capability posture is unchanged by the failure path", () => {
    expect(GITHUB_ADAPTER_CONTRACT.capabilities.supportedOperations).toContain("close-milestone");
    expect(GITHUB_ADAPTER_CONTRACT.capabilities.declaredGaps).toEqual([]);
  });
});
