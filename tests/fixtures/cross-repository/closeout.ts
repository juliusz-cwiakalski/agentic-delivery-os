/**
 * Injected per-member closeout fixture (GH-310 F-5, DM-5, DM-8, DEC-12, DEC-20).
 *
 * Every fact is injected: one `CrossRepositoryCloseoutObservation` per declared
 * member, member branch facts, and the delivered provider/git/state fakes. The
 * closeout composition consumes the observations only — no port, provider
 * operation, durable store, or live network is added.
 */
import type {
  CloseoutBranchFact,
  CloseoutPlanFacts,
  CloseoutQueueRemovalData,
  CrossRepositoryCloseoutObservation,
  StateFenceHandle,
} from "../../../packages/core/src/contracts/index";
import {
  buildCloseoutPlan,
  type CloseoutRunResult,
  runCloseout,
} from "../../../packages/core/src/domain/closeout";
import {
  CLOSEOUT_TIMESTAMP,
  type FakeGit,
  type FakeGitOptions,
  type FakeProvider,
  type FakeProviderOptions,
  type FakeState,
  type FakeStateOptions,
  makeFacts,
  makeGit,
  makeProvider,
  makeState,
} from "../closeout/harness";
import { CHANGE_REF, type MemberFixture } from "./constants";

/** One member's injected closeout observation; both merged by default. */
export const memberCloseoutObservation = (
  member: MemberFixture,
  overrides: Partial<CrossRepositoryCloseoutObservation> = {},
): CrossRepositoryCloseoutObservation => ({
  repoKey: member.repoKey,
  pullRequest: member.pullRequest,
  merged: true,
  headSha: member.headSha,
  branch: member.branch,
  issueClosure: "open",
  ...overrides,
});

/** The member branch facts, one per observation, in declared order. */
export const memberCloseoutBranches = (
  observations: readonly CrossRepositoryCloseoutObservation[],
  heads: Readonly<Record<string, string>> = {},
): readonly CloseoutBranchFact[] =>
  observations.map((observation) => ({
    name: observation.branch,
    head: heads[observation.branch] ?? observation.headSha ?? "0".repeat(40),
  }));

/** The plan facts carrying the injected member observations. */
export const memberCloseoutFacts = (
  observations: readonly CrossRepositoryCloseoutObservation[],
  options: {
    readonly branchHeads?: Readonly<Record<string, string>>;
    readonly overrides?: Partial<CloseoutPlanFacts>;
    /** `false` leaves the facts member-less so the composition seam is proven. */
    readonly injectMembers?: boolean;
  } = {},
): CloseoutPlanFacts =>
  makeFacts({
    workItemRef: CHANGE_REF,
    checkout: { state: "base" },
    branches: memberCloseoutBranches(observations, options.branchHeads),
    ...(options.injectMembers === false ? {} : { members: observations }),
    ...options.overrides,
  });

export type MemberCloseoutOptions = {
  readonly observations: readonly CrossRepositoryCloseoutObservation[];
  readonly apply: boolean;
  readonly branchHeads?: Readonly<Record<string, string>>;
  readonly provider?: FakeProviderOptions;
  readonly git?: FakeGitOptions;
  readonly state?: FakeStateOptions;
  readonly misleadingDetail?: boolean;
  readonly factsOverrides?: Partial<CloseoutPlanFacts>;
  readonly queueRemoval?: (input: {
    readonly mode: "plan" | "apply";
    readonly workItemRef: string;
    readonly mergedObserved: boolean;
    readonly handle?: StateFenceHandle;
  }) => CloseoutQueueRemovalData | undefined;
};

export type MemberCloseoutHarness = {
  readonly result: CloseoutRunResult;
  readonly plan: ReturnType<typeof buildCloseoutPlan>;
  readonly provider: FakeProvider;
  readonly git: FakeGit;
  readonly state: FakeState;
};

/** Run the delivered closeout transaction over the injected member facts. */
export const runMemberCloseout = async (
  options: MemberCloseoutOptions,
): Promise<MemberCloseoutHarness> => {
  const facts = memberCloseoutFacts(options.observations, {
    ...(options.branchHeads === undefined ? {} : { branchHeads: options.branchHeads }),
    ...(options.factsOverrides === undefined ? {} : { overrides: options.factsOverrides }),
  });
  const built = buildCloseoutPlan(facts);
  const plan = options.misleadingDetail
    ? {
        ...built,
        steps: built.steps.map((step) =>
          step.stepId === "branch-cleanup" || step.stepId === "ticket-to-done"
            ? {
                ...step,
                detail: {
                  cleanup: "satisfied",
                  issueClosure: "satisfied",
                  outcome: "satisfied",
                },
              }
            : step,
        ),
      }
    : built;
  const provider = makeProvider(options.provider ?? {});
  const git = makeGit({
    branches: facts.branches,
    ...(options.git ?? {}),
  });
  const state = makeState(options.state ?? {});
  const result = await runCloseout({
    plan,
    provider: provider.runtime,
    git: git.runtime,
    state: state.runtime,
    timestamp: CLOSEOUT_TIMESTAMP,
    fenceToken: "fence-closeout-members",
    apply: options.apply,
    ...(options.queueRemoval === undefined ? {} : { queueRemoval: options.queueRemoval }),
  });
  return { result, plan, provider, git, state };
};
