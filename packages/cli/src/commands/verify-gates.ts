/**
 * `verify gates` handler (GH-178 F-1..F-10).
 *
 * The handler orchestrates already-injected reads, feeds one frozen fact bundle
 * to the pure evaluator, and returns data or one classified error. It never
 * writes a stream or chooses an exit code; grammar validation happens before any
 * call. `verify change` remains on its own untouched handler path.
 */

import type { MergeEffectiveGateSet } from "@delivery-os/core";
import {
  capsuleDisclosureOf,
  capsuleGateEventKey,
  classifyVerifyDocument,
  EvaluateVerifyChange,
  evaluateCrossRepositoryGates,
  evaluateDeclaredBattery,
  isFullHexSha,
  ownerAttentionLabels,
  renderVerifyGatesFailureSummary,
  resolveOpenPr,
  type VerifyGatesCheckRunPage,
  type VerifyGatesDetail,
  type VerifyGatesFacts,
  type VerifyGatesMemberReads,
  type VerifyGatesOpenPrPage,
  type VerifyGatesReadResult,
  type VerifyGatesRepositoryFacts,
  type VerifyGatesWorkflowFacts,
  type VerifyGatesWorkItem,
  verifyGatesUnknownIdentity,
} from "@delivery-os/core";
import {
  type CapsuleDisclosure,
  type CapsuleProducerPort,
  type CrossRepositoryVerifyGatesReport,
  MERGE_GATE_VERIFICATION_SCHEMA,
  type MemberLandingObservation,
  type MergeGateVerificationRecord,
  type PhaseTransitionRecord,
  type PlanMemberDeclaration,
  type PmNotesParseFailure,
  type ReviewObservation,
  type StateFailure,
  VERIFY_GATES_CI_RUN_LIMIT,
  VERIFY_GATES_MAX_MEMBERS,
  VERIFY_GATES_OPEN_PR_LIMIT,
  VERIFY_GATES_SCHEMA_VERSION,
} from "@delivery-os/core/contracts";
import type { CommandHandler } from "../index.js";

/** A pm-notes target read at the edge: values, absence, or a safe parse failure. */
export type VerifyGatesPmNotesRead =
  | { readonly ok: true; readonly file: string; readonly text: string; readonly value: unknown }
  | { readonly ok: false; readonly reason: "missing" }
  | {
      readonly ok: false;
      readonly reason: "malformed";
      readonly file: string;
      readonly parseFailure: PmNotesParseFailure;
    };

/** A presence-tolerant verified registry read: evidence, or a state failure. */
export type VerifyGatesRegistryRead =
  | {
      readonly ok: true;
      readonly present: boolean;
      readonly verifiedEmpty: boolean;
      readonly transitions: readonly PhaseTransitionRecord[];
      readonly recordCount: number;
    }
  | { readonly ok: false; readonly error: StateFailure };

/** One member's injected reads, bounded to the delivered provider shapes. */
export type VerifyGatesMemberReadsInput = VerifyGatesMemberReads;

/**
 * The additive cross-repository composition seam (GH-310 F-3, F-6, DEC-17,
 * DEC-19). Absent, the delivered single-target handler runs unchanged and the
 * member-less bytes stay identical. Present, the handler performs exactly one
 * bounded read per declared member (one open-PR page, one detail read, one
 * check-run page inside the supplied read), with no retry and no pagination,
 * and landing/review truth arrive only as injected observations.
 */
export type VerifyGatesMemberRuntime = {
  /** The declared member set for the change (one bounded local plan read). */
  readonly readMembers: (changeRef: string) => readonly PlanMemberDeclaration[] | undefined;
  /** One bounded read bundle per declared member. */
  readonly readMemberReads: (
    member: PlanMemberDeclaration,
  ) => Promise<VerifyGatesMemberReadsInput> | VerifyGatesMemberReadsInput;
  /** The injected landing observations, one per declared member (DM-10). */
  readonly readLandingObservations?: (changeRef: string) => readonly MemberLandingObservation[];
  /** The injected review observations (DEC-17). */
  readonly readReviewObservations?: (changeRef: string) => readonly ReviewObservation[];
};

/** Every gates read, injected; all I/O and provider access stays at the edge. */
export type VerifyGatesCommandRuntime = {
  readonly readLifecycle: (changeRef: string) => {
    readonly document: VerifyGatesPmNotesRead;
    readonly registry: VerifyGatesRegistryRead;
  };
  readonly readRepository: () => VerifyGatesRepositoryFacts;
  readonly readWorkflow: () => VerifyGatesWorkflowFacts;
  readonly readOpenPullRequests: (
    limit: number,
  ) => Promise<VerifyGatesReadResult<VerifyGatesOpenPrPage>>;
  readonly readDeliveryRequestDetail: (
    pullNumber: string,
  ) => Promise<VerifyGatesReadResult<VerifyGatesDetail>>;
  readonly readCheckRuns: (
    sha: string,
    limit: number,
  ) => Promise<VerifyGatesReadResult<VerifyGatesCheckRunPage>>;
  readonly readWorkItem: (changeRef: string) => Promise<VerifyGatesReadResult<VerifyGatesWorkItem>>;
  /** The additive cross-repository seam; absent keeps the delivered path. */
  readonly members?: VerifyGatesMemberRuntime;
  /** The resolved declared gate set (or a classified configuration failure). */
  readonly readGateSet: () =>
    | { readonly ok: true; readonly value: MergeEffectiveGateSet }
    | { readonly ok: false; readonly code: string; readonly detail?: string };
  /** Append exactly one fenced verification record (EVT-1). */
  readonly appendVerification: (
    record: MergeGateVerificationRecord,
  ) => { readonly ok: true } | { readonly ok: false; readonly code: string };
  /** The injected clock in epoch milliseconds (EVT-1 verification time). */
  readonly nowMs: () => number;
  /** The non-gating capsule append point (GH-240 F-2, DEC-2). */
  readonly capsule?: CapsuleProducerPort;
};

/** Append one `gate.outcome` event; never changes the primary outcome (F-2). */
const appendGateCapsule = (
  runtime: VerifyGatesCommandRuntime,
  input: {
    readonly changeRef: string;
    readonly gateSet: string;
    readonly headSha: string;
    readonly gates: readonly {
      readonly id: string;
      readonly verdict: string;
      readonly reason: string;
    }[];
  },
): CapsuleDisclosure | undefined => {
  if (runtime.capsule === undefined) return undefined;
  const eventKey = capsuleGateEventKey(input.gateSet, input.headSha);
  const gates = input.gates;
  try {
    return capsuleDisclosureOf(
      runtime.capsule.append({
        changeRef: input.changeRef,
        writer: "verify",
        kind: "gate.outcome",
        eventKey,
        payload: {
          gateSet: input.gateSet,
          headSha: input.headSha,
          gates: gates.map((gate) => ({
            gateId: gate.id,
            verdict: gate.verdict,
            reason: gate.reason,
          })),
        },
      }),
      eventKey,
    );
  } catch {
    return {
      appended: false,
      eventKey,
      code: "capsule.append-failed",
      detail: "the capsule append threw",
    };
  }
};

type VerifyGatesFailure = { readonly ok: false; readonly error: Record<string, unknown> };
type VerifyGatesSuccess = { readonly ok: true; readonly data: Record<string, unknown> };

const GRAMMAR_SUMMARY = "result=failed; variant=unknown; missing=-";

const failure = (kind: string, code: string, summary?: string): VerifyGatesFailure => ({
  ok: false,
  error: {
    kind,
    code,
    ...(summary === undefined ? {} : { summary }),
  },
});

const notAttempted = <T>(
  reason: "address-unresolved" | "not-attempted",
): VerifyGatesReadResult<T> =>
  reason === "not-attempted"
    ? { ok: false, reason: "not-attempted" }
    : { ok: false, reason: "address-unresolved" };

const lifecycleEvaluation = (
  runtime: VerifyGatesCommandRuntime,
  changeRef: string,
): VerifyGatesFacts["lifecycle"]["evaluation"] => {
  const read = runtime.readLifecycle(changeRef);
  const document = read.document.ok
    ? classifyVerifyDocument({ ok: true, value: read.document.value })
    : read.document.reason === "missing"
      ? {
          ok: false as const,
          kind: "lint" as const,
          code: "lint.target.missing",
          summary: GRAMMAR_SUMMARY,
        }
      : classifyVerifyDocument({
          ok: false,
          parseFailure: read.document.parseFailure,
        });
  return EvaluateVerifyChange({
    changeRef,
    document,
    registry: read.registry,
  });
};

const readProviderFacts = async (
  runtime: VerifyGatesCommandRuntime,
  changeRef: string,
  repository: VerifyGatesRepositoryFacts,
): Promise<{
  readonly openPullRequests: VerifyGatesReadResult<VerifyGatesOpenPrPage>;
  readonly deliveryRequestDetail: VerifyGatesReadResult<VerifyGatesDetail>;
  readonly checkRuns: VerifyGatesReadResult<VerifyGatesCheckRunPage>;
  readonly workItem: VerifyGatesReadResult<VerifyGatesWorkItem>;
}> => {
  if (repository.binding !== "resolved") {
    return {
      openPullRequests: notAttempted<VerifyGatesOpenPrPage>("address-unresolved"),
      deliveryRequestDetail: notAttempted<VerifyGatesDetail>("address-unresolved"),
      checkRuns: notAttempted<VerifyGatesCheckRunPage>("address-unresolved"),
      workItem: notAttempted<VerifyGatesWorkItem>("address-unresolved"),
    };
  }
  if (repository.head.detached || repository.head.branch === undefined) {
    return {
      openPullRequests: notAttempted<VerifyGatesOpenPrPage>("not-attempted"),
      deliveryRequestDetail: notAttempted<VerifyGatesDetail>("not-attempted"),
      checkRuns: notAttempted<VerifyGatesCheckRunPage>("not-attempted"),
      workItem: await runtime.readWorkItem(changeRef),
    };
  }
  const openPullRequests = await runtime.readOpenPullRequests(VERIFY_GATES_OPEN_PR_LIMIT);
  if (!openPullRequests.ok) {
    return {
      openPullRequests,
      deliveryRequestDetail: notAttempted<VerifyGatesDetail>("not-attempted"),
      checkRuns: notAttempted<VerifyGatesCheckRunPage>("not-attempted"),
      workItem: await runtime.readWorkItem(changeRef),
    };
  }
  const resolution = resolveOpenPr({
    branch: repository.head.branch,
    detached: false,
    pageItemCount: openPullRequests.value.pageItemCount,
    items: openPullRequests.value.items,
  });
  if (resolution.outcome !== "resolved" || resolution.deliveryRequest === undefined) {
    return {
      openPullRequests,
      deliveryRequestDetail: notAttempted<VerifyGatesDetail>("not-attempted"),
      checkRuns: notAttempted<VerifyGatesCheckRunPage>("not-attempted"),
      workItem: await runtime.readWorkItem(changeRef),
    };
  }
  const deliveryRequestDetail = await runtime.readDeliveryRequestDetail(
    resolution.deliveryRequest.identity.entityId,
  );
  if (
    !deliveryRequestDetail.ok ||
    !isFullHexSha(deliveryRequestDetail.value.request.sourceHeadSha)
  ) {
    return {
      openPullRequests,
      deliveryRequestDetail,
      checkRuns: notAttempted<VerifyGatesCheckRunPage>("not-attempted"),
      workItem: await runtime.readWorkItem(changeRef),
    };
  }
  const checkRuns = await runtime.readCheckRuns(
    deliveryRequestDetail.value.request.sourceHeadSha,
    VERIFY_GATES_CI_RUN_LIMIT,
  );
  return {
    openPullRequests,
    deliveryRequestDetail,
    checkRuns,
    workItem: await runtime.readWorkItem(changeRef),
  };
};

/**
 * Evaluate one change over its declared member set (GH-310 F-3, F-6).
 *
 * One bounded read bundle per declared member; no retry, no pagination, and no
 * read outside the declared set. The report is data-bearing on every status and
 * `overall: "fail"` is the sole carrier of the delivered `verify.gates.failed`
 * classification; no error envelope is produced for a negative verdict.
 */
/**
 * The change-level tracker posture of the appended record (DEC-22): the
 * delivered derivation reads the change's own work item through the declared
 * `owner-gate` entry, so a member-declaring run reports the change's own
 * attention labels rather than whichever member happens to hold the first
 * `owner-gate` record.
 */
const changeLevelOwnerLabels = (
  workItem: VerifyGatesReadResult<VerifyGatesWorkItem>,
  batteryEntries: MergeEffectiveGateSet["batteryEntries"],
): readonly string[] => {
  if (!batteryEntries.some((entry) => entry.id === "owner-gate")) return [];
  return workItem.ok ? ownerAttentionLabels(workItem.value.item.labels) : [];
};

const crossRepositoryEvaluation = async (
  runtime: VerifyGatesCommandRuntime,
  members: VerifyGatesMemberRuntime,
  changeRef: string,
  declared: readonly PlanMemberDeclaration[],
  gateSet: MergeEffectiveGateSet,
): Promise<VerifyGatesSuccess | VerifyGatesFailure> => {
  const repository = runtime.readRepository();
  const evaluation = lifecycleEvaluation(runtime, changeRef);
  const workflow = runtime.readWorkflow();
  const workItem = await runtime.readWorkItem(changeRef);
  const readings: { readonly member: PlanMemberDeclaration; readonly facts: VerifyGatesFacts }[] =
    [];
  for (const member of declared.slice(0, VERIFY_GATES_MAX_MEMBERS)) {
    const reads = await members.readMemberReads(member);
    readings.push({
      member,
      facts: {
        changeRef,
        lifecycle: { evaluation },
        repository: reads.repository,
        workflow,
        openPullRequests: reads.openPullRequests,
        deliveryRequestDetail: reads.deliveryRequestDetail,
        checkRuns: reads.checkRuns,
        workItem,
      },
    });
  }
  const report: CrossRepositoryVerifyGatesReport = evaluateCrossRepositoryGates({
    changeRef,
    readings,
    batteryEntries: gateSet.batteryEntries,
    landings: members.readLandingObservations?.(changeRef) ?? [],
    reviews: members.readReviewObservations?.(changeRef) ?? [],
  });
  // DEC-22: the durable ledger never carries the report's `member` discriminator.
  // Each member record is projected to the delivered record shape, preserving
  // `id`, `verdict`, `reason`, and `citation` in record order and count.
  const ledgerGates = report.gates.map(({ id, verdict, reason, citation }) => ({
    id,
    verdict,
    reason,
    citation,
  }));
  const record: MergeGateVerificationRecord = {
    schema: MERGE_GATE_VERIFICATION_SCHEMA,
    changeRef,
    headSha: repository.head.sha ?? "",
    verifiedAt: new Date(runtime.nowMs()).toISOString(),
    gateSet: { schemaVersion: gateSet.schemaVersion, ids: gateSet.ids },
    gates: ledgerGates,
    trackerPosture: {
      labels: [],
      ownerLabels: changeLevelOwnerLabels(workItem, gateSet.batteryEntries),
    },
  };
  const appended = runtime.appendVerification(record);
  if (!appended.ok) {
    return failure("state", appended.code, `result=error; condition=${appended.code}`);
  }
  const capsule = appendGateCapsule(runtime, {
    changeRef,
    gateSet: `${gateSet.schemaVersion}:${gateSet.ids.join(",")}`,
    headSha: record.headSha,
    gates: report.gates,
  });
  const data: Record<string, unknown> = {
    ...report,
    ...(capsule === undefined ? {} : { capsule }),
  };
  return { ok: true, data } satisfies VerifyGatesSuccess;
};

/** Build the gates handler over the injected read seam. */
export const createVerifyGatesHandler = (runtime: VerifyGatesCommandRuntime): CommandHandler => {
  return async (invocation) => {
    const ref = invocation.positionals[1];
    if (
      invocation.positionals.length !== 2 ||
      invocation.positionals[0] !== "gates" ||
      ref === undefined ||
      ref.length === 0
    ) {
      return failure("input", "input.value.rejected", GRAMMAR_SUMMARY);
    }
    const gateSet = runtime.readGateSet();
    if (!gateSet.ok) {
      return failure(
        "config",
        gateSet.code,
        `result=failed; condition=${gateSet.code}${gateSet.detail === undefined ? "" : `; evidence=${gateSet.detail}`}`,
      );
    }
    const members = runtime.members;
    const declared = members?.readMembers(ref);
    if (members !== undefined && declared !== undefined && declared.length > 0) {
      return crossRepositoryEvaluation(runtime, members, ref, declared, gateSet.value);
    }
    const repository = runtime.readRepository();
    const evaluation = lifecycleEvaluation(runtime, ref);
    const workflow = runtime.readWorkflow();
    const provider = await readProviderFacts(runtime, ref, repository);
    const facts: VerifyGatesFacts = {
      changeRef: ref,
      lifecycle: { evaluation },
      repository,
      workflow,
      ...provider,
    };
    const evaluated = evaluateDeclaredBattery(facts, gateSet.value.batteryEntries);
    const ownerGate = evaluated.gates.find((gate) => gate.id === "owner-gate");
    const ownerNames = ownerGate?.citation.names.find((list) => list.kind === "owner-labels");
    const record: MergeGateVerificationRecord = {
      schema: MERGE_GATE_VERIFICATION_SCHEMA,
      changeRef: ref,
      headSha: repository.head.sha ?? "",
      verifiedAt: new Date(runtime.nowMs()).toISOString(),
      gateSet: { schemaVersion: gateSet.value.schemaVersion, ids: gateSet.value.ids },
      gates: evaluated.gates,
      trackerPosture: {
        labels: [],
        ownerLabels: ownerNames?.values ?? [],
      },
    };
    const appended = runtime.appendVerification(record);
    if (!appended.ok) {
      return failure("state", appended.code, `result=error; condition=${appended.code}`);
    }
    const gateSetIdentity = `${gateSet.value.schemaVersion}:${gateSet.value.ids.join(",")}`;
    const capsule = appendGateCapsule(runtime, {
      changeRef: ref,
      gateSet: gateSetIdentity,
      headSha: record.headSha,
      gates: evaluated.gates,
    });
    if (evaluated.overall === "pass") {
      const data: Record<string, unknown> = {
        schemaVersion: VERIFY_GATES_SCHEMA_VERSION,
        changeRef: ref,
        target: "gates",
        overall: "pass",
        summary: evaluated.summary,
        gates: evaluated.gates,
        ...(capsule === undefined ? {} : { capsule }),
      };
      return { ok: true, data } satisfies VerifyGatesSuccess;
    }
    const summary = renderVerifyGatesFailureSummary(evaluated);
    const failed = (kind: string, code: string): VerifyGatesFailure => ({
      ok: false,
      error: {
        kind,
        code,
        summary,
        ...(capsule === undefined ? {} : { capsule }),
      },
    });
    if (evaluated.overall === "fail") {
      return failed("verify", "verify.gates.failed");
    }
    const identity = verifyGatesUnknownIdentity(evaluated);
    return identity === undefined
      ? failed("verify", "verify.gates.unavailable")
      : failed(identity.domainKind, identity.code);
  };
};
