/**
 * The pure merge transaction composition (GH-225 F-2..F-8, GH-349 F-1/F-2).
 *
 * No I/O is performed here: every provider read, state read/append, git
 * mutation, clock, and identity arrives through injected ports. The transaction
 * consumes the recorded verification, enforces the freshness envelope,
 * re-probes the transition-sensitive facts, verifies and records waivers,
 * classifies the request's mergeability into exactly one declared identity, and
 * composes exactly one landing mechanism — the closed `merge-delivery-request`
 * provider-side operation at the verified head, carrying deterministic crafted
 * metadata. It never waits, never retries, never mutates the head it verified,
 * and cannot express a force operation; no local landing and no local refresh is
 * composed.
 */
import {
  type CapabilityGapReason,
  type DeliveryRequest,
  ERROR_TABLE,
  ERROR_TABLE_FAMILIES,
  type ErrorTableEntry,
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
  type MergeDeliveryRequestInput,
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

/** The single refresh attempt's outcome (the retained git-seam capability). */
export type MergeRefreshResult =
  | { readonly outcome: "conflicted"; readonly paths: readonly string[] }
  | { readonly outcome: "succeeded"; readonly oldSha: string; readonly newSha: string }
  | { readonly outcome: "failed"; readonly code: string };

/**
 * The closed provider-side landing outcome (`merge-delivery-request`, API-1).
 *
 * `ok: true` means the provider performed the landing and its read-back was
 * observed; `requestState` is that observed request state, and `"merged"` is
 * the only value that asserts merged truth. The landing commit identity is
 * present only when the provider supplied it: absence is unknown, never derived
 * from a local commit or a branch head. `ok: false` is the provider's refusal,
 * classified by the caller and never re-issued.
 */
export type MergeLandResult =
  | {
      readonly ok: true;
      readonly requestState: string;
      readonly mergeCommitSha?: string;
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
  /**
   * The adapter's declared capability for the closed `merge-delivery-request`
   * operation: `undefined` when it is supported, or the declared gap reason.
   * A gap refuses the lifecycle landing before any attempt (AC-F1-7).
   */
  readonly readLandingGap: () => CapabilityGapReason | undefined;
  /**
   * The one composed landing mechanism: the closed `merge-delivery-request`
   * operation, called at most once per invocation and never after a failure.
   * The local squash landing and the local refresh stay declared git-seam
   * capabilities with zero composed callers, so they are absent from this port
   * set rather than rejected at runtime.
   */
  readonly land: (input: MergeDeliveryRequestInput) => Promise<MergeLandResult>;
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
  /**
   * The `domainKind` the resolved error-table row declares for the code
   * (TDR-0031 D7). `config` is an already-declared `DOMAIN_KINDS` member this
   * type now admits, so a `config.credential.missing` read failure is classified
   * `config` at its declared `user-validation` projection (exit `1`) instead of
   * being contained as `fallback.internal` at exit `2`.
   */
  readonly domainKind: "merge" | "state" | "provider" | "config";
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

/**
 * Whether a declared domain kind is one a merge failure may carry.
 *
 * The row is the only source: a `fallback` row, or a kind outside the four the
 * transaction can emit, narrows to the caller's declared default instead of
 * being asserted onto the failure.
 */
const isMergeDomainKind = (kind: string): kind is MergeFailure["domainKind"] =>
  kind === "merge" || kind === "state" || kind === "provider" || kind === "config";

/** The kind the resolved row declares, or the caller's declared default. */
const domainKindOf = (
  row: ErrorTableEntry | undefined,
  fallback: MergeFailure["domainKind"],
): MergeFailure["domainKind"] =>
  row !== undefined && isMergeDomainKind(row.domainKind) ? row.domainKind : fallback;

/**
 * The exit the resolved row's projection class declares.
 *
 * `platform-provider` keeps exit `2` and the two user-facing classes project
 * exit `1`; an absent row is the containment default, exit `2`. Every emitted
 * failure's exit is therefore its row's declared projection by construction, so
 * a row whose projection class moves takes its emitted exit with it.
 */
const exitOfRow = (row: ErrorTableEntry | undefined): MergeFailure["exit"] =>
  row === undefined || row.projectionClass === "platform-provider" ? 2 : 1;

const stateFailure = (reason: MergeStateReadReason, detail?: string): MergeFailure => {
  // The kind and the exit come from the resolved row, never from the call site:
  // a `merge.state-unverified` failure declared as `state` would be the very
  // kind/code contradiction that is contained as `fallback.internal`.
  const row = ERROR_TABLE.find((entry) => entry.code === "merge.state-unverified");
  return {
    code: "merge.state-unverified",
    domainKind: domainKindOf(row, "merge"),
    exit: exitOfRow(row),
    evidence: { stateReason: reason, ...(detail === undefined ? {} : { detail }) },
  };
};

const readFailure = (code: string): MergeFailure => {
  // The classification is read from the resolved error-table row, never
  // hard-coded: a kind/code pair that contradicts the table is exactly the
  // containment (`fallback.internal`, exit 2) this restoration removes.
  const row = ERROR_TABLE.find((entry) => entry.code === code);
  return {
    code,
    domainKind: domainKindOf(row, "provider"),
    exit: exitOfRow(row),
    evidence: { detail: code },
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Resolve the declared base reference from the request target or a default. */
export const mergeBaseRef = (request: DeliveryRequest | undefined): string =>
  request?.targetRef !== undefined && request.targetRef.length > 0
    ? request.targetRef
    : "main-tools";

/**
 * The one fixed landing message (AC-F1-6, API-1, Appendix G-10).
 *
 * Byte-identical for every landing: one bounded line, no leading or trailing
 * whitespace, and no interpolated ref, request identity, or provider prose.
 */
const MERGE_LANDING_COMMIT_MESSAGE = "Landed by the delivery lifecycle merge primitive.";

/**
 * The crafted landing subject (AC-F1-6, DM-1).
 *
 * The provider-asserted request title is transmitted verbatim. Only when that
 * signal is absent — or empty, which the provider did not assert as a subject —
 * does the declared deterministic fallback apply: the change ref, then the
 * request's source ref. Nothing is ever derived from the other signal.
 */
const landingTitleFor = (changeRef: string, request: DeliveryRequest): string =>
  request.title !== undefined && request.title.length > 0
    ? request.title
    : `merge(${changeRef}): squash ${request.sourceRef}`;

/**
 * The base-containment answer for one identity (DM-3, Appendix G-9).
 *
 * A read that cannot answer is `"unknown"`, never a locally derived `true`.
 */
const containmentAnswer = async (
  ports: MergeTransactionPorts,
  sha: string,
): Promise<boolean | "unknown"> => {
  const answer = await ports.readBaseContainment(sha);
  return answer === "failed" ? "unknown" : answer;
};

/**
 * The checks posture of the verified head over the bounded page (AC-F2-2).
 *
 * A provider refuses a landing because a required check is not green, and the
 * only structural reading of that posture is the page the invocation already
 * read. Every job name the page carries is evaluated through the delivered
 * per-job evaluator — the single required-check mapping — and the first
 * non-green result names the posture. A page for another head carries no
 * posture, and no refusal message is ever matched.
 */
const checksPostureOf = (input: {
  readonly runs: readonly PipelineRun[];
  readonly pageSha: string | undefined;
  readonly headSha: string;
}): { readonly reason: VerifyGateReason; readonly jobs: readonly string[] } | undefined => {
  if (input.pageSha !== undefined && input.pageSha !== input.headSha) return undefined;
  const names: string[] = [];
  for (const run of input.runs) {
    if (!names.includes(run.pipelineName)) names.push(run.pipelineName);
  }
  for (const name of names) {
    const evaluation = evaluateRequiredJobGate({
      jobName: name,
      runs: input.runs,
      pageSha: input.pageSha,
      headSha: input.headSha,
    });
    if (evaluation.verdict !== "pass") return { reason: evaluation.reason, jobs: [name] };
  }
  return undefined;
};

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

  // 1. Idempotent replay decides from provider truth: a recorded landing
  // replays only while the provider still asserts the request merged, and a
  // provider that does not assert it re-verifies rather than re-landing. Local
  // containment stops being merged truth, because no fetch puts the provider's
  // merge commit in the checkout (AC-F1-3, AC-F1-9; test plan §7.6(v)).
  const transactions = ports.readTransactions();
  if (!transactions.ok) {
    return refused(stateFailure(transactions.reason, transactions.code));
  }
  const latestTransaction = transactions.records.at(-1);
  if (latestTransaction !== undefined) {
    const recorded = await ports.readRequestDetail();
    if (!recorded.ok) return refused(readFailure(recorded.code));
    if (recorded.request.reviewState === "merged") {
      return { kind: "merged", report: replayReport(latestTransaction) };
    }
    return refused({
      code: "merge.landing-unverified",
      domainKind: "merge",
      exit: 2,
      evidence: {
        ...(latestTransaction.squashSha === undefined
          ? {}
          : { recordedSha: latestTransaction.squashSha }),
        requestState: recorded.request.reviewState,
        detail: "provider-not-merged",
      },
    });
  }

  // 2. The freshness envelope over the newest verification record.
  const verification = ports.readVerification();
  if (!verification.ok) {
    return refused(stateFailure(verification.reason, verification.code));
  }
  const record = verification.records.at(-1);
  const head = await ports.readHead();
  if (head === undefined) {
    return refused(stateFailure("unreadable", "head-unresolved"));
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
    return refused(stateFailure(envelope.reason));
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
  // convergence case: the provider asserts merged truth, so the outcome is
  // recorded and replayed with zero landing calls. The recorded containment is
  // the local read's honest answer, never the verdict (AC-F1-2, AC-F1-9).
  if (requestDetail.request.reviewState === "merged") {
    const mergedHead = requestDetail.request.headSha;
    const replay: MergeTransactionRecord = {
      schema: MERGE_TRANSACTION_SCHEMA,
      changeRef,
      result: "merged",
      ...(mergedHead === undefined ? {} : { squashSha: mergedHead }),
      replayed: true,
      landing: {
        shaOnBase:
          mergedHead === undefined ? "unknown" : await containmentAnswer(ports, mergedHead),
        requestState: "merged",
      },
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

  // 7. The mergeability decision rule (F-2, API-2): total over the four
  // normalized states plus absence, at most one post-refusal re-read and at
  // most one unknown-recovery re-read, and no branch mutates the head it
  // verified. The retained refresh capability is not composed here.
  const refresh: MergeRefreshEvidence = { attempts: 0, outcome: "not-attempted" };

  const landingInputOf = (request: DeliveryRequest): MergeDeliveryRequestInput => ({
    deliveryRequest: request.identity,
    strategy: "squash",
    expectedHeadSha: head,
    commitTitle: landingTitleFor(changeRef, request),
    commitMessage: MERGE_LANDING_COMMIT_MESSAGE,
  });

  const mergedFrom = async (landed: {
    readonly requestState: string;
    readonly mergeCommitSha?: string;
  }): Promise<MergeTransactionOutcome> => {
    const shaOnBase =
      landed.mergeCommitSha === undefined
        ? "unknown"
        : await containmentAnswer(ports, landed.mergeCommitSha);
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
      ...(landed.mergeCommitSha === undefined ? {} : { squashSha: landed.mergeCommitSha }),
      replayed: false,
      landing: { shaOnBase, requestState: landed.requestState },
      refresh,
      waiverRefs: [...byGate.keys()].slice(0, MERGE_MAX_WAIVER_REFS),
      postLanding,
      recordedAt: nowIso,
    };
    const persisted = ports.appendTransaction(transactionRecord);
    if (!persisted.ok) {
      // The landing is verified; the record append is a declared cleanup
      // failure, never a landing flip and never silence.
      const declaredStatuses = postLanding.map((step) =>
        step.id === "closeout-ready"
          ? { ...step, status: "failed" as MergePostLandingStatus }
          : step,
      );
      return {
        kind: "merged",
        report: reportFor(transactionRecord, declaredStatuses, record?.gates ?? []),
      };
    }
    return {
      kind: "merged",
      report: reportFor(transactionRecord, postLanding, record?.gates ?? []),
    };
  };

  // The landing fired but the provider did not assert merged truth: the
  // outcome is recorded as unverified and the verdict is unknown, never merged
  // and never inferred from local containment (AC-F1-3, AC-F1-4).
  const unverifiedFrom = async (landed: {
    readonly requestState: string;
    readonly mergeCommitSha?: string;
  }): Promise<MergeTransactionOutcome> => {
    const shaOnBase =
      landed.mergeCommitSha === undefined
        ? "unknown"
        : await containmentAnswer(ports, landed.mergeCommitSha);
    const recordValue: MergeTransactionRecord = {
      schema: MERGE_TRANSACTION_SCHEMA,
      changeRef,
      result: "landing-unverified",
      ...(landed.mergeCommitSha === undefined ? {} : { squashSha: landed.mergeCommitSha }),
      replayed: false,
      landing: { shaOnBase, requestState: landed.requestState },
      refresh,
      waiverRefs: [...byGate.keys()].slice(0, MERGE_MAX_WAIVER_REFS),
      postLanding: [],
      recordedAt: nowIso,
    };
    const persisted = ports.appendTransaction(recordValue);
    return refused({
      code: "merge.landing-unverified",
      domainKind: "merge",
      exit: 2,
      evidence: {
        ...(landed.mergeCommitSha === undefined ? {} : { recordedSha: landed.mergeCommitSha }),
        requestState: landed.requestState,
        // A failed outcome-record append is declared, not swallowed: the
        // landing state stays unverified and the append code is surfaced so a
        // re-run can still re-verify rather than re-land (NFR-7, GAP-10).
        detail: persisted.ok
          ? "landing-unverified"
          : `landing-unverified;record-append-failed:${persisted.code}`,
      },
    });
  };

  // One guarded landing at the verified head, then the provider's own truth.
  const landAtVerifiedHead = async (request: DeliveryRequest): Promise<MergeTransactionOutcome> => {
    const landed = await ports.land(landingInputOf(request));
    if (!landed.ok) {
      // A refused landing is returned as a refusal: it is never converted into
      // a local commit, a fallback landing, or a success by inference.
      return refused({
        code: "merge.transaction-aborted",
        domainKind: "merge",
        exit: 1,
        evidence: { detail: landed.code },
      });
    }
    return landed.requestState === "merged" ? mergedFrom(landed) : unverifiedFrom(landed);
  };

  // `not-mergeable`: the provider is the authority, so the guarded landing is
  // offered once; a refusal is classified by exactly one bounded post-refusal
  // re-read rather than retried (AC-F2-2, AC-F2-3, AC-F2-4).
  const classifyNotMergeable = async (
    request: DeliveryRequest,
  ): Promise<MergeTransactionOutcome> => {
    const landed = await ports.land(landingInputOf(request));
    if (landed.ok) {
      return landed.requestState === "merged" ? mergedFrom(landed) : unverifiedFrom(landed);
    }
    const reRead = await ports.readRequestDetail();
    if (!reRead.ok) return refused(readFailure(reRead.code));
    const posture = checksPostureOf({
      runs: checkRuns.value.items,
      pageSha: checkRuns.value.sha ?? head,
      headSha: head,
    });
    if (posture !== undefined) {
      return refused({
        code: failureCode("ci-green"),
        domainKind: "merge",
        exit: 1,
        evidence: {
          gateId: "ci-green",
          detail: posture.reason,
          ...(posture.jobs.length === 0 ? {} : { jobs: posture.jobs }),
        },
      });
    }
    return refused({
      code: "merge.sync-required",
      domainKind: "merge",
      exit: 1,
      evidence: {
        detail: "behind-unconfirmed",
        requestState: reRead.request.mergeableState ?? "unknown",
      },
    });
  };

  const decide = async (request: DeliveryRequest): Promise<MergeTransactionOutcome> => {
    switch (request.mergeableState) {
      case "conflicting":
        // The sync cause is certain, so no landing call is made. There is no
        // internal rebase and no head mutation (AC-F2-1, F8).
        return refused({
          code: "merge.sync-required",
          domainKind: "merge",
          exit: 1,
          evidence: {
            detail: "dirty",
            requestState: request.mergeableState,
            recordedSha: head,
            currentSha: head,
          },
        });
      case "mergeable":
        return landAtVerifiedHead(request);
      case "not-mergeable":
        return classifyNotMergeable(request);
      default: {
        // `unknown` or absent: exactly one bounded re-read of the same request,
        // compared on the exact head. The command never waits or polls.
        const reRead = await ports.readRequestDetail();
        if (!reRead.ok) return refused(readFailure(reRead.code));
        const observed = reRead.request;
        if (observed.headSha !== undefined && observed.headSha !== head) {
          return refused({
            code: "merge.gates-stale",
            domainKind: "merge",
            exit: 1,
            evidence: { recordedSha: head, currentSha: observed.headSha, detail: "head-changed" },
          });
        }
        if (observed.mergeableState === undefined || observed.mergeableState === "unknown") {
          return refused({
            code: "merge.mergeability-unknown",
            domainKind: "merge",
            exit: 2,
            evidence: { requestState: observed.mergeableState ?? "unknown" },
          });
        }
        return decide(observed);
      }
    }
  };

  // 8. A declared landing gap refuses the delivered clean pre-mutation abort:
  // the capability declaration is never contradicted by a silent local fallback,
  // and no landing attempt is made (AC-F1-7, DM-6).
  const landingGap = ports.readLandingGap();
  if (landingGap !== undefined) {
    return refused({
      code: "merge.transaction-aborted",
      domainKind: "merge",
      exit: 1,
      evidence: { detail: `merge-delivery-request:${landingGap}` },
    });
  }

  // 9. One landing mechanism, and its provider-asserted verdict.
  return decide(requestDetail.request);
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
    return refused(stateFailure("unreadable", "head-unresolved"));
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
  if (!appended.ok) return refused(stateFailure("unreadable", appended.code));

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
