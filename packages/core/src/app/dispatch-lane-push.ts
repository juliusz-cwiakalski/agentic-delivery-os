/**
 * The lane's own evidence push (GH-416 F-1..F-4; DM-1..DM-5).
 *
 * One use case over injected ports: resolve the change branch structurally, read
 * the invocation checkout's head, perform exactly one fast-forward push through
 * the delivered seam, append one durable lane-push record, and answer the
 * verdict/branch/head/cause/recorded facts. Act first, append second: a failed
 * append is disclosed as `recorded: false`, never a record claiming a push that
 * did not happen. Nothing is authored, amended, reset, or forced.
 */
import {
  DISPATCH_LANE_PUSH_PAYLOAD_SCHEMA,
  type DispatchLanePushActOutcome,
  type DispatchLanePushRecord,
  type PushCommandData,
  isSafeRef,
  PROTECTED_REF_NAMES,
} from "#contracts";
import { selectMatchingBranch } from "../domain/closeout.js";
import {
  type LanePushResolution,
  lanePushVerdictOfAct,
  resolveLanePushBranch,
} from "../domain/dispatch-lane-push.js";

export type { DispatchLanePushActOutcome } from "#contracts";

/** One local branch fact the convention read exposes. */
export type LanePushBranchFact = {
  readonly name: string;
  readonly head: string;
};

/** The lane identity a lane-push record is bound to when it is readable. */
export type LanePushIdentity = {
  readonly attemptId: string;
  readonly sessionId: string;
};

/** The injected ports the use case composes; every I/O edge is injected. */
export type DispatchLanePushPorts = {
  /** The normalized repository identity the record carries. */
  readonly repository: string;
  /** The change record's opaque `branch:` value, when the document carries one. */
  readonly readBranchDeclaration: (ref: string) => string | undefined;
  /** The delivered convention-narrowed local branch read. */
  readonly listBranches: (input: {
    readonly workItemRef: string;
  }) => Promise<readonly LanePushBranchFact[]>;
  /** The delivered local checkout/head read: the record's and answer's `head`. */
  readonly readCheckoutHead: (branch: string) => Promise<string | undefined>;
  /** The newest durable lane record's identity, or absent when unreadable/none. */
  readonly readLaneIdentity: (ref: string) => LanePushIdentity | undefined;
  /** The delivered fast-forward push seam: one attempt, no retry. */
  readonly pushChangeBranch: (input: {
    readonly branch: string;
  }) => Promise<DispatchLanePushActOutcome>;
  /** One append of the durable record; `ok: false` is the disclosed unrecorded act. */
  readonly appendRecord: (
    record: DispatchLanePushRecord,
  ) => { readonly ok: boolean } | Promise<{ readonly ok: boolean }>;
  /** The injected instant the record and the answer carry. */
  readonly nowIso: () => string;
};

/** The refusal arm: a typed pre-act resolution refusal (no act, no record). */
export type DispatchLanePushRefusal = Extract<LanePushResolution, { readonly kind: "refused" }>;

/** The answer arm: the declared DM-5 data. */
export type DispatchLanePushAnswered = {
  readonly kind: "answered";
  readonly data: PushCommandData;
};

export type DispatchLanePushResult = DispatchLanePushRefusal | DispatchLanePushAnswered;

/**
 * Resolve, act, append, answer.
 *
 * The reads happen once per invocation (NFR-2): one pm-notes declaration read,
 * one local branch read, one lane read, one checkout/head read, one push, and
 * one record append. A pre-act refusal returns before the head read, the act,
 * and the append, so it leaves no durable fact (RSK-10).
 */
export const runDispatchLanePush = async (
  ports: DispatchLanePushPorts,
  input: { readonly ref: string },
): Promise<DispatchLanePushResult> => {
  const ref = input.ref;
  const declaration = ports.readBranchDeclaration(ref);
  const branches = await ports.listBranches({ workItemRef: ref });
  const selection = selectMatchingBranch({ branches, workItemRef: ref });
  const resolution = resolveLanePushBranch({
    selection,
    ...(declaration === undefined ? {} : { declaration }),
    isSafe: isSafeRef,
    protectedNames: PROTECTED_REF_NAMES,
  });
  if (resolution.kind === "refused") return resolution;

  const identity = ports.readLaneIdentity(ref);
  // The head the lane pushes: read from the invocation checkout at act time,
  // never a value the transport reports (DM-1). An unreadable head leaves the
  // record unwritten and the act still performed.
  const head = (await ports.readCheckoutHead(resolution.branch)) ?? "";
  const act = await ports.pushChangeBranch({ branch: resolution.branch });
  const verdict = lanePushVerdictOfAct(act);
  const recordedAt = ports.nowIso();
  const record: DispatchLanePushRecord = {
    schema: DISPATCH_LANE_PUSH_PAYLOAD_SCHEMA,
    ref,
    repository: ports.repository,
    branch: resolution.branch,
    head,
    verdict: verdict.verdict,
    ...(verdict.cause === undefined ? {} : { cause: verdict.cause }),
    ...(identity === undefined
      ? {}
      : { attemptId: identity.attemptId, sessionId: identity.sessionId }),
    recordedAt,
  };
  const appended = head === "" ? { ok: false as const } : await ports.appendRecord(record);

  return {
    kind: "answered",
    data: {
      ref,
      repository: ports.repository,
      lanePush: {
        verdict: verdict.verdict,
        branch: resolution.branch,
        head,
        ...(verdict.cause === undefined ? {} : { cause: verdict.cause }),
        recorded: appended.ok,
        ...(appended.ok ? { recordedAt } : {}),
      },
    },
  };
};
