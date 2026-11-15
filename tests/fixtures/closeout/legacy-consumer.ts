/**
 * A synthetic legacy consumer of the closeout and shared-verdict member reports
 * (GH-240 TC-CAP-051, GH-310 TC-XCTR-004).
 *
 * It resolves steps by `stepId` and members by `repoKey`, never by array
 * position, ignores unknown additive fields, and reports a missing declared
 * field as a contract violation instead of defaulting it.
 */
import type {
  CloseoutData,
  CloseoutMemberReport,
  CloseoutStep,
  CrossRepositoryVerifyGatesMember,
} from "../../../packages/core/src/contracts/index";
export type LegacyConsumerView = {
  readonly outcomes: Readonly<Record<string, string>>;
  readonly residue: number;
  readonly hasCapsule: boolean;
};

export const consumeCloseout = (
  data: CloseoutData & {
    readonly steps: readonly (CloseoutStep & { readonly future?: unknown })[];
  },
): LegacyConsumerView => {
  const outcomes: Record<string, string> = {};
  for (const step of data.steps) {
    if (typeof step.stepId !== "string") continue;
    outcomes[step.stepId] = step.outcome;
  }
  return {
    outcomes,
    residue: data.residue?.length ?? 0,
    hasCapsule: data.capsule !== undefined,
  };
};

/** The six declared fields of one closeout member report entry (GH-310 DM-5). */
export const CLOSEOUT_MEMBER_DECLARED_FIELDS = [
  "repoKey",
  "branch",
  "cleanup",
  "pullRequest",
  "issueClosure",
  "landed",
] as const;

export type MemberConsumerView<T> = {
  readonly members: Readonly<Record<string, T>>;
  readonly steps: Readonly<Record<string, string>>;
  readonly violations: readonly string[];
};

export type GatesMemberConsumerView<T> = {
  readonly members: Readonly<Record<string, T>>;
  readonly violations: readonly string[];
};

/**
 * Resolve every member by `repoKey` and every step by `stepId` while tolerating
 * additive fields. When `declaredOrder` is supplied, a different array order is
 * a spec violation; position is never used as identity.
 */
export const consumeMemberCloseout = (
  data: {
    readonly steps: readonly (CloseoutStep & { readonly future?: unknown })[];
    readonly members: readonly (CloseoutMemberReport & { readonly future?: unknown })[];
  },
  declaredOrder: readonly string[] = [],
): MemberConsumerView<CloseoutMemberReport & { readonly future?: unknown }> => {
  const members: Record<string, CloseoutMemberReport & { readonly future?: unknown }> = {};
  const steps: Record<string, string> = {};
  const violations: string[] = [];
  for (const step of data.steps) {
    if (typeof step.stepId !== "string") continue;
    steps[step.stepId] = step.outcome;
  }
  for (const member of data.members) {
    const missing = CLOSEOUT_MEMBER_DECLARED_FIELDS.filter(
      (field) => !Object.hasOwn(member, field),
    );
    if (missing.length > 0)
      violations.push(`member ${String(member.repoKey)} is missing ${missing.join(",")}`);
    if (typeof member.repoKey !== "string" || member.repoKey.length === 0) {
      violations.push("a closeout member has no repoKey");
      continue;
    }
    members[member.repoKey] = member;
  }
  if (declaredOrder.length > 0) {
    const actual = data.members.map((member) => member.repoKey);
    if (JSON.stringify(actual) !== JSON.stringify(declaredOrder)) {
      violations.push(`member order ${actual.join(",")} != declared ${declaredOrder.join(",")}`);
    }
  }
  return { members, steps, violations };
};

/** Resolve every shared-verdict member by `repoKey`, ignoring additive fields. */
export const consumeMemberGates = (
  data: {
    readonly definitionOfDone: {
      readonly members: readonly (CrossRepositoryVerifyGatesMember & {
        readonly future?: unknown;
      })[];
    };
  },
  declaredOrder: readonly string[] = [],
): GatesMemberConsumerView<CrossRepositoryVerifyGatesMember & { readonly future?: unknown }> => {
  const members: Record<string, CrossRepositoryVerifyGatesMember & { readonly future?: unknown }> =
    {};
  const violations: string[] = [];
  for (const member of data.definitionOfDone.members) {
    if (typeof member.repoKey !== "string" || member.repoKey.length === 0) {
      violations.push("a shared-verdict member has no repoKey");
      continue;
    }
    if (member.gates === undefined || typeof member.gates.ci !== "string") {
      violations.push(`member ${member.repoKey} has no gates.ci`);
    }
    if (typeof member.verdict !== "string") {
      violations.push(`member ${member.repoKey} has no verdict`);
    }
    members[member.repoKey] = member;
  }
  if (declaredOrder.length > 0) {
    const actual = data.definitionOfDone.members.map((member) => member.repoKey);
    if (JSON.stringify(actual) !== JSON.stringify(declaredOrder)) {
      violations.push(`member order ${actual.join(",")} != declared ${declaredOrder.join(",")}`);
    }
  }
  return { members, violations };
};
