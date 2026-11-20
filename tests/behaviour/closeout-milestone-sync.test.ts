/**
 * TC-F4-001..008, 010..012, 014 — the milestone-synchronization step over the
 * pure planner and the injected closeout runtime (GH-349 F-4, AC-F4-1..4/6/7/8).
 *
 * Offline only: the planner is pure and the runtime is driven by recording
 * fakes; no provider process, no network, no clock.
 */
import { describe, expect, test } from "bun:test";
import { GITLAB_ADAPTER_CONTRACT } from "../../packages/adapters/src/gitlab/capabilities";
import { JIRA_ADAPTER_CONTRACT } from "../../packages/adapters/src/jira/capabilities";
import {
  ADAPTER_OPERATIONS,
  type CloseoutMilestoneFacts,
  type CloseoutPlan,
  type CloseoutPlanFacts,
  type MilestoneReadObservation,
} from "../../packages/core/src/contracts/index";
import { buildCloseoutPlan, runCloseout } from "../../packages/core/src/domain/closeout";
import { foldCloseoutHistory } from "../../packages/core/src/state/closeout";
import {
  CLOSEOUT_TIMESTAMP,
  type FakeProviderOptions,
  makeFacts,
  makeGit,
  makeProvider,
  makeState,
  makeWorkItem,
  observed,
  type ProviderCall,
} from "../fixtures/closeout/harness";
import { m4AttachedSet } from "../fixtures/closeout/m4-attached-set";
import {
  alreadyClosedMilestone,
  canceledItemMilestone,
  invalidMilestone,
  MILESTONE_DECLARATION,
  MILESTONE_TITLE,
  OTHER_MILESTONE_TITLE,
  observedMilestone,
  openItemMilestone,
  satisfyingMilestone,
  truncatedMilestone,
  unavailableMilestone,
  unknownStateMilestone,
} from "../fixtures/closeout/milestone";

const GITHUB_CAPABILITIES = {
  supportedOperations: [...ADAPTER_OPERATIONS],
  declaredGaps: [],
  writableCarriers: [],
  readableCarriers: [],
} as const;

const milestoneStep = (plan: CloseoutPlan) => {
  const step = plan.steps.find((entry) => entry.stepId === "milestone-sync");
  if (step === undefined) throw new Error("the plan has no milestone-sync step");
  return step;
};

const withheldResidue = (plan: CloseoutPlan) =>
  (plan.residue ?? []).filter((item) => item.kind === "milestone-sync-withheld");

type MilestoneFixtureOptions = {
  readonly declaration?: string | undefined;
  readonly observation?: MilestoneReadObservation | undefined;
  readonly workItemMilestone?: string | undefined;
  readonly capabilities?: CloseoutPlanFacts["provider"]["capabilities"];
  readonly systemName?: string;
  /** The folded ledger the plan is built against (defaults to an empty one). */
  readonly persisted?: CloseoutPlanFacts["persisted"];
};

const milestoneFacts = (options: MilestoneFixtureOptions = {}): CloseoutPlanFacts => {
  const declaration = "declaration" in options ? options.declaration : MILESTONE_DECLARATION;
  const observedTitle =
    "workItemMilestone" in options ? options.workItemMilestone : MILESTONE_TITLE;
  const milestone: CloseoutMilestoneFacts = {
    ...(declaration === undefined ? {} : { declaration }),
    ...(options.observation === undefined ? {} : { observation: options.observation }),
  };
  return makeFacts({
    provider: {
      systemName: options.systemName ?? "github",
      capabilities: options.capabilities ?? GITHUB_CAPABILITIES,
    },
    observedWorkItem: observed(
      makeWorkItem({ ...(observedTitle === undefined ? {} : { milestone: observedTitle }) }),
    ),
    milestone,
    ...(options.persisted === undefined ? {} : { persisted: options.persisted }),
  });
};

const apply = async (
  facts: CloseoutPlanFacts,
  options: { readonly closeMilestone?: FakeProviderOptions["closeMilestone"] } = {},
) => {
  const provider = makeProvider(
    options.closeMilestone === undefined ? {} : { closeMilestone: options.closeMilestone },
  );
  const git = makeGit();
  const state = makeState();
  const plan = buildCloseoutPlan(facts);
  const result = await runCloseout({
    plan,
    provider: provider.runtime,
    git: git.runtime,
    state: state.runtime,
    timestamp: CLOSEOUT_TIMESTAMP,
    fenceToken: "fence-closeout-milestone",
    apply: true,
  });
  return { result, plan, provider, state };
};

const closeCalls = (calls: readonly ProviderCall[]): readonly ProviderCall[] =>
  calls.filter((call) => call.kind === "closeMilestone");

describe("TC-F4-001 the step is twelfth of thirteen and resolves by id", () => {
  test("milestone-sync is at position 12 and capsule stays terminal", () => {
    const plan = buildCloseoutPlan(milestoneFacts({ observation: satisfyingMilestone() }));
    expect(plan.steps.map((step) => step.stepId)).toHaveLength(13);
    expect(plan.steps[11]?.stepId).toBe("milestone-sync");
    expect(plan.steps[12]?.stepId).toBe("capsule");
    expect(plan.steps.find((step) => step.stepId === "milestone-sync")?.label).toBe(
      "milestone synchronization",
    );
  });

  test("a consumer resolving by id finds the step without a positional assumption", () => {
    const plan = buildCloseoutPlan(milestoneFacts({ observation: satisfyingMilestone() }));
    const outcomeById = Object.fromEntries(plan.steps.map((step) => [step.stepId, step.outcome]));
    expect(outcomeById["milestone-sync"]).toBe("would-apply");
    expect(outcomeById.capsule).toBeDefined();
  });
});

describe("TC-F4-002 a satisfying exit review closes once over one read-back-verified write", () => {
  test("apply reports applied with exactly one close and no other step changed", async () => {
    const satisfying = milestoneFacts({ observation: satisfyingMilestone() });
    const baseline = milestoneFacts({ declaration: "none" });
    const satisfyingPlan = buildCloseoutPlan(satisfying);
    const baselinePlan = buildCloseoutPlan(baseline);
    for (const step of satisfyingPlan.steps.filter((entry) => entry.stepId !== "milestone-sync")) {
      const baselineStep = baselinePlan.steps.find((entry) => entry.stepId === step.stepId);
      expect(step.outcome, step.stepId).toBe(baselineStep?.outcome);
      expect(step.detail, step.stepId).toEqual(baselineStep?.detail);
    }

    const { result, provider, state } = await apply(satisfying);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const step = result.data.steps.find((entry) => entry.stepId === "milestone-sync");
    expect(step?.outcome).toBe("applied");
    expect(closeCalls(provider.calls)).toHaveLength(1);
    expect(closeCalls(provider.calls)[0]?.args).toEqual({ milestone: "4" });
    expect(state.fence.acquired).toBe(1);
  });

  test("a close write that never lands is a failed step, not a second attempt", async () => {
    const { result, provider } = await apply(
      milestoneFacts({ observation: satisfyingMilestone() }),
      {
        closeMilestone: {
          ok: false,
          code: "provider.payload.invalid",
          detail: "read-back not closed",
        },
      },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("closeout.write.failed");
    expect(closeCalls(provider.calls)).toHaveLength(1);
  });
});

describe("AC-F4-2 the provider-native prefixed title matches the declaration (B1)", () => {
  test("the real GH-shaped title matches instead of reporting attachment-mismatch", () => {
    // The provider copies its milestone title verbatim, prefix included.
    expect(MILESTONE_TITLE).toBe("M4: Jaiship-native delivery");
    const plan = buildCloseoutPlan(milestoneFacts({ observation: satisfyingMilestone() }));
    const step = milestoneStep(plan);
    expect(step.outcome).toBe("would-apply");
    expect(step.reason).toBeUndefined();
    expect(step.evidence).toEqual(
      expect.arrayContaining([{ name: "attachment", value: "matched" }]),
    );
    expect(withheldResidue(plan)).toHaveLength(0);
  });

  test("the same phrase under another milestone number is still a mismatch", () => {
    const plan = buildCloseoutPlan(
      milestoneFacts({
        observation: satisfyingMilestone(),
        workItemMilestone: "M5: Jaiship-native delivery",
      }),
    );
    expect(milestoneStep(plan).outcome).toBe("skipped-noop");
    expect(milestoneStep(plan).reason).toBe("attachment-mismatch");
  });
});

describe("TC-F4-003 absent, non-conforming, and mismatched declarations withhold with one residue", () => {
  const cases: readonly {
    readonly name: string;
    readonly options: MilestoneFixtureOptions;
    readonly reason: string;
  }[] = [
    {
      name: "absent declaration",
      options: { declaration: undefined, observation: satisfyingMilestone() },
      reason: "declared-milestone-missing",
    },
    {
      name: "non-M<n> shaped declaration",
      options: { declaration: "Sprint 12", observation: satisfyingMilestone() },
      reason: "declared-milestone-missing",
    },
    {
      name: "declaration attached to a different milestone",
      options: { observation: satisfyingMilestone(), workItemMilestone: OTHER_MILESTONE_TITLE },
      reason: "attachment-mismatch",
    },
    {
      name: "matching title that the work item does not carry",
      options: { observation: satisfyingMilestone(), workItemMilestone: undefined },
      reason: "attachment-mismatch",
    },
  ];

  for (const fixture of cases) {
    test(`${fixture.name} is skipped-noop with ${fixture.reason} and zero writes`, async () => {
      const facts = milestoneFacts(fixture.options);
      const plan = buildCloseoutPlan(facts);
      const step = milestoneStep(plan);
      expect(step.outcome).toBe("skipped-noop");
      expect(step.reason).toBe(fixture.reason);
      const residue = withheldResidue(plan);
      expect(residue).toHaveLength(1);
      expect(residue[0]).toEqual({
        item: fixture.reason,
        kind: "milestone-sync-withheld",
        location: "GH-183",
      });
      const { provider } = await apply(facts);
      expect(closeCalls(provider.calls)).toHaveLength(0);
    });
  }
});

describe("TC-F4-004 a none declaration is a declared gap", () => {
  test("plan and apply both report skipped-gap with no withheld residue and no write", async () => {
    const facts = milestoneFacts({ declaration: "none" });
    const plan = buildCloseoutPlan(facts);
    expect(milestoneStep(plan).outcome).toBe("skipped-gap");
    expect(milestoneStep(plan).reason).toBe("milestone-construct-absent");
    expect(withheldResidue(plan)).toHaveLength(0);
    const { result, provider } = await apply(facts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.steps.find((step) => step.stepId === "milestone-sync")?.outcome).toBe(
      "skipped-gap",
    );
    expect(closeCalls(provider.calls)).toHaveLength(0);
  });
});

describe("TC-F4-005 an open attached item withholds closure", () => {
  test("one open item is closure-withheld with zero writes; canceled applies", async () => {
    const withheld = milestoneFacts({ observation: openItemMilestone() });
    const plan = buildCloseoutPlan(withheld);
    expect(milestoneStep(plan).outcome).toBe("skipped-noop");
    expect(withheldResidue(plan)[0]?.item).toBe("closure-withheld");
    expect(
      (await apply(withheld)).provider.calls.filter((c) => c.kind === "closeMilestone"),
    ).toHaveLength(0);

    const appliedFacts = milestoneFacts({ observation: canceledItemMilestone() });
    expect(milestoneStep(buildCloseoutPlan(appliedFacts)).outcome).toBe("would-apply");
  });
});

describe("TC-F4-006 an unavailable or invalid signal is a distinct fact", () => {
  test("unavailable is milestone-signal-unavailable and is never a failure or an empty set", async () => {
    const facts = milestoneFacts({ observation: unavailableMilestone() });
    const plan = buildCloseoutPlan(facts);
    const step = milestoneStep(plan);
    expect(step.outcome).toBe("skipped-noop");
    expect(step.reason).toBe("milestone-signal-unavailable");
    expect(withheldResidue(plan)[0]?.item).toBe("milestone-signal-unavailable");
    const { result, provider } = await apply(facts);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.steps.some((entry) => entry.outcome === "failed")).toBe(false);
    expect(closeCalls(provider.calls)).toHaveLength(0);
  });

  test("an invalid read is also unavailable, with its state in evidence", () => {
    const plan = buildCloseoutPlan(milestoneFacts({ observation: invalidMilestone() }));
    expect(milestoneStep(plan).reason).toBe("milestone-signal-unavailable");
    expect(milestoneStep(plan).detail).toEqual({
      state: "milestone-signal-unavailable",
      detail: "malformed provider payload",
    });
  });
});

describe("TC-F4-007 an unknown state withholds as closure-withheld, distinguishable in evidence", () => {
  test("the shared reason carries the unknown state verbatim while the open-item fact does not", () => {
    const unknownPlan = buildCloseoutPlan(milestoneFacts({ observation: unknownStateMilestone() }));
    const openPlan = buildCloseoutPlan(milestoneFacts({ observation: openItemMilestone() }));
    const unknownStep = milestoneStep(unknownPlan);
    const openStep = milestoneStep(openPlan);
    expect(unknownStep.reason).toBe("closure-withheld");
    expect(openStep.reason).toBe("closure-withheld");
    expect(withheldResidue(unknownPlan)[0]?.kind).toBe(withheldResidue(openPlan)[0]?.kind);
    expect(unknownStep.detail).toMatchObject({ state: "unknown", exitReview: "withheld" });
    expect(openStep.detail).toMatchObject({ state: "open", open: 1 });
    expect(unknownStep.detail).not.toEqual(openStep.detail);
  });

  test("no unknown-state residue member exists", async () => {
    const { provider } = await apply(milestoneFacts({ observation: unknownStateMilestone() }));
    expect(closeCalls(provider.calls)).toHaveLength(0);
  });
});

describe("TC-F4-008 a truncated page withholds and the page-size bound is declared", () => {
  test("a truncation marker withholds as attached-set-truncated with no write", async () => {
    const facts = milestoneFacts({ observation: truncatedMilestone() });
    const plan = buildCloseoutPlan(facts);
    const step = milestoneStep(plan);
    expect(step.outcome).toBe("skipped-noop");
    expect(step.reason).toBe("attached-set-truncated");
    expect(withheldResidue(plan)[0]?.item).toBe("attached-set-truncated");
    expect(step.detail).toMatchObject({ omitted: 1, cap: 100 });
    const { provider } = await apply(facts);
    expect(closeCalls(provider.calls)).toHaveLength(0);
  });

  test("the declared page size is the effective bound and 200 is only a logical ceiling", async () => {
    const { CLOSEOUT_MILESTONE_LOGICAL_CAP, CLOSEOUT_MILESTONE_PAGE_SIZE } = await import(
      "../../packages/core/src/contracts/index"
    );
    expect(CLOSEOUT_MILESTONE_PAGE_SIZE).toBe(100);
    expect(CLOSEOUT_MILESTONE_LOGICAL_CAP).toBe(200);
    expect(CLOSEOUT_MILESTONE_PAGE_SIZE).toBeLessThan(CLOSEOUT_MILESTONE_LOGICAL_CAP);
  });
});

describe("TC-F4-010 plan mode renders the closed outcome table with zero writes", () => {
  test("the seven fixtures bind to the four declared outcomes in order", async () => {
    const fixtures: readonly { readonly name: string; readonly facts: CloseoutPlanFacts }[] = [
      { name: "satisfying", facts: milestoneFacts({ observation: satisfyingMilestone() }) },
      { name: "already closed", facts: milestoneFacts({ observation: alreadyClosedMilestone() }) },
      { name: "absent declaration", facts: milestoneFacts({ declaration: undefined }) },
      {
        name: "attachment mismatch",
        facts: milestoneFacts({
          workItemMilestone: OTHER_MILESTONE_TITLE,
          observation: satisfyingMilestone(),
        }),
      },
      { name: "withheld closure", facts: milestoneFacts({ observation: openItemMilestone() }) },
      { name: "none declaration", facts: milestoneFacts({ declaration: "none" }) },
      {
        name: "gap adapter",
        facts: milestoneFacts({
          observation: satisfyingMilestone(),
          capabilities: GITLAB_ADAPTER_CONTRACT.capabilities,
          systemName: "gitlab",
        }),
      },
    ];
    const outcomes = fixtures.map(
      (fixture) => milestoneStep(buildCloseoutPlan(fixture.facts)).outcome,
    );
    expect(outcomes).toEqual([
      "would-apply",
      "satisfied",
      "skipped-noop",
      "skipped-noop",
      "skipped-noop",
      "skipped-gap",
      "skipped-gap",
    ]);
    expect(outcomes).not.toContain("would-refuse");

    for (const fixture of fixtures) {
      const provider = makeProvider();
      const git = makeGit();
      const state = makeState();
      const plan = buildCloseoutPlan(fixture.facts);
      const result = await runCloseout({
        plan,
        provider: provider.runtime,
        git: git.runtime,
        state: state.runtime,
        timestamp: CLOSEOUT_TIMESTAMP,
        fenceToken: "fence-plan",
        apply: false,
      });
      expect(result.ok, fixture.name).toBe(true);
      expect(provider.calls, fixture.name).toHaveLength(0);
      expect(state.fence.appends, fixture.name).toBe(0);
      expect(state.fence.acquired, fixture.name).toBe(0);
    }
  });
});

describe("TC-F4-011 two applies perform at most one close", () => {
  test("the second apply observes an open record and is satisfied from the ledger", async () => {
    const provider = makeProvider();
    const git = makeGit();
    const state = makeState();
    const firstPlan = buildCloseoutPlan(milestoneFacts({ observation: satisfyingMilestone() }));
    const first = await runCloseout({
      plan: firstPlan,
      provider: provider.runtime,
      git: git.runtime,
      state: state.runtime,
      timestamp: CLOSEOUT_TIMESTAMP,
      fenceToken: "fence-first",
      apply: true,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.steps.find((step) => step.stepId === "milestone-sync")?.outcome).toBe(
      "applied",
    );
    expect(state.records.filter((record) => record.operation === "close-milestone")).toHaveLength(
      1,
    );

    // The second apply observes the SAME open record: the provider has not been
    // asked again, so the only possible source of `satisfied` is the ledger's
    // terminal outcome for the first close (AC-F4-6). With an empty ledger the
    // same facts would ask for a second write, which is the control below.
    const secondFacts = milestoneFacts({
      observation: satisfyingMilestone(),
      persisted: foldCloseoutHistory(state.records),
    });
    expect(milestoneStep(buildCloseoutPlan(secondFacts)).outcome).toBe("satisfied");
    expect(
      milestoneStep(buildCloseoutPlan(milestoneFacts({ observation: satisfyingMilestone() })))
        .outcome,
    ).toBe("would-apply");

    const appendsBefore = state.fence.appends;
    const second = await runCloseout({
      plan: buildCloseoutPlan(secondFacts),
      provider: provider.runtime,
      git: git.runtime,
      state: state.runtime,
      timestamp: CLOSEOUT_TIMESTAMP,
      fenceToken: "fence-second",
      apply: true,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.steps.find((step) => step.stepId === "milestone-sync")?.outcome).toBe(
      "satisfied",
    );
    expect(closeCalls(provider.calls)).toHaveLength(1);
    expect(state.fence.appends).toBe(appendsBefore);
    expect(state.records.filter((record) => record.operation === "close-milestone")).toHaveLength(
      1,
    );
  });
});

describe("TC-F4-012 GH-349's own M4 outcome is withheld closure, never a closed record", () => {
  const m4Facts = (openTicket: "open" | "canceled"): CloseoutPlanFacts =>
    makeFacts({
      provider: { systemName: "github", capabilities: GITHUB_CAPABILITIES },
      observedWorkItem: observed(
        makeWorkItem({
          milestone: MILESTONE_TITLE,
          identity: { systemName: "github", entityId: "349" },
        }),
      ),
      milestone: {
        declaration: MILESTONE_DECLARATION,
        observation: observedMilestone(m4AttachedSet(openTicket)),
      },
    });

  test("the open attached ticket withholds with attachment and exit-review evidence", async () => {
    const facts = m4Facts("open");
    const plan = buildCloseoutPlan(facts);
    const step = milestoneStep(plan);
    expect(step.outcome).toBe("skipped-noop");
    expect(withheldResidue(plan)[0]?.item).toBe("closure-withheld");
    expect(step.evidence).toEqual(
      expect.arrayContaining([
        { name: "attachment", value: "observed" },
        { name: "exitReview", value: "withheld" },
      ]),
    );
    const { provider } = await apply(facts);
    expect(closeCalls(provider.calls)).toHaveLength(0);
    // The fixture's record is still open after the run.
    expect(m4AttachedSet("open").state).toBe("open");
  });

  test("flipping the open item to canceled makes the same fixture applied", () => {
    expect(milestoneStep(buildCloseoutPlan(m4Facts("canceled"))).outcome).toBe("would-apply");
  });
});

describe("TC-F4-014 a provider without the surface is a declared gap", () => {
  for (const [name, contract] of [
    ["gitlab", GITLAB_ADAPTER_CONTRACT],
    ["jira", JIRA_ADAPTER_CONTRACT],
  ] as const) {
    test(`${name} reports skipped-gap with its declared reason and no residue`, async () => {
      const facts = milestoneFacts({
        observation: satisfyingMilestone(),
        capabilities: contract.capabilities,
        systemName: name,
      });
      const plan = buildCloseoutPlan(facts);
      const step = milestoneStep(plan);
      expect(step.outcome).toBe("skipped-gap");
      expect(withheldResidue(plan)).toHaveLength(0);
      const expected = name === "gitlab" ? "adapter-not-implemented" : "provider-unsupported";
      expect(step.reason).toBe(expected);
      const { provider } = await apply(facts);
      expect(closeCalls(provider.calls)).toHaveLength(0);
    });
  }
});
