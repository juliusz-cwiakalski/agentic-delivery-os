/**
 * Pure cross-repository shared verdict (GH-310 F-3, DM-2..DM-4, DM-9..DM-11).
 *
 * No I/O, clock, randomness, or ambient environment: one member's facts arrive
 * as the delivered `VerifyGatesFacts` bundle, landing/review truth arrives as
 * injected `MemberLandingObservation`/`ReviewObservation` values, and the
 * declared order of the member set is the report order. The evaluation never
 * short-circuits: every declared member is evaluated and reported.
 */
import type {
  CrossRepositoryDefinitionOfDone,
  CrossRepositoryVerifyGateRecord,
  CrossRepositoryVerifyGatesEvidence,
  CrossRepositoryVerifyGatesMember,
  CrossRepositoryVerifyGatesReport,
  MemberLandingObservation,
  MergeGateEntry,
  PlanMemberDeclaration,
  ReviewObservation,
  VerifyGateCitation,
  VerifyGateRecord,
  VerifyGatesCiReading,
  VerifyGatesDefinitionOfDoneStatus,
  VerifyGatesMemberVerdict,
  VerifyGatesReportUnion,
  VerifyGatesSummary,
} from "#contracts";
import { reviewFlowFor } from "./review-flow.js";
import { evaluateDeclaredBattery, isFullHexSha, type VerifyGatesFacts } from "./verify-gates.js";

/** One member's injected reads, at the smallest delivered shapes. */
export type VerifyGatesMemberReads = {
  readonly repository: VerifyGatesFacts["repository"];
  readonly openPullRequests: VerifyGatesFacts["openPullRequests"];
  readonly deliveryRequestDetail: VerifyGatesFacts["deliveryRequestDetail"];
  readonly checkRuns: VerifyGatesFacts["checkRuns"];
};

/** One declared member evaluated against the effective gate set. */
export type CrossRepositoryMemberOutcome = {
  readonly member: PlanMemberDeclaration;
  readonly records: readonly CrossRepositoryVerifyGateRecord[];
  readonly ci: VerifyGatesCiReading;
  readonly verdict: VerifyGatesMemberVerdict;
  /** True when the member carries a synthetic unresolvable-identifier record. */
  readonly unresolvable: boolean;
};

const unresolvableRecord = (
  changeRef: string,
  member: string,
  id: string,
): CrossRepositoryVerifyGateRecord => {
  const citation: VerifyGateCitation = {
    sources: [],
    identity: { changeRef },
    counts: [],
    names: [],
    reasons: ["read-failed"],
  };
  return { id, member, verdict: "unknown", reason: "read-failed", citation };
};

/**
 * The CI reading on the member's own pushed head (DEC-4).
 *
 * `absent` is the single definition: the CI truth could not be established —
 * no declared pull request, no pushed head, or no run for the head. A
 * classified reading failure is `unavailable`, never a pass.
 */
export const memberCiReading = (
  pullRequest: string | undefined,
  reads: VerifyGatesMemberReads,
): VerifyGatesCiReading => {
  if (pullRequest === undefined) return "absent";
  const detail = reads.deliveryRequestDetail;
  if (!detail.ok) return "unavailable";
  if (!isFullHexSha(detail.value.request.sourceHeadSha)) return "absent";
  const checkRuns = reads.checkRuns;
  if (!checkRuns.ok) return "unavailable";
  const items = checkRuns.value.items;
  if (items.length === 0) return "absent";
  const states = items.map((run) => run.jobs[0]?.jobState);
  if (states.some((state) => state === undefined)) return "fail";
  if (states.some((state) => state !== "succeeded" && state !== "skipped")) return "fail";
  return states.some((state) => state === "succeeded") ? "pass" : "fail";
};

/** The mechanical member verdict over its records AND its CI reading (DM-3). */
export const memberVerdict = (
  records: readonly VerifyGateRecord[],
  ci: VerifyGatesCiReading,
): VerifyGatesMemberVerdict => {
  if (records.some((record) => record.verdict === "fail") || ci === "fail") return "fail";
  if (ci === "pass" && records.length > 0 && records.every((record) => record.verdict === "pass")) {
    return "pass";
  }
  return "unknown";
};

/**
 * Evaluate one declared member: exactly one record per declared gate in
 * declared order, the CI reading on that member's own head, and the mechanical
 * verdict over both. An identifier absent from the effective set contributes
 * exactly one pinned synthetic `unknown` record and never a pass (N3).
 */
export const evaluateCrossRepositoryMember = (input: {
  readonly changeRef: string;
  readonly member: PlanMemberDeclaration;
  readonly facts: VerifyGatesFacts;
  readonly batteryEntries: readonly MergeGateEntry[];
}): CrossRepositoryMemberOutcome => {
  let unresolvable = false;
  const records = input.member.gates.map((id) => {
    const entry = input.batteryEntries.find((candidate) => candidate.id === id);
    if (entry === undefined) {
      unresolvable = true;
      return unresolvableRecord(input.changeRef, input.member.repoKey, id);
    }
    const evaluated = evaluateDeclaredBattery(input.facts, [entry]).gates[0];
    const record: VerifyGateRecord = evaluated ?? {
      id,
      verdict: "unknown",
      reason: "read-failed",
      citation: {
        sources: [],
        identity: { changeRef: input.changeRef },
        counts: [],
        names: [],
        reasons: ["read-failed"],
      },
    };
    return { ...record, member: input.member.repoKey };
  });
  const ci = memberCiReading(input.member.pullRequest, input.facts);
  return {
    member: input.member,
    records,
    ci,
    verdict: memberVerdict(records, ci),
    unresolvable,
  };
};

const summarize = (gates: readonly VerifyGateRecord[]): VerifyGatesSummary => ({
  gates: gates.length,
  passed: gates.filter((entry) => entry.verdict === "pass").length,
  failed: gates.filter((entry) => entry.verdict === "fail").length,
  unknown: gates.filter((entry) => entry.verdict === "unknown").length,
});

const landedPosition = (observation: MemberLandingObservation | undefined): number | undefined => {
  if (observation === undefined || !observation.merged) return undefined;
  const position = observation.landingPosition;
  return typeof position === "number" && Number.isInteger(position) && position >= 1
    ? position
    : undefined;
};

const landingObservations = (
  repoKey: string,
  landings: readonly MemberLandingObservation[],
): MemberLandingObservation | undefined =>
  landings.find((observation) => observation.repoKey === repoKey);

/** Landing order: landed by ascending position, then unlanded, ties declared. */
const evidenceFor = (
  outcomes: readonly CrossRepositoryMemberOutcome[],
  landings: readonly MemberLandingObservation[],
): readonly CrossRepositoryVerifyGatesEvidence[] => {
  const declared = outcomes.flatMap((outcome, index) => {
    const pullRequest = outcome.member.pullRequest;
    if (pullRequest === undefined) return [];
    const position = landedPosition(landingObservations(outcome.member.repoKey, landings));
    return [{ outcome, index, pullRequest, position }];
  });
  const landed = declared
    .filter((entry) => entry.position !== undefined)
    .sort((left, right) => {
      const delta = (left.position ?? 0) - (right.position ?? 0);
      return delta === 0 ? left.index - right.index : delta;
    });
  const unlanded = declared.filter((entry) => entry.position === undefined);
  return [...landed, ...unlanded].map((entry) => ({
    repoKey: entry.outcome.member.repoKey,
    pullRequest: entry.pullRequest,
    landed: entry.position !== undefined,
    ...(entry.position === undefined ? {} : { landingPosition: entry.position }),
  }));
};

const membersOf = (
  outcomes: readonly CrossRepositoryMemberOutcome[],
): readonly CrossRepositoryVerifyGatesMember[] =>
  outcomes.map((outcome) => ({
    repoKey: outcome.member.repoKey,
    gates: { ci: outcome.ci },
    verdict: outcome.verdict,
  }));

const statusOf = (
  outcomes: readonly CrossRepositoryMemberOutcome[],
): VerifyGatesDefinitionOfDoneStatus => {
  if (
    outcomes.some((outcome) => outcome.verdict === "fail") ||
    outcomes.some((outcome) => outcome.ci === "unavailable") ||
    outcomes.some((outcome) => outcome.unresolvable)
  ) {
    return "blocked";
  }
  return outcomes.some((outcome) => outcome.verdict === "unknown") ? "incomplete" : "green";
};

/** The block names every member that is not `pass`, in declared order, never truncated. */
export const blockingMembersOf = (
  outcomes: readonly CrossRepositoryMemberOutcome[],
): readonly string[] =>
  outcomes.filter((outcome) => outcome.verdict !== "pass").map((outcome) => outcome.member.repoKey);

/** Assemble the additive cross-repository report (DM-11, DEC-18). */
export const crossRepositoryReport = (input: {
  readonly changeRef: string;
  readonly outcomes: readonly CrossRepositoryMemberOutcome[];
  readonly landings: readonly MemberLandingObservation[];
  readonly reviews: readonly ReviewObservation[];
}): CrossRepositoryVerifyGatesReport => {
  const status = statusOf(input.outcomes);
  const gates = input.outcomes.flatMap((outcome) => outcome.records);
  const definitionOfDone: CrossRepositoryDefinitionOfDone = {
    status,
    members: membersOf(input.outcomes),
    evidence: evidenceFor(input.outcomes, input.landings),
  };
  return {
    schemaVersion: "delivery.verify-gates.v1",
    changeRef: input.changeRef,
    target: "gates",
    overall: status === "green" ? "pass" : "fail",
    summary: summarize(gates),
    gates,
    definitionOfDone,
    blockingMembers: blockingMembersOf(input.outcomes),
    reviewFlow: reviewFlowFor({
      changeRef: input.changeRef,
      members: input.outcomes.map((outcome) => outcome.member),
      observations: input.reviews,
    }),
  };
};

/** Evaluate every declared member, then assemble the one report (F-3, F-6). */
export const evaluateCrossRepositoryGates = (input: {
  readonly changeRef: string;
  readonly readings: readonly {
    readonly member: PlanMemberDeclaration;
    readonly facts: VerifyGatesFacts;
  }[];
  readonly batteryEntries: readonly MergeGateEntry[];
  readonly landings: readonly MemberLandingObservation[];
  readonly reviews: readonly ReviewObservation[];
}): CrossRepositoryVerifyGatesReport =>
  crossRepositoryReport({
    changeRef: input.changeRef,
    outcomes: input.readings.map((reading) =>
      evaluateCrossRepositoryMember({
        changeRef: input.changeRef,
        member: reading.member,
        facts: reading.facts,
        batteryEntries: input.batteryEntries,
      }),
    ),
    landings: input.landings,
    reviews: input.reviews,
  });

/** True when the report is the cross-repository type (presence of the block). */
export const isCrossRepositoryVerifyGatesReport = (
  value: VerifyGatesReportUnion | unknown,
): value is CrossRepositoryVerifyGatesReport =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  (value as { readonly target?: unknown }).target === "gates" &&
  typeof (value as { readonly definitionOfDone?: unknown }).definitionOfDone === "object" &&
  (value as { readonly definitionOfDone?: unknown }).definitionOfDone !== null;

/** Render the bounded human report, naming every blocking member (NFR-2). */
export const renderCrossRepositoryVerifyGatesHuman = (
  report: CrossRepositoryVerifyGatesReport,
  brand: { readonly binaryName: string },
): string => {
  const status = report.definitionOfDone.status;
  const header = `${brand.binaryName} verify gates ${report.changeRef}  ${report.overall}  ${report.summary.passed}/${report.summary.gates}  ${status}`;
  const members = report.definitionOfDone.members.map(
    (member) => `${member.repoKey}  ${member.verdict}  ci=${member.gates.ci}`,
  );
  const blockers =
    report.blockingMembers.length === 0
      ? ["blocking=-"]
      : [`blocking=${report.blockingMembers.join(",")}`];
  return `${[header, ...members, ...blockers].join("\n")}\n`;
};
