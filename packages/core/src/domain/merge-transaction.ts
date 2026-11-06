/**
 * The pure merge transaction composition (GH-225 F-2..F-8, DEC-1..DEC-12).
 *
 * No I/O is performed here: every provider read, state read/append, git
 * mutation, clock, and identity arrives through injected ports. The transaction
 * consumes the recorded verification, enforces the freshness envelope,
 * re-probes the transition-sensitive facts, verifies and records waivers,
 * attempts exactly one rebase-refresh, lands one squash commit, verifies the
 * landing, and records the outcome. It never waits, never retries unboundedly,
 * and cannot express a force operation.
 */
import {
  type DeliveryRequest,
  ERROR_TABLE,
  ERROR_TABLE_FAMILIES,
  FALLBACK_INTERNAL_CODE,
  MERGE_GATE_FRESHNESS_DEFAULT_SECONDS,
  MERGE_GATE_VERIFICATION_SCHEMA,
  MERGE_MAX_CONFLICT_PATHS,
  MERGE_MAX_EVIDENCE_NAME_CHARS,
  MERGE_MAX_EVIDENCE_NAMES,
  MERGE_MAX_HUMAN_BYTES,
  MERGE_MAX_HUMAN_LINES,
  MERGE_MAX_REPORT_GATES,
  MERGE_MAX_WAIVER_REFS,
  MERGE_POST_LANDING_STEP_IDS,
  MERGE_TRANSACTION_SCHEMA,
  type MergeDryRunAuthorization,
  type MergeDryRunReport,
  type MergeGateEntry,
  type MergeGateSetIdentity,
  type MergeGateVerdictRecord,
  type MergeGateVerificationRecord,
  type MergePostLandingStatus,
  type MergePostLandingStep,
  type MergeRefreshEvidence,
  type MergeReport,
  type MergeStateRead,
  type MergeStateReadReason,
  type MergeTransactionRecord,
  type MergeWaiverDeclaration,
  type MergeWaiverRecord,
  type OwnerGateSlaPolicy,
  type OwnerGateSlaPolicyRow,
  type PipelineRun,
  type VerifyGateCitation,
  type VerifyGateCount,
  type VerifyGateNameList,
  type VerifyGateReason,
  type WorkItem,
} from "#contracts";
import { evaluateMergeFreshness } from "./merge-freshness.js";
import type { MergeEffectiveGateSet } from "./merge-gate-set.js";
import { resolveMergeGateSet } from "./merge-gate-set.js";
import {
  classifyTrackerTransition,
  evaluateRequiredJobGate,
  newRedJobs,
  postureOf,
  recordedFailedJobs,
} from "./merge-probe.js";
import { authorizeMergeWaiver } from "./merge-waiver.js";

/** A merge read outcome with a declared failure identity on failure. */
export type MergeRead<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: string };

/** The bounded check-run page consumed by the probe. */
export type MergeCheckRunPage = {
  readonly items: readonly PipelineRun[];
  readonly pageItemCount: number;
  readonly sha?: string;
};

/** The parsed work-item read. */
export type MergeWorkItemRead =
  | { readonly ok: true; readonly item: WorkItem }
  | { readonly ok: false; readonly code: string };

/** The parsed request-detail read. */
export type MergeRequestDetailRead =
  | { readonly ok: true; readonly request: DeliveryRequest }
  | { readonly ok: false; readonly code: string };

/** The single refresh attempt's outcome. */
export type MergeRefreshResult =
  | { readonly outcome: "conflicted"; readonly paths: readonly string[] }
  | { readonly outcome: "succeeded"; readonly oldSha: string; readonly newSha: string }
  | { readonly outcome: "failed"; readonly code: string };

/** The landing mutation's outcome. */
export type MergeLandResult =
  | {
      readonly ok: true;
      readonly squashSha: string;
      readonly requestState: string;
      readonly containedOnBase: boolean | "failed";
    }
  | { readonly ok: false; readonly code: string };

/** Every I/O and time seam the transaction consumes. */
export type MergeTransactionPorts = {
  readonly nowIso: () => string;
  readonly nowMs: () => number;
  readonly readVerification: () => MergeStateRead<MergeGateVerificationRecord>;
  readonly readTransactions: () => MergeStateRead<MergeTransactionRecord>;
  readonly readWaivers: () => MergeStateRead<MergeWaiverRecord>;
  readonly appendVerification: (
    record: MergeGateVerificationRecord,
  ) => { readonly ok: true } | { readonly ok: false; readonly code: string };
  readonly appendWaiver: (
    record: MergeWaiverRecord,
  ) => { readonly ok: true } | { readonly ok: false; readonly code: string };
  readonly appendTransaction: (
    record: MergeTransactionRecord,
  ) => { readonly ok: true } | { readonly ok: false; readonly code: string };
  readonly readWorkItem: () => Promise<MergeWorkItemRead>;
  readonly readCheckRuns: (sha: string) => Promise<MergeRead<MergeCheckRunPage>>;
  readonly readRequestDetail: () => Promise<MergeRequestDetailRead>;
  readonly readHead: () => Promise<string | undefined>;
  readonly readBaseContainment: (sha: string) => Promise<boolean | "failed">;
  readonly refresh: () => Promise<MergeRefreshResult>;
  readonly land: (input: {
    readonly baseRef: string;
    readonly branch?: string;
  }) => Promise<MergeLandResult>;
  readonly deleteBranch: (input: { readonly branch?: string }) => Promise<"ok" | "failed">;
};

/** The resolved configuration the transaction consumes. */
export type MergeTransactionConfig = {
  readonly gateSet: MergeEffectiveGateSet;
  readonly freshnessBoundSeconds: number;
  readonly comparator: OwnerGateSlaPolicy["comparator"];
  readonly policy: OwnerGateSlaPolicy;
  readonly ownerPrincipal?: string;
  readonly baseRef: string;
  readonly branch?: string;
};

/** Structured refusal evidence (delivery-bound rendering). */
export type MergeFailureEvidence = {
  readonly ageMs?: number;
  readonly boundMs?: number;
  readonly recordedSha?: string;
  readonly currentSha?: string;
  readonly oldSha?: string;
  readonly newSha?: string;
  readonly setAdded?: readonly string[];
  readonly setRemoved?: readonly string[];
  readonly jobs?: readonly string[];
  readonly transitionBefore?: readonly string[];
  readonly transitionAfter?: readonly string[];
  readonly transitionAgeMs?: number;
  readonly paths?: readonly string[];
  readonly attempts?: number;
  readonly stateReason?: string;
  readonly gateId?: string;
  readonly gateClass?: string;
  readonly authorizer?: string;
  readonly overridePath?: string;
  readonly requestState?: string;
  readonly detail?: string;
};

/** One classified merge failure. */
export type MergeFailure = {
  readonly code: string;
  readonly domainKind: "merge" | "state" | "provider";
  readonly exit: 0 | 1 | 2;
  readonly evidence: MergeFailureEvidence;
};

/** The transaction outcome. */
export type MergeTransactionOutcome =
  | { readonly kind: "merged"; readonly report: MergeReport }
  | {
      readonly kind: "dry-run";
      readonly report: MergeDryRunReport;
      readonly authorizations: readonly MergeDryRunAuthorization[];
    }
  | {
      readonly kind: "refused";
      readonly failure: MergeFailure;
      readonly summary: string;
    };

type GateFailure = {
  readonly entry: MergeGateEntry;
  readonly code: string;
  readonly evidence: MergeFailureEvidence;
};

const failureCode = (gateId: string): string => `merge.gate.${gateId}.failed`;

const clamp = (value: string, maximum: number): string =>
  value.length > maximum ? value.slice(0, maximum) : value;

const clampList = (
  values: readonly string[],
  maximum = MERGE_MAX_EVIDENCE_NAMES,
): { readonly values: readonly string[]; readonly omitted: number } => {
  const clamped = values
    .slice(0, maximum)
    .map((value) => clamp(value, MERGE_MAX_EVIDENCE_NAME_CHARS));
  return { values: clamped, omitted: Math.max(0, values.length - clamped.length) };
};

const listText = (values: readonly string[], maximum = MERGE_MAX_EVIDENCE_NAMES): string => {
  if (values.length === 0) return "-";
  const { values: shown, omitted } = clampList(values, maximum);
  return omitted > 0 ? `${shown.join(",")} +${omitted}` : shown.join(",");
};

const durationSeconds = (milliseconds: number | undefined): string => {
  if (milliseconds === undefined) return "-";
  const seconds = Math.round(milliseconds / 1000);
  return seconds > 0 && seconds % 60 === 0 ? `${seconds / 60}m` : `${seconds}s`;
};

const shortSha = (value: string | undefined): string =>
  value === undefined || value.length === 0 ? "-" : value.slice(0, 7);

const citationFor = (input: {
  readonly identity: VerifyGateCitation["identity"];
  readonly sources: VerifyGateCitation["sources"];
  readonly counts: readonly VerifyGateCount[];
  readonly names: readonly VerifyGateNameList[];
  readonly reason: VerifyGateReason;
}): VerifyGateCitation => ({
  sources: input.sources,
  identity: input.identity,
  counts: input.counts,
  names: input.names,
  reasons: [input.reason],
});

const emptyCitation = (changeRef: string): VerifyGateCitation =>
  citationFor({
    identity: { changeRef },
    sources: [],
    counts: [],
    names: [],
    reason: "read-failed",
  });

const recordedVerdict = (
  record: MergeGateVerificationRecord | undefined,
  gateId: string,
): MergeGateVerdictRecord | undefined => record?.gates.find((gate) => gate.id === gateId);

const recordedFailed = (record: MergeGateVerificationRecord | undefined): readonly string[] =>
  recordedFailedJobs(record?.gates.find((gate) => gate.id === "ci-green")?.citation.names);

const gateFailureFor = (
  entry: MergeGateEntry,
  verdict: MergeGateVerdictRecord | undefined,
  detail?: string,
): GateFailure => ({
  entry,
  code: failureCode(entry.id),
  evidence: {
    gateId: entry.id,
    ...(verdict === undefined ? {} : { detail: verdict.reason }),
    ...(detail === undefined ? {} : { detail }),
  },
});

const stateFailure = (
  reason: MergeStateReadReason,
  domainKind: "state" | "merge",
  detail?: string,
): MergeFailure => ({
  code: "merge.state-unverified",
  domainKind,
  exit: 2,
  evidence: { stateReason: reason, ...(detail === undefined ? {} : { detail }) },
});

const readFailure = (code: string): MergeFailure => ({
  code,
  domainKind: "provider",
  exit: 2,
  evidence: { detail: code },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Resolve the declared base reference from the request target or a default. */
export const mergeBaseRef = (request: DeliveryRequest | undefined): string =>
  request?.targetRef !== undefined && request.targetRef.length > 0
    ? request.targetRef
    : "main-tools";

/**
 * Run the merge transaction (or its dry-run form).
 *
 * Every returned refusal is classified; the caller maps `domainKind` and `exit`
 * onto the result contract. The summary is deterministic and bounded.
 */
export const runMergeTransaction = async (input: {
  readonly changeRef: string;
  readonly dryRun: boolean;
  readonly waiverDeclarations: readonly MergeWaiverDeclaration[];
  readonly config: MergeTransactionConfig;
  readonly ports: MergeTransactionPorts;
}): Promise<MergeTransactionOutcome> => {
  const { changeRef, config, ports, dryRun } = input;
  const gateSetIdentity: MergeGateSetIdentity = {
    schemaVersion: config.gateSet.schemaVersion,
    ids: config.gateSet.ids,
  };
  const nowIso = ports.nowIso();
  const nowMs = ports.nowMs();

  if (dryRun) {
    return runDryRun({
      changeRef,
      config,
      ports,
      nowIso,
      nowMs,
      gateSetIdentity,
      declarations: input.waiverDeclarations,
    });
  }

  // 1. Idempotent replay: a recorded contained landing replays without a second
  // landing and without requiring a fresh verification (DEC-12, NFR-9).
  const transactions = ports.readTransactions();
  if (!transactions.ok) {
    return refused(stateFailure(transactions.reason, "state", transactions.code));
  }
  const latestTransaction = transactions.records.at(-1);
  if (latestTransaction !== undefined) {
    if (latestTransaction.result === "merged" && latestTransaction.squashSha !== undefined) {
      const contained = await ports.readBaseContainment(latestTransaction.squashSha);
      if (contained === true) {
        return { kind: "merged", report: replayReport(latestTransaction) };
      }
      return refused({
        code: "merge.landing-unverified",
        domainKind: "merge",
        exit: 2,
        evidence: {
          recordedSha: latestTransaction.squashSha,
          detail: contained === "failed" ? "containment-read-failed" : "not-contained",
        },
      });
    }
    if (
      latestTransaction.result === "landing-unverified" &&
      latestTransaction.squashSha !== undefined
    ) {
      const contained = await ports.readBaseContainment(latestTransaction.squashSha);
      if (contained === true) {
        return { kind: "merged", report: replayReport(latestTransaction) };
      }
      return refused({
        code: "merge.landing-unverified",
        domainKind: "merge",
        exit: 2,
        evidence: { recordedSha: latestTransaction.squashSha, detail: "still-unverified" },
      });
    }
  }

  // 2. The freshness envelope over the newest verification record.
  const verification = ports.readVerification();
  if (!verification.ok) {
    return refused(stateFailure(verification.reason, "merge", verification.code));
  }
  const record = verification.records.at(-1);
  const head = await ports.readHead();
  if (head === undefined) {
    return refused(stateFailure("unreadable", "merge", "head-unresolved"));
  }
  const envelope = evaluateMergeFreshness({
    record,
    ...(record === undefined ? {} : {}),
    nowMs,
    boundSeconds: config.freshnessBoundSeconds,
    comparator: config.comparator,
    currentHeadSha: head,
    effectiveGateSet: gateSetIdentity,
  });
  if (!envelope.ok && envelope.kind === "state-unverified") {
    return refused(stateFailure(envelope.reason, "merge"));
  }

  // 3. One bounded probe: one work-item read, one check-run page, one
  // request-detail read.
  const workItem = await ports.readWorkItem();
  if (!workItem.ok) return refused(readFailure(workItem.code));
  const checkRuns = await ports.readCheckRuns(head);
  if (!checkRuns.ok) return refused(readFailure(checkRuns.code));
  const requestDetail = await ports.readRequestDetail();
  if (!requestDetail.ok) return refused(readFailure(requestDetail.code));

  // An already-merged request with no recorded transaction is the record-less
  // convergence case: append the outcome and replay, never re-land.
  if (requestDetail.request.reviewState === "merged") {
    const mergedHead = requestDetail.request.headSha;
    if (mergedHead !== undefined) {
      const contained = await ports.readBaseContainment(mergedHead);
      if (contained === true) {
        const replay: MergeTransactionRecord = {
          schema: MERGE_TRANSACTION_SCHEMA,
          changeRef,
          result: "merged",
          squashSha: mergedHead,
          replayed: true,
          landing: { shaOnBase: true, requestState: "merged" },
          refresh: { attempts: 0, outcome: "not-attempted" },
          waiverRefs: [],
          postLanding: [],
          recordedAt: nowIso,
        };
        const appended = ports.appendTransaction(replay);
        if (!appended.ok) {
          // The convergence verdict is already merged; the record append is a
          // declared cleanup failure, never silence (NFR-7).
          return {
            kind: "merged",
            report: reportFor(
              replay,
              [
                { id: "branch-deletion", status: "not-attempted" },
                { id: "closeout-ready", status: "failed" },
              ],
              [],
            ),
          };
        }
        return { kind: "merged", report: replayReport(replay) };
      }
    }
  }

  if (!envelope.ok) {
    const evidence: MergeFailureEvidence = {
      ageMs: envelope.ageMs,
      boundMs: envelope.boundMs,
      recordedSha: envelope.recordedSha,
      currentSha: envelope.currentSha,
      ...(envelope.setDelta === undefined
        ? {}
        : { setAdded: envelope.setDelta.added, setRemoved: envelope.setDelta.removed }),
      ...(() => {
        const jobs = newRedJobs({
          recordedFailed: recordedFailed(record),
          currentRuns: checkRuns.value.items,
          pageSha: checkRuns.value.sha ?? head,
          headSha: head,
        });
        return jobs.length === 0 ? {} : { jobs };
      })(),
    };
    return refused(
      envelope.reason === "age"
        ? {
            code: "merge.gates-stale",
            domainKind: "merge",
            exit: 1,
            evidence,
          }
        : {
            code: "merge.gates-stale",
            domainKind: "merge",
            exit: 1,
            evidence: { ...evidence, detail: envelope.reason },
          },
    );
  }

  // 4. Gate evaluation: the recorded verdicts plus the fresh probe.
  const posture = postureOf(workItem.item.labels, workItem.item.updatedAt);
  const transition =
    record === undefined
      ? { changed: false, before: [], after: [] }
      : classifyTrackerTransition({
          recorded: record.trackerPosture ?? { labels: [], ownerLabels: [] },
          current: posture,
          verifiedAt: record.verifiedAt,
        });
  const declaredJobNames = new Set(
    config.gateSet.entries
      .filter((entry) => entry.recipe === "required-ci-job")
      .map((entry) => entry.job ?? entry.id),
  );
  const jobs = newRedJobs({
    recordedFailed: recordedFailed(record),
    currentRuns: checkRuns.value.items,
    pageSha: checkRuns.value.sha ?? head,
    headSha: head,
  }).filter((name) => !declaredJobNames.has(name));
  const failures: GateFailure[] = [];
  const ownerPresent = posture.ownerLabels.length > 0;
  const recordedCi = recordedVerdict(record, "ci-green");
  if (recordedCi !== undefined && recordedCi.verdict !== "pass") {
    const entry = config.gateSet.enforcedMergeEntries.find(
      (candidate) => candidate.id === "ci-green",
    );
    if (entry !== undefined) failures.push(gateFailureFor(entry, recordedCi));
  }
  const recordedOwner = recordedVerdict(record, "owner-gate");
  if (recordedOwner !== undefined && recordedOwner.verdict !== "pass" && !transition.changed) {
    const entry = config.gateSet.enforcedMergeEntries.find(
      (candidate) => candidate.id === "owner-gate",
    );
    if (entry !== undefined && !ownerPresent) {
      failures.push(gateFailureFor(entry, recordedOwner));
    }
  }
  if (transition.changed) {
    const entry = config.gateSet.enforcedMergeEntries.find(
      (candidate) => candidate.id === "tracker-freshness",
    );
    if (entry !== undefined) {
      failures.push({
        entry,
        code: failureCode("tracker-freshness"),
        evidence: {
          gateId: "tracker-freshness",
          transitionBefore: transition.before,
          transitionAfter: transition.after,
          ...(transition.ageMs === undefined ? {} : { transitionAgeMs: transition.ageMs }),
        },
      });
    }
  }
  if (jobs.length > 0 && !failures.some((failure) => failure.entry.id === "ci-green")) {
    const entry = config.gateSet.enforcedMergeEntries.find(
      (candidate) => candidate.id === "ci-green",
    );
    if (entry !== undefined) {
      failures.push({
        entry,
        code: failureCode("ci-green"),
        evidence: { gateId: "ci-green", jobs },
      });
    }
  }
  const ownerFailure = ownerPresent && !transition.changed;
  if (ownerFailure && !failures.some((failure) => failure.entry.id === "owner-gate")) {
    const entry = config.gateSet.enforcedMergeEntries.find(
      (candidate) => candidate.id === "owner-gate",
    );
    if (entry !== undefined) {
      failures.push({
        entry,
        code: "merge.owner-gate-override-without-waiver",
        evidence: {
          gateId: "owner-gate",
          detail: "owner-gate-present",
          overridePath: "--waive owner-gate --waived-by <principal>",
        },
      });
    }
  }
  for (const entry of config.gateSet.enforcedMergeEntries) {
    if (entry.id === "ci-green" || entry.id === "owner-gate" || entry.id === "tracker-freshness") {
      continue;
    }
    const verdict = recordedVerdict(record, entry.id);
    if (entry.recipe === "required-ci-job") {
      const evaluationValue = evaluateRequiredJobGate({
        jobName: entry.job ?? entry.id,
        runs: checkRuns.value.items,
        pageSha: checkRuns.value.sha ?? head,
        headSha: head,
      });
      if (evaluationValue.verdict !== "pass") {
        failures.push({
          entry,
          code: failureCode(entry.id),
          evidence: {
            gateId: entry.id,
            detail: evaluationValue.reason,
            ...(() => {
              const failedJobs = evaluationValue.names.find(
                (list) => list.kind === "failed-jobs",
              )?.values;
              return failedJobs === undefined ? {} : { jobs: failedJobs };
            })(),
          },
        });
      }
      continue;
    }
    if (verdict !== undefined && verdict.verdict !== "pass") {
      failures.push(gateFailureFor(entry, verdict));
    }
  }
  // 5. Waiver authorization precedes recording; recording precedes mutation.
  const byGate = new Map(
    input.waiverDeclarations.map((declaration) => [declaration.gateId, declaration]),
  );
  if (byGate.size > 0) {
    const authorized: MergeWaiverRecord[] = [];
    for (const declaration of byGate.values()) {
      const entry = config.gateSet.enforcedMergeEntries.find(
        (candidate) => candidate.id === declaration.gateId,
      );
      const verdict = authorizeMergeWaiver({
        declaration,
        changeRef,
        entry,
        policy: config.policy,
        ownerPrincipal: config.ownerPrincipal,
        authorizedAt: nowIso,
      });
      if (!verdict.ok) {
        return refused({
          code: "merge.waiver-unauthorized",
          domainKind: "merge",
          exit: 1,
          evidence: {
            gateId: verdict.gateId,
            ...(verdict.gateClass === undefined ? {} : { gateClass: verdict.gateClass }),
            authorizer: verdict.authorizer,
            detail: verdict.reason,
          },
        });
      }
      authorized.push(verdict.record);
    }
    for (const waiver of authorized) {
      const appended = ports.appendWaiver(waiver);
      if (!appended.ok) {
        return refused({
          code: "merge.transaction-aborted",
          domainKind: "merge",
          exit: 1,
          evidence: { detail: appended.code },
        });
      }
    }
    // An owner-gate failure covered by an authorized declaration passes.
    const waived = new Set(authorized.map((waiver) => waiver.gateId));
    for (let index = failures.length - 1; index >= 0; index -= 1) {
      const failure = failures[index];
      if (failure !== undefined && waived.has(failure.entry.id)) failures.splice(index, 1);
    }
  }

  // 6. Precedence: a declared unauthorized override wins; then the override
  // path for an owner-gate failure with no declaration; then the gate rows.
  if (failures.length > 0) {
    return refused(failureFor(failures[0] as GateFailure));
  }

  // 7. Exactly one rebase-refresh attempt when the request is behind its base.
  let refresh: MergeRefreshEvidence = { attempts: 0, outcome: "not-attempted" };
  const behindBase = requestDetail.request.mergeableState === "conflicting";
  if (behindBase) {
    const refreshed = await ports.refresh();
    refresh = {
      attempts: 1,
      outcome: refreshed.outcome === "failed" ? "conflicted" : refreshed.outcome,
    };
    if (refreshed.outcome === "conflicted") {
      return refused({
        code: "merge.rebase-conflict",
        domainKind: "merge",
        exit: 1,
        evidence: { paths: refreshed.paths, attempts: 1 },
      });
    }
    if (refreshed.outcome === "failed") {
      return refused({
        code: "merge.transaction-aborted",
        domainKind: "merge",
        exit: 1,
        evidence: { detail: refreshed.code, attempts: 1 },
      });
    }
    return refused({
      code: "merge.gates-stale",
      domainKind: "merge",
      exit: 1,
      evidence: {
        oldSha: refreshed.oldSha,
        newSha: refreshed.newSha,
        attempts: 1,
        detail: "refresh-changed-head",
      },
    });
  }

  // 8. Land one squash commit and verify the landing.
  const landed = await ports.land({
    baseRef: config.baseRef,
    ...(config.branch === undefined ? {} : { branch: config.branch }),
  });
  if (!landed.ok) {
    return refused({
      code: "merge.transaction-aborted",
      domainKind: "merge",
      exit: 1,
      evidence: { detail: landed.code },
    });
  }
  const verifiedLanding = landed.containedOnBase === true && landed.requestState === "merged";
  if (!verifiedLanding) {
    const recordValue: MergeTransactionRecord = {
      schema: MERGE_TRANSACTION_SCHEMA,
      changeRef,
      result: "landing-unverified",
      squashSha: landed.squashSha,
      replayed: false,
      landing: { shaOnBase: landed.containedOnBase === true, requestState: landed.requestState },
      refresh,
      waiverRefs: [...byGate.keys()].slice(0, MERGE_MAX_WAIVER_REFS),
      postLanding: [],
      recordedAt: nowIso,
    };
    const persisted = ports.appendTransaction(recordValue);
    const landingDetail =
      landed.containedOnBase === "failed" ? "containment-read-failed" : "landing-unverified";
    return refused({
      code: "merge.landing-unverified",
      domainKind: "merge",
      exit: 2,
      evidence: {
        recordedSha: landed.squashSha,
        requestState: landed.requestState,
        // A failed outcome-record append is declared, not swallowed: the
        // landing state stays unverified and the append code is surfaced so a
        // re-run can still re-verify rather than re-land (NFR-7, GAP-10).
        detail: persisted.ok
          ? landingDetail
          : `${landingDetail};record-append-failed:${persisted.code}`,
      },
    });
  }

  const postLanding: MergePostLandingStep[] = [];
  const deleted = await ports.deleteBranch({
    ...(config.branch === undefined ? {} : { branch: config.branch }),
  });
  postLanding.push({ id: "branch-deletion", status: deleted === "ok" ? "ok" : "failed" });
  postLanding.push({ id: "closeout-ready", status: "ok" });
  const transactionRecord: MergeTransactionRecord = {
    schema: MERGE_TRANSACTION_SCHEMA,
    changeRef,
    result: "merged",
    squashSha: landed.squashSha,
    replayed: false,
    landing: { shaOnBase: true, requestState: "merged" },
    refresh,
    waiverRefs: [...byGate.keys()].slice(0, MERGE_MAX_WAIVER_REFS),
    postLanding,
    recordedAt: nowIso,
  };
  const persisted = ports.appendTransaction(transactionRecord);
  if (!persisted.ok) {
    // The landing is verified; the record append is a declared cleanup failure,
    // never a landing flip and never silence.
    const declaredStatuses = postLanding.map((step) =>
      step.id === "closeout-ready" ? { ...step, status: "failed" as MergePostLandingStatus } : step,
    );
    return {
      kind: "merged",
      report: reportFor(transactionRecord, declaredStatuses, record?.gates ?? []),
    };
  }
  return { kind: "merged", report: reportFor(transactionRecord, postLanding, record?.gates ?? []) };
};

const reportFor = (
  record: MergeTransactionRecord,
  postLanding: readonly MergePostLandingStep[],
  gates: readonly MergeGateVerdictRecord[],
): MergeReport => ({
  result: "merged",
  changeRef: record.changeRef,
  squashSha: record.squashSha ?? "",
  replayed: record.replayed,
  landing: record.landing,
  refresh: record.refresh,
  waiverRefs: record.waiverRefs,
  postLanding,
  gates: gates.slice(0, MERGE_MAX_REPORT_GATES),
  gatesOmitted: Math.max(0, gates.length - MERGE_MAX_REPORT_GATES),
});

const replayReport = (record: MergeTransactionRecord): MergeReport =>
  reportFor(record, record.postLanding, []);

const failureFor = (failure: GateFailure): MergeFailure => ({
  code: failure.code,
  domainKind: "merge",
  exit: 1,
  evidence: failure.evidence,
});

const refused = (failure: MergeFailure): MergeTransactionOutcome => ({
  kind: "refused",
  failure,
  summary: renderMergeFailure(failure),
});

/**
 * Render one refusal deterministically and within the human bounds.
 *
 * The decisive condition and the named failing gate come first; every list is
 * capped with an explicit `+N`. The remediation hint is the declared row's.
 */
export const renderMergeFailure = (failure: MergeFailure): string => {
  const evidence = failure.evidence;
  const lines: string[] = [];
  if (failure.code === "merge.landing-unverified") {
    lines.push("result=unverified; landing=unverified");
  } else {
    lines.push(`result=refused; condition=${failure.code}`);
  }
  if (evidence.gateId !== undefined) lines.push(`gate=${evidence.gateId}`);
  if (evidence.stateReason !== undefined) lines.push(`state=${evidence.stateReason}`);
  if (evidence.ageMs !== undefined || evidence.boundMs !== undefined) {
    lines.push(
      `verification-age=${durationSeconds(evidence.ageMs)} bound=${durationSeconds(evidence.boundMs)}`,
    );
  }
  if (evidence.recordedSha !== undefined) {
    lines.push(
      `recorded-sha=${shortSha(evidence.recordedSha)} current-sha=${shortSha(evidence.currentSha)}`,
    );
  }
  if (evidence.oldSha !== undefined) {
    lines.push(`head-transition=${shortSha(evidence.oldSha)}->${shortSha(evidence.newSha)}`);
  }
  if (evidence.jobs !== undefined && evidence.jobs.length > 0) {
    lines.push(`new-red-jobs=${listText(evidence.jobs)}`);
  }
  if (evidence.transitionAfter !== undefined && evidence.transitionAfter.length > 0) {
    const before = evidence.transitionBefore ?? [];
    lines.push(
      `owner-transition=${listText(before)}->${listText(evidence.transitionAfter)}${evidence.transitionAgeMs === undefined ? "" : ` age=${durationSeconds(evidence.transitionAgeMs)}`}`,
    );
  }
  if (evidence.setAdded !== undefined || evidence.setRemoved !== undefined) {
    lines.push(
      `gate-set-delta=added:${listText(evidence.setAdded ?? [])} removed:${listText(evidence.setRemoved ?? [])}`,
    );
  }
  if (evidence.paths !== undefined) {
    lines.push(`conflicting-paths=${listText(evidence.paths, MERGE_MAX_CONFLICT_PATHS)}`);
  }
  if (evidence.gateClass !== undefined) lines.push(`class=${evidence.gateClass}`);
  if (evidence.authorizer !== undefined) lines.push(`authorizer=${evidence.authorizer}`);
  if (evidence.overridePath !== undefined) lines.push(`override=${evidence.overridePath}`);
  if (evidence.requestState !== undefined) lines.push(`request-state=${evidence.requestState}`);
  if (evidence.detail !== undefined) lines.push(`evidence=${evidence.detail}`);
  const hint = remediationFor(failure.code);
  if (hint !== undefined) lines.push(`remediation=${hint}`);
  const bounded = lines.slice(0, MERGE_MAX_HUMAN_LINES);
  let text = bounded.join("\n");
  if (text.length > MERGE_MAX_HUMAN_BYTES) text = text.slice(0, MERGE_MAX_HUMAN_BYTES);
  return text;
};

const remediationFor = (code: string): string | undefined => {
  const direct = (ERROR_TABLE as readonly { code: string; remediationHint: string }[]).find(
    (entry) => entry.code === code,
  );
  if (direct !== undefined) return direct.remediationHint;
  if (code.startsWith("merge.gate.")) {
    const family = (ERROR_TABLE_FAMILIES as readonly { remediationHint: string }[]).find(
      (entry) => "remediationHint" in entry,
    );
    return family?.remediationHint;
  }
  return undefined;
};

const runDryRun = async (input: {
  readonly changeRef: string;
  readonly config: MergeTransactionConfig;
  readonly ports: MergeTransactionPorts;
  readonly nowIso: string;
  readonly nowMs: number;
  readonly gateSetIdentity: MergeGateSetIdentity;
  readonly declarations: readonly MergeWaiverDeclaration[];
}): Promise<MergeTransactionOutcome> => {
  const { changeRef, config, ports } = input;
  const head = await ports.readHead();
  if (head === undefined) {
    return refused(stateFailure("unreadable", "merge", "head-unresolved"));
  }
  const workItem = await ports.readWorkItem();
  if (!workItem.ok) return refused(readFailure(workItem.code));
  const checkRuns = await ports.readCheckRuns(head);
  if (!checkRuns.ok) return refused(readFailure(checkRuns.code));
  const posture = postureOf(workItem.item.labels, workItem.item.updatedAt);
  const verification = ports.readVerification();
  const previous = verification.ok ? verification.records.at(-1) : undefined;
  const transition =
    previous === undefined
      ? { changed: false, before: [], after: [] }
      : classifyTrackerTransition({
          recorded: previous.trackerPosture ?? { labels: [], ownerLabels: [] },
          current: posture,
          verifiedAt: previous.verifiedAt,
        });
  const gates: MergeGateVerdictRecord[] = [];
  for (const entry of config.gateSet.mergeEntries) {
    if (entry.recipe === "required-ci-job") {
      const evaluationValue = evaluateRequiredJobGate({
        jobName: entry.job ?? entry.id,
        runs: checkRuns.value.items,
        pageSha: checkRuns.value.sha ?? head,
        headSha: head,
      });
      gates.push({
        id: entry.id,
        verdict: evaluationValue.verdict,
        reason: evaluationValue.reason,
        citation: citationFor({
          identity: { changeRef, headSha: head },
          sources: [{ name: "github-check-runs", outcome: "read" }],
          counts: evaluationValue.counts,
          names: evaluationValue.names,
          reason: evaluationValue.reason,
        }),
      });
      continue;
    }
    if (entry.recipe === "tracker-freshness") {
      const reason: VerifyGateReason = transition.changed
        ? "owner-gate-present"
        : "owner-gate-absent";
      gates.push({
        id: entry.id,
        verdict: transition.changed ? "fail" : "pass",
        reason,
        citation: citationFor({
          identity: { changeRef, workItem: changeRef },
          sources: [{ name: "github-work-item", outcome: "read" }],
          counts: [
            { name: "labels", value: posture.labels.length },
            { name: "ownerLabels", value: posture.ownerLabels.length },
          ],
          names: [{ kind: "owner-labels", values: transition.after, omitted: 0 }],
          reason,
        }),
      });
      continue;
    }
    gates.push({
      id: entry.id,
      verdict: "unknown",
      reason: "read-failed",
      citation: emptyCitation(changeRef),
    });
  }
  const record: MergeGateVerificationRecord = {
    schema: MERGE_GATE_VERIFICATION_SCHEMA,
    changeRef,
    headSha: head,
    verifiedAt: input.nowIso,
    gateSet: input.gateSetIdentity,
    gates,
    trackerPosture: { labels: posture.labels, ownerLabels: posture.ownerLabels },
  };
  const appended = ports.appendVerification(record);
  if (!appended.ok) return refused(stateFailure("unreadable", "state", appended.code));

  const authorizations: MergeDryRunAuthorization[] = [];
  for (const declaration of input.declarations) {
    const entry = config.gateSet.enforcedMergeEntries.find(
      (candidate) => candidate.id === declaration.gateId,
    );
    const verdict = authorizeMergeWaiver({
      declaration,
      changeRef,
      entry,
      policy: config.policy,
      ownerPrincipal: config.ownerPrincipal,
      authorizedAt: input.nowIso,
    });
    authorizations.push({
      gateId: declaration.gateId,
      authorizer: declaration.authorizer,
      authorized: verdict.ok,
      ...(verdict.ok ? { gateClass: verdict.gateClass } : {}),
      ...(verdict.ok ? {} : { reason: verdict.reason }),
    });
  }

  const firstFailure = gates.find((gate) => gate.verdict !== "pass");
  if (firstFailure !== undefined) {
    return refused({
      code: failureCode(firstFailure.id),
      domainKind: "merge",
      exit: 1,
      evidence: {
        gateId: firstFailure.id,
        detail: firstFailure.reason,
      },
    });
  }
  return {
    kind: "dry-run",
    report: {
      result: "verified",
      changeRef,
      headSha: head,
      gates: gates.slice(0, MERGE_MAX_REPORT_GATES),
      gatesOmitted: Math.max(0, gates.length - MERGE_MAX_REPORT_GATES),
      authorizations,
    },
    authorizations,
  };
};

/** Resolve a raw gate declaration for callers that only hold config values. */
export const gateSetFromValues = (values: Readonly<Record<string, unknown>>) => {
  const merge = values.merge;
  return resolveMergeGateSet(isRecord(merge) ? merge.gates : undefined);
};

/** The declared default freshness bound. */
export const defaultFreshnessSeconds = (): number => MERGE_GATE_FRESHNESS_DEFAULT_SECONDS;

/** The failure shape for an internal/unclassified transaction fault. */
export const internalMergeFailure = (): MergeFailure => ({
  code: FALLBACK_INTERNAL_CODE,
  domainKind: "merge",
  exit: 2,
  evidence: {},
});

/** The post-landing step ids the record carries (declared once). */
export const mergePostLandingStepIds = (): readonly string[] => MERGE_POST_LANDING_STEP_IDS;

/** A helper narrowing a policy row's never-merge posture (data-only consumers). */
export const policyRowForClass = (
  policy: OwnerGateSlaPolicy,
  gateClass: string | undefined,
): OwnerGateSlaPolicyRow | undefined =>
  gateClass === undefined ? undefined : policy.rows.find((row) => row.class === gateClass);
