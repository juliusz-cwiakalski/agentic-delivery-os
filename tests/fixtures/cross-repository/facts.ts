/**
 * Cross-repository shared-verdict fixture (GH-310 F-3, DM-2..DM-4, DM-9..DM-11).
 *
 * Every per-member fact is injected: one bounded read bundle per declared
 * member, plus `MemberLandingObservation` values for landing order. No I/O, no
 * network, no credentials; the members are declarations over the delivered
 * temp-repo seam in `two-members.ts`.
 */
import type { VerifyCommandRuntime } from "../../../packages/cli/src/commands/verify";
import type { VerifyGatesCommandRuntime } from "../../../packages/cli/src/commands/verify-gates";
import type {
  MemberLandingObservation,
  PlanMemberDeclaration,
  ReviewObservation,
  VerifyGatesReviewObservationVerdict,
} from "../../../packages/core/src/contracts/index";
import type { VerifyGatesMemberReads } from "../../../packages/core/src/domain/index";
import { resolveMergeGateSet } from "../../../packages/core/src/domain/merge-gate-set";
import { baseFacts, EXPECTED_JOBS, request, run } from "../verify-gates/cases/facts";
import { combinedRuntime, runVerify } from "../verify-gates/cases/harness";
import { API_MEMBER, CHANGE_REF, DOCS_MEMBER, type MemberFixture, WEB_MEMBER } from "./constants";

/** The two-member declaration used by the happy/negative shared-verdict cases. */
export const declaredMember = (
  member: MemberFixture,
  overrides: Partial<PlanMemberDeclaration> = {},
): PlanMemberDeclaration => ({
  repoKey: member.repoKey,
  slice: member.slice,
  branch: member.branch,
  pullRequest: member.pullRequest,
  dependsOn: [],
  gates: ["ci-green", "push-parity"],
  ...overrides,
});

/** The PR-less declaration: the member stays a member and leaves evidence. */
export const pullRequestless = (
  member: MemberFixture,
  gates: readonly string[] = ["ci-green", "push-parity"],
): PlanMemberDeclaration => ({
  repoKey: member.repoKey,
  slice: member.slice,
  branch: member.branch,
  dependsOn: [],
  gates,
});

const memberRequest = (member: MemberFixture) =>
  request({
    identity: { systemName: "github", entityId: member.pullRequest },
    sourceRef: member.branch,
    sourceHeadSha: member.headSha,
  });

const greenRuns = (): VerifyGatesMemberReads["checkRuns"] => ({
  ok: true,
  value: {
    items: EXPECTED_JOBS.map((name) => run(name, "succeeded")),
    pageItemCount: EXPECTED_JOBS.length,
  },
});

/** One member's green read bundle: its own head, PR, and check runs. */
export const greenMemberReads = (
  member: MemberFixture,
  overrides: Partial<VerifyGatesMemberReads> = {},
): VerifyGatesMemberReads => ({
  repository: {
    binding: "resolved",
    head: { branch: member.branch, sha: member.headSha, detached: false },
  },
  openPullRequests: {
    ok: true,
    value: { items: [memberRequest(member)], pageItemCount: 1 },
  },
  deliveryRequestDetail: { ok: true, value: { request: memberRequest(member) } },
  checkRuns: greenRuns(),
  ...overrides,
});

/** A classified reading failure for one member's check-run read. */
export const unavailableReads = (): VerifyGatesMemberReads["checkRuns"] => ({
  ok: false,
  reason: "read-failed",
  failureClass: "provider.payload.invalid",
});

/** The absent-evidence bundle: a pushed head but no run for it. */
export const noRunReads = (
  member: MemberFixture,
  overrides: Partial<VerifyGatesMemberReads> = {},
): VerifyGatesMemberReads =>
  greenMemberReads(member, {
    checkRuns: { ok: true, value: { items: [], pageItemCount: 0 } },
    ...overrides,
  });

/** A failing run for one expected job. */
export const redReads = (member: MemberFixture): VerifyGatesMemberReads =>
  greenMemberReads(member, {
    checkRuns: {
      ok: true,
      value: {
        items: EXPECTED_JOBS.map((name) =>
          run(name, name === EXPECTED_JOBS[0] ? "failed" : "succeeded"),
        ),
        pageItemCount: EXPECTED_JOBS.length,
      },
    },
  });

/** One injected landing observation; a position only when merged. */
export const landingObservation = (
  member: MemberFixture,
  merged: boolean,
  landingPosition?: number,
): MemberLandingObservation => ({
  repoKey: member.repoKey,
  merged,
  headSha: member.headSha,
  ...(merged && landingPosition !== undefined ? { landingPosition } : {}),
});

/** One injected review observation over a declared member. */
export const reviewObservation = (
  member: MemberFixture,
  verdicts: readonly VerifyGatesReviewObservationVerdict[] = ["pass"],
): ReviewObservation => ({
  repoKey: member.repoKey,
  pullRequest: member.pullRequest,
  verdicts,
});

/** The complete fixture world for one shared-verdict run. */
export type MemberGatesWorld = {
  readonly members: readonly PlanMemberDeclaration[];
  readonly reads: Readonly<Record<string, VerifyGatesMemberReads>>;
  readonly landings?: readonly MemberLandingObservation[];
  readonly reviews?: readonly ReviewObservation[];
  /** Optional per-member read log, consumed by the read-budget cases. */
  readonly readLog?: string[];
};

/** The not-attempted fallback reads for a member outside the fact table. */
const missingReads = (): VerifyGatesMemberReads => ({
  repository: { binding: "address-unresolved", head: { detached: true } },
  openPullRequests: { ok: false, reason: "not-attempted" },
  deliveryRequestDetail: { ok: false, reason: "not-attempted" },
  checkRuns: { ok: false, reason: "not-attempted" },
});

/** Compose the combined verify runtime with the member seam in place. */
export const memberGatesRuntime = (world: MemberGatesWorld): VerifyCommandRuntime => {
  const base = combinedRuntime();
  const gates = base.gates;
  if (gates === undefined) throw new Error("combined runtime is missing the gates member");
  const members: VerifyGatesCommandRuntime["members"] = {
    readMembers: () => world.members,
    readMemberReads: (member) => {
      world.readLog?.push(member.repoKey);
      return world.reads[member.repoKey] ?? missingReads();
    },
    ...(world.landings === undefined ? {} : { readLandingObservations: () => world.landings }),
    ...(world.reviews === undefined ? {} : { readReviewObservations: () => world.reviews }),
  };
  return { ...base, gates: { ...gates, members } };
};

/** Run `verify gates <changeRef> --json` over the member world. */
export const runMemberGates = (
  world: MemberGatesWorld,
  options: { readonly json?: boolean } = {},
): ReturnType<typeof runVerify> =>
  runVerify(memberGatesRuntime(world), ["gates", CHANGE_REF], options);

/** The effective declared gate set used by the handler (the shipped default). */
export const shippedGateSet = () => {
  const resolved = resolveMergeGateSet(undefined);
  if (!resolved.ok) throw new Error("the shipped gate set must resolve");
  return resolved.value;
};

/** The change-level facts the member evaluation reuses (lifecycle, workflow). */
export const changeFacts = () => baseFacts();

/** The three member identities in declared order. */
export const THREE_MEMBERS = [API_MEMBER, WEB_MEMBER, DOCS_MEMBER] as const;
