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
  MERGE_BRANCH_CANDIDATE_MAX,
  MERGE_BRANCH_DECLARATION_MAX_CHARS,
  MERGE_BRANCH_REASON_PRECEDENCE,
  MERGE_GATE_FRESHNESS_DEFAULT_SECONDS,
  MERGE_GATE_VERIFICATION_SCHEMA,
  MERGE_MAX_CONFLICT_PATHS,
  MERGE_MAX_EVIDENCE_NAME_CHARS,
  MERGE_MAX_EVIDENCE_NAMES,
  MERGE_MAX_HUMAN_BYTES,
  MERGE_MAX_HUMAN_LINES,
  MERGE_MAX_REF_CHARS,
  MERGE_MAX_REPORT_GATES,
  MERGE_MAX_WAIVER_REFS,
  MERGE_POST_LANDING_STEP_IDS,
  MERGE_REFUSAL_OPERATIONS,
  MERGE_TRANSACTION_SCHEMA,
  type MergeDeliveryRequestInput,
  type MergeDryRunAuthorization,
  type MergeDryRunReport,
  type MergeGateEntry,
  type MergeGateSetIdentity,
  type MergeGateVerdictRecord,
  type MergeGateVerificationRecord,
  type MergePostLandingStatus,
  type MergePostLandingStep,
  type MergeRefreshEvidence,
  type MergeRefusalAttribution,
  type MergeRefusalOperation,
  type MergeReport,
  type MergeResolutionFacts,
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
import { branchConvention } from "./closeout.js";
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
import { expectedSetValid } from "./verify-gates.js";

/** A merge read outcome with a declared failure identity on failure. */
export type MergeRead<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly code: string;
      /** The resolved credential facts when the fault is a credential condition. */
      readonly credential?: MergeCredentialFacts;
    };

/**
 * The non-secret credential facts a credential-condition refusal names
 * (AC-F3-2): the declared reference name and the environment variable that
 * carries the material. Values only, never the secret itself.
 */
export type MergeCredentialFacts = {
  readonly reference: string;
  readonly sourceKey: string;
};

/** The bounded check-run page consumed by the probe. */
export type MergeCheckRunPage = {
  readonly items: readonly PipelineRun[];
  readonly pageItemCount: number;
  readonly sha?: string;
};

/** The parsed work-item read. */
export type MergeWorkItemRead =
  | { readonly ok: true; readonly item: WorkItem }
  | {
      readonly ok: false;
      readonly code: string;
      readonly credential?: MergeCredentialFacts;
    };

/**
 * One bounded open-request list page (F-1 step 1): the delivered
 * `listDeliveryRequests` read at the declared provider limit, carrying the open
 * entries and whether the bounded page saturated. The page carries the open
 * state filter, so it never carries a merged request and cannot establish
 * merged truth; the list endpoint returns no mergeability fields, so the
 * landing decision's mergeability fact comes from the request read, not from
 * this page.
 */
export type MergeOpenRequestPage = {
  readonly items: readonly DeliveryRequest[];
  readonly saturated: boolean;
};

/**
 * The delivered merged-request read, used verbatim (F-1 step 3): its own
 * work-item-ref filter and its own deterministic selection, with the ONE
 * additive member — the matched request identities — computed before that
 * selection. On the shared unavailable outcome the member is EMPTY when the
 * closed page was read and matched nothing, and ABSENT when the page could not
 * be read (a fault — a distinct outcome, never folded into zero).
 */
export type MergeMergedRequestRead =
  | {
      readonly observation: "observed";
      readonly request: DeliveryRequest;
      readonly matchedIdentities: readonly string[];
    }
  | {
      readonly observation: "unavailable";
      readonly matchedIdentities?: readonly string[];
    }
  | { readonly observation: "invalid"; readonly detail: string };

/**
 * One bounded local change-record read at a candidate head (F-1 step 4): the
 * parse is applied by the composition (the delivered pm-notes parse), so the
 * domain classifies from the read's declared reason and the parsed declaration.
 */
export type MergeRecordAtHeadRead =
  | {
      readonly ok: true;
      readonly path: string;
      /** The record's parsed `branch` declaration; absent when it declares none. */
      readonly declaration?: string;
    }
  | {
      readonly ok: false;
      readonly reason: "record-missing" | "record-unreadable" | "record-invalid";
      readonly detail?: string;
    };

/** The parsed request-detail read. */
export type MergeRequestDetailRead =
  | { readonly ok: true; readonly request: DeliveryRequest }
  | {
      readonly ok: false;
      readonly code: string;
      readonly credential?: MergeCredentialFacts;
    };

/** The delivered CI-workflow read the battery's `ci-green` gate uses (F-2). */
export type MergeCiWorkflowRead = {
  readonly outcome: "read" | "failed" | "absent";
  readonly names: readonly string[];
};

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
  | {
      readonly ok: false;
      readonly code: string;
      /** The resolved credential facts when the fault is a credential condition. */
      readonly credential?: MergeCredentialFacts;
    };

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
  readonly readRequestDetail: (entityId?: string) => Promise<MergeRequestDetailRead>;
  /**
   * The delivered CI-workflow read the battery's `ci-green` gate uses (F-2):
   * the repository-declared expected job set. Wired by the production
   * composition; the merge path derives its required-check set through this
   * read and the exported `expectedSetValid` rule, never a second predicate.
   */
  readonly readCiWorkflow?: () => Promise<MergeCiWorkflowRead>;
  /**
   * The bounded open-request list read the change-branch resolution performs
   * first (F-1 step 1, GH-366): the delivered open list at the declared
   * provider limit with gate facts, which also supplies the located request
   * row. Wired by the production composition; the transaction treats absence
   * as an unwired composition and refuses fail-closed.
   */
  readonly readOpenRequests?: () => Promise<MergeRead<MergeOpenRequestPage>>;
  /**
   * The delivered merged-request read, used verbatim (F-1 step 3): invoked only
   * on a convergence attempt — no open entry matches the resolved branch on an
   * unsaturated page — with the read's own filter and selection, and its ONE
   * additive matched-identities member.
   */
  readonly readMergedRequest?: (workItemRef: string) => Promise<MergeMergedRequestRead>;
  /**
   * The bounded local change-record read at a candidate head (F-1 step 4):
   * at most two fixed-argv git invocations per candidate, honouring the record
   * byte cap, with the delivered pm-notes parse applied by the composition.
   */
  readonly readChangeRecordAtHead?: (headSha: string) => Promise<MergeRecordAtHeadRead>;
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

/** One read candidate's own cause and attempted tree path (F-1 step 7). */
export type MergeCandidateFinding = {
  readonly ref: string;
  readonly path: string;
  readonly cause: string;
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
  /**
   * The dedicated `operation=<token>` field's value (DEC-11, AC-F3-1): the read,
   * citation source, or landing operation the refusal is about, drawn from the
   * closed `MERGE_REFUSAL_OPERATIONS` vocabulary — or absent, which renders the
   * declared `-` for a refusal that names no operation. The value is validated
   * at the rendering site; an out-of-vocabulary token is a rendering failure,
   * never a passed-through value.
   */
  readonly operation?: MergeRefusalOperation;
  /**
   * The credential facts a credential-condition refusal names (AC-F3-2): the
   * declared reference name and the environment variable. Non-secret
   * identifiers only.
   */
  readonly credentialReference?: string;
  readonly credentialSourceKey?: string;
  /** The chosen closed reason of a `merge.branch-unresolved` refusal (F-1 step 7). */
  readonly branchReason?: string;
  /** Each read candidate's own cause and attempted tree path, capped at three. */
  readonly candidateFindings?: readonly MergeCandidateFinding[];
  /** The chosen closed reason of a `merge.request-unresolved` refusal (F-1). */
  readonly requestReason?: string;
  /** The observed open count on the bounded page (a request refusal names it). */
  readonly openCount?: number;
  /** The observed candidate count (a request refusal names it). */
  readonly candidateCount?: number;
  /**
   * The observed matched request identities on a convergence attempt (F-1
   * step 3): each duplicate abort names EVERY identity and presents none as
   * *the* request; the empty set refusal names the observed empty set.
   */
  readonly matchedIdentities?: readonly string[];
  /**
   * The evidence source of a not-green declared required job (F-3, DM-2,
   * API-2): `recorded` when the persisted gate verdict already reported that
   * job not green, `probe` when the recorded verdict was green and the probe
   * observed it. Exactly one optional field on the bounded evidence; the
   * verification timestamp is never carried here (it stays on the persisted
   * `merge.gate-verification` record that gate id plus job resolves to).
   */
  readonly attribution?: MergeRefusalAttribution;
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

/**
 * The job names a recorded `ci-green` verdict reports not green, in citation
 * order (F-3, TC-F3-003).
 *
 * The delivered citation carries one name list per not-green state it names
 * (`failed-jobs`, `pending-jobs`, `missing-jobs`). These three facts — the
 * effective gate id, the job and the verdict — are what identifies the
 * persisted verification record a `recorded` attribution points at.
 */
const recordedNotGreenJobs = (names: readonly VerifyGateNameList[] | undefined): string[] => {
  const values: string[] = [];
  for (const list of names ?? []) {
    if (
      list.kind !== "failed-jobs" &&
      list.kind !== "pending-jobs" &&
      list.kind !== "missing-jobs"
    ) {
      continue;
    }
    for (const value of list.values) if (!values.includes(value)) values.push(value);
  }
  return values;
};

/** The delivered reasons that name the observed job in the page. */
const namedJobReasons: readonly VerifyGateReason[] = [
  "ci-pending",
  "ci-canceled",
  "ci-all-skipped",
  "ci-failed",
];

/**
 * One declared required job's not-green finding (F-3, AC-F3-2).
 *
 * The row is the existing `merge.gate.<gate-id>.failed` family; the evidence
 * names the effective gate id, the delivered reason (or the recorded verdict's
 * own reason) and exactly one attribution. No row, kind, or exit is added.
 */
const requiredJobFailure = (input: {
  readonly entry: MergeGateEntry;
  readonly detail: string;
  readonly attribution: MergeRefusalAttribution;
  readonly jobs: readonly string[];
}): GateFailure => ({
  entry: input.entry,
  code: failureCode(input.entry.id),
  evidence: {
    gateId: input.entry.id,
    detail: input.detail,
    ...(input.jobs.length === 0 ? {} : { jobs: input.jobs }),
    attribution: input.attribution,
  },
});

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
    // The verification-state read is the local registry read (Appendix B):
    // the unverified-state refusal names `operation=delivery-registry`.
    evidence: {
      operation: "delivery-registry",
      stateReason: reason,
      ...(detail === undefined ? {} : { detail }),
    },
  };
};

const readFailure = (
  code: string,
  operation?: MergeRefusalOperation,
  credential?: MergeCredentialFacts,
): MergeFailure => {
  // The classification is read from the resolved error-table row, never
  // hard-coded: a kind/code pair that contradicts the table is exactly the
  // containment (`fallback.internal`, exit 2) this restoration removes.
  const row = ERROR_TABLE.find((entry) => entry.code === code);
  return {
    code,
    domainKind: domainKindOf(row, "provider"),
    exit: exitOfRow(row),
    evidence: {
      detail: code,
      ...(operation === undefined ? {} : { operation }),
      ...(credential === undefined ? {} : { credentialReference: credential.reference }),
      ...(credential === undefined ? {} : { credentialSourceKey: credential.sourceKey }),
    },
  };
};

/**
 * The closed, total landing-fault mapping (AC-F3-3, F-3): every landing-port
 * failure maps to exactly one declared identity, so no raw port code reaches an
 * envelope. A missing credential is the credential identity; a rejected
 * credential is the auth identity; a landing that fired without observed merged
 * truth is `merge.landing-unverified`; every other port failure — transient,
 * transport, or unclassified — is the declared `provider.outage` default. The
 * port's `code` is an open string, so the default arm is load-bearing.
 */
export const landingFaultIdentityOf = (portCode: string): string => {
  if (portCode === "config.credential.missing") return "config.credential.missing";
  if (portCode === "provider.auth.rejected") return "provider.auth.rejected";
  if (portCode === "merge.landing-unverified") return "merge.landing-unverified";
  return "provider.outage";
};

const landingFaultFailure = (portCode: string, credential?: MergeCredentialFacts): MergeFailure => {
  const identity = landingFaultIdentityOf(portCode);
  const row = ERROR_TABLE.find((entry) => entry.code === identity);
  return {
    code: identity,
    domainKind: domainKindOf(row, "provider"),
    exit: exitOfRow(row),
    // The landing fault names the landing operation; the port's own failure
    // token never reaches the evidence (AC-F3-3, NFR-7).
    evidence: {
      operation: "github-merge-delivery-request",
      detail: "landing-fault",
      ...(credential === undefined ? {} : { credentialReference: credential.reference }),
      ...(credential === undefined ? {} : { credentialSourceKey: credential.sourceKey }),
    },
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
 * The effective gate set's declared required jobs (GH-349 AC-F3-3).
 *
 * Every `required-ci-job` entry is declared, whether the merge projection
 * re-probes it or the change-level battery already evaluated it; the raw page
 * is never the candidate set.
 */
const declaredCiJobsOf = (gateSet: MergeEffectiveGateSet): readonly string[] =>
  gateSet.entries
    .filter((entry) => entry.recipe === "required-ci-job")
    .map((entry) => entry.job ?? entry.id);

/**
 * The checks posture of the verified head over the declared required set
 * (AC-F2-2, AC-F3-3).
 *
 * A provider refuses a landing because a required check is not green, and the
 * only structural reading of that posture is the page the invocation already
 * read. The candidate set is the effective gate set's declared required jobs —
 * every `required-ci-job` entry, `job ?? id` — and never the raw page: a job the
 * gate set does not declare is not gate evidence and produces no refusal. Each
 * declared job is evaluated through the delivered per-job evaluator (the single
 * required-check mapping) and the first non-green result names the posture. A
 * page for another head carries no posture, and no refusal message is ever
 * matched.
 */
const checksPostureOf = (input: {
  readonly runs: readonly PipelineRun[];
  readonly pageSha: string | undefined;
  readonly headSha: string;
  readonly requiredJobs: readonly string[];
}): { readonly reason: VerifyGateReason; readonly jobs: readonly string[] } | undefined => {
  if (input.pageSha !== undefined && input.pageSha !== input.headSha) return undefined;
  for (const name of input.requiredJobs) {
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
 * The identity token the resolution reports and the duplicate aborts name
 * (DM-2): deterministic, bounded, and derived from nothing but the
 * provider-asserted identity.
 */
export const mergeIdentityToken = (entityId: string): string => `#${entityId}`;

const FULL_SHA = /^[0-9a-f]{40}$/u;

/**
 * The classified declaration of one candidate's record (F-1 step 4-7): the
 * declaration-cap and value-shape rules are pure, so the resolution classifies
 * from the composition's parsed read.
 */
const classifyDeclaration = (input: {
  readonly declaration: string | undefined;
  readonly sourceRef: string;
}): "declaration-missing" | "declaration-unusable" | "declaration-disagrees" | "accepted" => {
  if (input.declaration === undefined || input.declaration.length === 0) {
    return "declaration-missing";
  }
  if (
    input.declaration.length > MERGE_BRANCH_DECLARATION_MAX_CHARS ||
    /\s/u.test(input.declaration) ||
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001f\u007f]/u.test(input.declaration)
  ) {
    return "declaration-unusable";
  }
  return input.declaration === input.sourceRef ? "accepted" : "declaration-disagrees";
};

/** The outcome of the change-branch resolution (F-1, Appendix A steps 1-6). */
export type MergeResolution =
  | {
      readonly kind: "resolved";
      readonly request: DeliveryRequest;
      readonly branch: string;
      readonly recordPath: string;
      readonly candidateCount: number;
    }
  | {
      readonly kind: "replay";
      readonly request: DeliveryRequest;
      readonly identity: string;
      readonly matchedIdentities: readonly string[];
    }
  | { readonly kind: "refused"; readonly failure: MergeFailure };

/**
 * The change-branch resolution (F-1, Appendix A steps 1-6): the one bounded
 * open-list read, the candidate set under the declared caps and precedence, the
 * convergence attempt over the delivered merged read's matched identities, and
 * the per-candidate record reads at their own asserted heads. No checkout
 * branch or head is read, no working-tree record is read, and no fetch occurs.
 */
const resolveChangeBranch = async (input: {
  readonly changeRef: string;
  readonly ports: MergeTransactionPorts;
}): Promise<MergeResolution> => {
  const { changeRef, ports } = input;
  const credentialOf = (read: {
    readonly credential?: MergeCredentialFacts;
  }): MergeCredentialFacts | undefined => read.credential;

  // Step 1: the one bounded open-request list read. Every refusal decided on
  // this page spends exactly this one provider request.
  const openRead = await (ports.readOpenRequests?.() ??
    Promise.resolve<MergeRead<MergeOpenRequestPage>>({
      ok: false,
      code: "merge.request-unresolved",
    }));
  if (!openRead.ok) {
    return {
      kind: "refused",
      failure: readFailure(openRead.code, "github-delivery-request-list", credentialOf(openRead)),
    };
  }
  const page = openRead.value;
  const openCount = page.items.length;
  const pattern = branchConvention(changeRef);
  const candidates = page.items.filter((entry) => pattern.test(entry.sourceRef));

  // Step 2: saturation precedes the candidate count — a truncated page cannot
  // establish any uniqueness claim, even with zero convention-matching entries.
  if (page.saturated) {
    return {
      kind: "refused",
      failure: {
        code: "merge.request-unresolved",
        domainKind: "merge",
        exit: 1,
        evidence: {
          requestReason: "ambiguous-open-request",
          openCount,
          candidateCount: candidates.length,
          detail: "page-saturated",
        },
      },
    };
  }
  if (candidates.length > MERGE_BRANCH_CANDIDATE_MAX) {
    return {
      kind: "refused",
      failure: {
        code: "merge.request-unresolved",
        domainKind: "merge",
        exit: 1,
        evidence: {
          requestReason: "ambiguous-open-request",
          openCount,
          candidateCount: candidates.length,
        },
      },
    };
  }
  // A candidate whose asserted head is absent or not a full hex SHA refuses the
  // run and is never read: an unreadable member cannot establish uniqueness.
  for (const candidate of candidates) {
    if (candidate.headSha === undefined || !FULL_SHA.test(candidate.headSha)) {
      return {
        kind: "refused",
        failure: {
          code: "merge.request-unresolved",
          domainKind: "merge",
          exit: 1,
          evidence: {
            requestReason: "head-unresolved",
            openCount,
            candidateCount: candidates.length,
            matchedIdentities: [mergeIdentityToken(candidate.identity.entityId)],
            detail: candidate.sourceRef,
          },
        },
      };
    }
  }

  // Step 3: the convergence attempt — reached only where the open page offers
  // nothing to resolve on an unsaturated page. Decided BEFORE any record read,
  // from the read's additive matched-identities member.
  if (candidates.length === 0) {
    const mergedRead = await (ports.readMergedRequest?.(changeRef) ??
      Promise.resolve<MergeMergedRequestRead>({ observation: "unavailable" }));
    if (mergedRead.observation === "invalid") {
      // The delivered read collapses every fault class into one observation:
      // the payload-invalid arm resolves to the declared provider identity at
      // this seam (Appendix B's provider.outage row).
      return {
        kind: "refused",
        failure: {
          code: "provider.outage",
          domainKind: "provider",
          exit: 2,
          evidence: {
            operation: "github-delivery-request-list",
            detail: "merged-read-fault",
          },
        },
      };
    }
    if (mergedRead.observation === "unavailable" && mergedRead.matchedIdentities === undefined) {
      // The member is ABSENT: the read itself faulted (transport or auth). A
      // distinct declared outcome, never folded into zero and never
      // `no-open-request` (TC-MRG-052).
      return {
        kind: "refused",
        failure: {
          code: "provider.outage",
          domainKind: "provider",
          exit: 2,
          evidence: {
            operation: "github-delivery-request-list",
            detail: "merged-read-fault",
          },
        },
      };
    }
    const identities = mergedRead.matchedIdentities ?? [];
    if (identities.length === 0) {
      // The member is present and empty: the page was read and matched
      // nothing — a decidable zero (TC-MRG-005's empty-set cell).
      return {
        kind: "refused",
        failure: {
          code: "merge.request-unresolved",
          domainKind: "merge",
          exit: 1,
          evidence: {
            requestReason: "no-open-request",
            openCount,
            candidateCount: 0,
            matchedIdentities: [],
          },
        },
      };
    }
    if (identities.length > 1) {
      // More than one matched identity: the run aborts naming EACH identity
      // and presenting NONE of them as *the* request — never the delivered
      // selection (AC-F1-6, TC-MRG-049).
      return {
        kind: "refused",
        failure: {
          code: "merge.transaction-aborted",
          domainKind: "merge",
          exit: 1,
          evidence: {
            operation: "github-delivery-request-list",
            requestReason: "duplicate-merged-request",
            openCount,
            candidateCount: 0,
            matchedIdentities: identities.map((identity) => mergeIdentityToken(identity)),
          },
        },
      };
    }
    const replayed = mergedRead;
    if (replayed.observation !== "observed") {
      return {
        kind: "refused",
        failure: readFailure("merge.request-unresolved", "github-delivery-request-list"),
      };
    }
    return {
      kind: "replay",
      request: replayed.request,
      identity: mergeIdentityToken(replayed.request.identity.entityId),
      matchedIdentities: replayed.matchedIdentities.map((identity) => mergeIdentityToken(identity)),
    };
  }

  // Step 4: each candidate's record is read at that candidate's own asserted
  // head through the bounded local read (at most three candidates).
  const findings: MergeCandidateFinding[] = [];
  const accepted: { readonly request: DeliveryRequest; readonly path: string }[] = [];
  for (const candidate of candidates) {
    const headSha = candidate.headSha as string;
    const read = await (ports.readChangeRecordAtHead?.(headSha) ??
      Promise.resolve<MergeRecordAtHeadRead>({ ok: false, reason: "record-unreadable" }));
    const finding = (cause: string, path: string): MergeCandidateFinding => ({
      ref: candidate.sourceRef,
      path,
      cause,
    });
    if (!read.ok) {
      const cause =
        read.reason === "record-missing"
          ? "record-missing"
          : read.reason === "record-invalid"
            ? "record-invalid"
            : "record-unreadable";
      findings.push(finding(cause, read.reason === "record-missing" ? "-" : candidate.sourceRef));
      continue;
    }
    const verdict = classifyDeclaration({
      declaration: read.declaration,
      sourceRef: candidate.sourceRef,
    });
    if (verdict === "accepted") {
      accepted.push({ request: candidate, path: read.path });
      continue;
    }
    findings.push(finding(verdict, read.path));
  }

  // Step 5: the duplicate check runs before the distinct-refs ambiguity check,
  // and its population is the accepted set: more than one accepted candidate
  // whose source ref equals the resolved branch names each duplicate identity
  // and never selects one.
  const byRef = new Map<string, { readonly request: DeliveryRequest; readonly path: string }[]>();
  for (const entry of accepted) {
    const ref = entry.request.sourceRef;
    byRef.set(ref, [...(byRef.get(ref) ?? []), entry]);
  }
  for (const group of byRef.values()) {
    if (group.length > 1) {
      return {
        kind: "refused",
        failure: {
          code: "merge.transaction-aborted",
          domainKind: "merge",
          exit: 1,
          evidence: {
            operation: "github-delivery-request-list",
            requestReason: "duplicate-open-request",
            openCount,
            candidateCount: candidates.length,
            matchedIdentities: group.map((entry) =>
              mergeIdentityToken(entry.request.identity.entityId),
            ),
          },
        },
      };
    }
  }
  if (accepted.length > 1) {
    return {
      kind: "refused",
      failure: {
        code: "merge.request-unresolved",
        domainKind: "merge",
        exit: 1,
        evidence: {
          requestReason: "ambiguous-open-request",
          openCount,
          candidateCount: candidates.length,
        },
      },
    };
  }
  if (accepted.length === 0) {
    // Exactly one closed reason, chosen by the declared precedence, naming
    // every read candidate's own cause and attempted tree path.
    const reason = MERGE_BRANCH_REASON_PRECEDENCE.find((candidate) =>
      findings.some((finding) => finding.cause === candidate),
    );
    return {
      kind: "refused",
      failure: {
        code: "merge.branch-unresolved",
        domainKind: "merge",
        exit: 1,
        evidence: {
          branchReason: reason ?? "record-unreadable",
          candidateCount: candidates.length,
          candidateFindings: findings.slice(0, MERGE_BRANCH_CANDIDATE_MAX),
        },
      },
    };
  }
  const acceptedEntry = accepted[0] as { readonly request: DeliveryRequest; readonly path: string };
  return {
    kind: "resolved",
    request: acceptedEntry.request,
    branch: acceptedEntry.request.sourceRef,
    recordPath: acceptedEntry.path,
    candidateCount: candidates.length,
  };
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

  // 0. The change-branch resolution (F-1, Appendix A steps 1-6): the one
  // bounded open-list read, the candidate set, the convergence attempt, and the
  // per-candidate record reads at their own asserted heads. Convergence is
  // decided here, BEFORE any change-record read, so a converged re-run performs
  // zero record reads and zero record-read git invocations.
  const resolution = await resolveChangeBranch({ changeRef, ports });
  if (resolution.kind === "refused") {
    return refused(changeRef, resolution.failure);
  }

  if (resolution.kind === "replay") {
    // Convergence replay from provider truth: exactly one matched identity, the
    // delivered selection used only to name it. Zero change-record reads, zero
    // record-read git invocations, zero landings, no declaration needed.
    const replayTransactions = ports.readTransactions();
    if (!replayTransactions.ok) {
      return refused(changeRef, stateFailure(replayTransactions.reason, replayTransactions.code));
    }
    const replayedTransaction = replayTransactions.records.at(-1);
    if (replayedTransaction !== undefined) {
      // The provider already asserted merged truth on the convergence attempt;
      // the recorded landing replays with no second record and no landing.
      return { kind: "merged", report: replayReport(replayedTransaction) };
    }
    const mergedHead = resolution.request.headSha;
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

  // 1. The resolved request's asserted full-SHA head IS the resolved head
  // (F-1 step 6, DEC-2): the freshness envelope compares against it, the
  // landing's expected head is it, the check-run page is read on it, and the
  // reported head is it. No checkout branch or head is read on this path
  // (NFR-6), and the resolution's own facts name the object every verdict
  // describes (DM-2).
  const head = resolution.request.headSha as string;
  const resolutionFacts: MergeResolutionFacts = {
    source: "declared-at-head",
    branch: resolution.branch,
    requestIdentity: mergeIdentityToken(resolution.request.identity.entityId),
    candidateCount: resolution.candidateCount,
    headSha: head,
  };

  // 2. A recorded transaction on a run whose request is still open is the
  // unverified-landing state: the provider does not assert merged truth on this
  // resolution, so the verdict re-verifies rather than re-landing and never
  // lands a second time.
  const transactions = ports.readTransactions();
  if (!transactions.ok) {
    return refused(changeRef, stateFailure(transactions.reason, transactions.code));
  }
  const latestTransaction = transactions.records.at(-1);
  if (latestTransaction !== undefined) {
    return refused(changeRef, {
      code: "merge.landing-unverified",
      domainKind: "merge",
      exit: 2,
      evidence: {
        operation: "github-merge-delivery-request",
        ...(latestTransaction.squashSha === undefined
          ? {}
          : { recordedSha: latestTransaction.squashSha }),
        requestState: resolution.request.reviewState,
        detail: "provider-not-merged",
      },
    });
  }

  // 3. The freshness envelope over the newest verification record, bound to the
  // resolved head.
  const verification = ports.readVerification();
  if (!verification.ok) {
    return refused(changeRef, stateFailure(verification.reason, verification.code));
  }
  const record = verification.records.at(-1);
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
    return refused(changeRef, stateFailure(envelope.reason));
  }

  // 4. One bounded probe: one work-item read and one check-run page on the
  // resolved head. The request row is the resolution's own accepted candidate,
  // not a second provider read.
  const workItem = await ports.readWorkItem();
  if (!workItem.ok) {
    return refused(changeRef, readFailure(workItem.code, "github-work-item", workItem.credential));
  }
  const checkRuns = await ports.readCheckRuns(head);
  if (!checkRuns.ok) {
    return refused(
      changeRef,
      readFailure(checkRuns.code, "github-check-runs", checkRuns.credential),
    );
  }

  // An already-merged request cannot appear here: the open page carries the
  // open state filter, so merged truth arrives only through the convergence
  // attempt above (F-1 step 3), which has already returned.

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
      changeRef,
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

  // 5. The merge-applicable required-check set, derived ONCE per invocation
  // (F-2): every merge-applicable `required-ci-job` entry contributes
  // `job ?? id`, and the merge-applicable `ci-green` entry contributes the
  // repository-declared expected job set read through the delivered CI
  // workflow read, validated by the exported battery rule. The page wins on
  // state; the gate set wins on membership.
  const ciEntry = config.gateSet.enforcedMergeEntries.find(
    (candidate) => candidate.id === "ci-green",
  );
  let requiredSet: readonly string[] = declaredCiJobsOf(config.gateSet);
  let expectedNames: readonly string[] = [];
  if (ciEntry !== undefined) {
    const workflow = await (ports.readCiWorkflow?.() ??
      Promise.resolve<MergeCiWorkflowRead>({ outcome: "failed", names: [] }));
    const valid =
      workflow.outcome === "read" &&
      expectedSetValid({ outcome: workflow.outcome, names: workflow.names });
    if (!valid) {
      return refused(changeRef, {
        code: failureCode("ci-green"),
        domainKind: "merge",
        exit: 1,
        evidence: {
          gateId: "ci-green",
          detail:
            workflow.outcome === "read"
              ? "invalid-expected-set"
              : `ci-workflow-${workflow.outcome}`,
          operation: workflow.outcome === "read" ? "-" : ("repository-ci-workflow" as const),
        },
      });
    }
    expectedNames = workflow.names;
    requiredSet = [...requiredSet, ...expectedNames];
  }

  // 6. Gate evaluation: the recorded verdicts plus the fresh probe.
  const posture = postureOf(workItem.item.labels, workItem.item.updatedAt);
  const transition =
    record === undefined
      ? { changed: false, before: [], after: [] }
      : classifyTrackerTransition({
          recorded: record.trackerPosture ?? { labels: [], ownerLabels: [] },
          current: posture,
          verifiedAt: record.verifiedAt,
        });
  const failures: GateFailure[] = [];
  const ownerPresent = posture.ownerLabels.length > 0;
  const recordedCi = recordedVerdict(record, "ci-green");
  const recordedCiFailure =
    recordedCi !== undefined && recordedCi.verdict !== "pass" ? recordedCi : undefined;
  if (recordedCiFailure !== undefined) {
    const entry = config.gateSet.enforcedMergeEntries.find(
      (candidate) => candidate.id === "ci-green",
    );
    if (entry !== undefined) {
      // The persisted verdict already reported the job not green, so the
      // finding is `recorded` and names the gate id, the job and the verdict.
      // The verification timestamp stays on that persisted record.
      failures.push(
        requiredJobFailure({
          entry,
          detail: recordedCiFailure.reason,
          attribution: "recorded",
          jobs: recordedNotGreenJobs(recordedCiFailure.citation.names),
        }),
      );
    }
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
  // A page for another head is never head evidence: the probe reads the
  // verified head only, so no declared job can be a finding from it.
  const pageIsHead = checkRuns.value.sha === undefined || checkRuns.value.sha === head;
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
    if (entry.id === "ci-green") {
      // The merge-surface CI evaluation (GH-366 F-2): the page is head evidence
      // only for the resolved head, and every name in the derived required set
      // is evaluated through the single delivered per-job mapping. A page for
      // another head carries no posture — the delivered head-unresolved
      // refusal on the family row names both SHAs.
      if (recordedCiFailure === undefined) {
        const pageNotHead = checkRuns.value.sha !== undefined && checkRuns.value.sha !== head;
        if (pageNotHead) {
          failures.push({
            entry,
            code: failureCode("ci-green"),
            evidence: {
              gateId: "ci-green",
              recordedSha: checkRuns.value.sha,
              currentSha: head,
              detail: "head-unresolved",
            },
          });
        } else {
          // The CI gate evaluates ITS OWN contribution — the expected set;
          // each declared required-ci-job entry evaluates its own job, so a
          // declared job's specific finding keeps its recorded attribution.
          const posture = checksPostureOf({
            runs: checkRuns.value.items,
            pageSha: checkRuns.value.sha ?? head,
            headSha: head,
            requiredJobs: expectedNames,
          });
          if (posture !== undefined) {
            failures.push(
              requiredJobFailure({
                entry,
                detail: posture.reason,
                attribution: "probe",
                jobs: posture.jobs,
              }),
            );
          }
        }
      }
      continue;
    }
    if (entry.id === "owner-gate" || entry.id === "tracker-freshness") {
      continue;
    }
    const verdict = recordedVerdict(record, entry.id);
    if (entry.recipe === "required-ci-job") {
      const job = entry.job ?? entry.id;
      if (verdict !== undefined && verdict.verdict !== "pass") {
        // The recorded verdict already reported this job not green: the
        // finding is `recorded`, and its evidence identifies the persisted
        // record by gate id, job and verdict.
        failures.push(
          requiredJobFailure({
            entry,
            detail: verdict.reason,
            attribution: "recorded",
            jobs: [job],
          }),
        );
        continue;
      }
      if (!pageIsHead) continue;
      const evaluationValue = evaluateRequiredJobGate({
        jobName: job,
        runs: checkRuns.value.items,
        pageSha: checkRuns.value.sha ?? head,
        headSha: head,
      });
      // A declared required job that is not green on the verified head is gate
      // evidence in every delivered state — queued, running, canceled, skipped
      // and failed — classified through the delivered reasons on the existing
      // family row. A job the gate set does not declare is never a finding.
      if (evaluationValue.verdict === "fail") {
        failures.push(
          requiredJobFailure({
            entry,
            detail: evaluationValue.reason,
            attribution: "probe",
            jobs: namedJobReasons.includes(evaluationValue.reason) ? [job] : [],
          }),
        );
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
        return refused(changeRef, {
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
        return refused(changeRef, {
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
    return refused(changeRef, failureFor(failures[0] as GateFailure));
  }

  // 6b. The evaluated merge-applicable projection (AC-F2-8, DEC-12): the
  // merged report renders the projection the run evaluated — one line per
  // merge-applicable entry with its verdict and reason — and does NOT echo the
  // verification record's battery gate list; the record keeps its own list.
  const pageIsProjectionHead = checkRuns.value.sha === undefined || checkRuns.value.sha === head;
  // A landing run has no remaining gate failures (the refusal above), so the
  // evaluated projection here is the passing posture per entry.
  const evaluatedGates: MergeGateVerdictRecord[] = config.gateSet.mergeEntries.map((entry) => {
    if (entry.id === "ci-green") {
      const posture = pageIsProjectionHead
        ? checksPostureOf({
            runs: checkRuns.value.items,
            pageSha: checkRuns.value.sha ?? head,
            headSha: head,
            requiredJobs: expectedNames,
          })
        : ({ reason: "head-unresolved", jobs: ["ci-green"] } as const);
      const reason: VerifyGateReason = posture === undefined ? "ci-green" : posture.reason;
      return {
        id: entry.id,
        verdict: posture === undefined ? "pass" : "fail",
        reason,
        citation: citationFor({
          identity: { changeRef, headSha: head },
          sources: [{ name: "github-check-runs", outcome: "read" }],
          counts: [
            { name: "expected", value: expectedNames.length },
            { name: "runs", value: checkRuns.value.pageItemCount },
          ],
          names:
            posture === undefined
              ? [{ kind: "failed-jobs", values: [], omitted: 0 }]
              : [{ kind: "failed-jobs", values: posture.jobs, omitted: 0 }],
          reason,
        }),
      };
    }
    if (entry.recipe === "required-ci-job") {
      const job = entry.job ?? entry.id;
      if (!pageIsProjectionHead) {
        return {
          id: entry.id,
          verdict: "fail",
          reason: "head-unresolved",
          citation: citationFor({
            identity: { changeRef, headSha: head },
            sources: [{ name: "github-check-runs", outcome: "read" }],
            counts: [{ name: "expected", value: 1 }],
            names: [{ kind: "missing-jobs", values: [job], omitted: 0 }],
            reason: "head-unresolved",
          }),
        };
      }
      const evaluation = evaluateRequiredJobGate({
        jobName: job,
        runs: checkRuns.value.items,
        pageSha: checkRuns.value.sha ?? head,
        headSha: head,
      });
      return {
        id: entry.id,
        verdict: evaluation.verdict,
        reason: evaluation.reason,
        citation: citationFor({
          identity: { changeRef, headSha: head },
          sources: [{ name: "github-check-runs", outcome: "read" }],
          counts: evaluation.counts,
          names: evaluation.names,
          reason: evaluation.reason,
        }),
      };
    }
    if (entry.recipe === "tracker-freshness") {
      const reason: VerifyGateReason = transition.changed
        ? "owner-gate-present"
        : "owner-gate-absent";
      return {
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
      };
    }
    return {
      id: entry.id,
      verdict: "unknown",
      reason: "read-failed",
      citation: emptyCitation(changeRef),
    };
  });

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
      // The deleted branch is the RESOLVED change branch (the request's
      // provider-asserted source ref), never an ambient checkout branch.
      branch: resolution.branch,
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
        report: reportFor(
          transactionRecord,
          declaredStatuses,
          record?.gates ?? [],
          resolutionFacts,
        ),
      };
    }
    return {
      kind: "merged",
      report: reportFor(transactionRecord, postLanding, evaluatedGates, resolutionFacts, {
        evaluatedCount: requiredSet.length,
        setSize: requiredSet.length,
      }),
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
    return refused(changeRef, {
      code: "merge.landing-unverified",
      domainKind: "merge",
      exit: 2,
      evidence: {
        operation: "github-merge-delivery-request",
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
      // A refused landing maps through the closed, total landing-fault mapping:
      // it is never converted into a local commit, a fallback landing, a
      // success by inference, or the abort row (AC-F3-3).
      return refused(changeRef, landingFaultFailure(landed.code, landed.credential));
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
    const reRead = await ports.readRequestDetail(request.identity.entityId);
    if (!reRead.ok) {
      return refused(
        changeRef,
        readFailure(reRead.code, "github-delivery-request-detail", reRead.credential),
      );
    }
    const posture = checksPostureOf({
      runs: checkRuns.value.items,
      pageSha: checkRuns.value.sha ?? head,
      headSha: head,
      requiredJobs: declaredCiJobsOf(config.gateSet),
    });
    if (posture !== undefined) {
      return refused(changeRef, {
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
    return refused(changeRef, {
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
        return refused(changeRef, {
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
        // `unknown` or absent: exactly one bounded unknown-recovery re-read of
        // the SINGLE request (never the list), compared on the exact head. The
        // command never waits or polls.
        const reRead = await ports.readRequestDetail(request.identity.entityId);
        if (!reRead.ok) {
          return refused(
            changeRef,
            readFailure(reRead.code, "github-delivery-request-detail", reRead.credential),
          );
        }
        const observed = reRead.request;
        if (observed.headSha !== undefined && observed.headSha !== head) {
          return refused(changeRef, {
            code: "merge.gates-stale",
            domainKind: "merge",
            exit: 1,
            evidence: { recordedSha: head, currentSha: observed.headSha, detail: "head-changed" },
          });
        }
        if (observed.mergeableState === undefined || observed.mergeableState === "unknown") {
          return refused(changeRef, {
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
    return refused(changeRef, {
      code: "merge.transaction-aborted",
      domainKind: "merge",
      exit: 1,
      evidence: { detail: `merge-delivery-request:${landingGap}` },
    });
  }

  // 9. One landing mechanism, and its provider-asserted verdict.
  // 9. The landing decision's mergeability source (F-2, LF-1): the delivered
  // SINGLE-request read of the request the resolution located — the list
  // endpoint cannot carry mergeability, so the open-list entry's missing
  // mergeability fields never refuse `merge.mergeability-unknown`. A fault of
  // this read names `operation=github-delivery-request-detail`; the
  // unknown-recovery re-read re-reads the single request, never the list.
  const requestDetail = await ports.readRequestDetail(resolution.request.identity.entityId);
  if (!requestDetail.ok) {
    return refused(
      changeRef,
      readFailure(requestDetail.code, "github-delivery-request-detail", requestDetail.credential),
    );
  }
  return decide(requestDetail.request);
};

const reportFor = (
  record: MergeTransactionRecord,
  postLanding: readonly MergePostLandingStep[],
  gates: readonly MergeGateVerdictRecord[],
  resolution?: MergeResolutionFacts,
  requiredChecks?: { readonly evaluatedCount: number; readonly setSize: number },
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
  ...(requiredChecks === undefined ? {} : { requiredChecks }),
  ...(resolution === undefined ? {} : { resolution }),
});

const replayReport = (record: MergeTransactionRecord): MergeReport =>
  reportFor(record, record.postLanding, []);

const failureFor = (failure: GateFailure): MergeFailure => ({
  code: failure.code,
  domainKind: "merge",
  exit: 1,
  evidence: failure.evidence,
});

const refused = (ref: string, failure: MergeFailure): MergeTransactionOutcome => ({
  kind: "refused",
  failure,
  summary: renderMergeFailure(failure, { command: "merge", ref }),
});

/** The rendering context every merge refusal is rendered with (DEC-11). */
export type MergeRefusalRenderingContext = {
  /** The command identity rendered as the dedicated `command=` field. */
  readonly command: string;
  /**
   * The invocation's change ref, rendered as the dedicated `ref=` field. There
   * is no empty-value branch: every merge refusal path is reached with a usable
   * ref, so `ref=-` is not a declared state.
   */
  readonly ref: string;
};

/**
 * Validate one `operation` token against the closed vocabulary at the rendering
 * site (AC-F3-1, NFR-5): an out-of-vocabulary value is a rendering failure and
 * never a value passed through into the summary.
 */
export const assertMergeRefusalOperation = (token: string | undefined): MergeRefusalOperation => {
  if (token === undefined) return "-";
  const member = MERGE_REFUSAL_OPERATIONS.find((candidate) => candidate === token);
  if (member !== undefined) return member;
  throw new Error(
    `merge refusal rendering: operation token "${token}" is outside the closed vocabulary`,
  );
};

/**
 * Render one refusal deterministically and within the human bounds.
 *
 * The decisive condition and the named failing gate come first; the three
 * dedicated fields (`command=`, `ref=`, `operation=`) follow the condition line
 * (DEC-11); every list is capped with an explicit `+N`. The remediation hint is
 * the declared row's.
 */
export const renderMergeFailure = (
  failure: MergeFailure,
  context: MergeRefusalRenderingContext,
): string => {
  const evidence = failure.evidence;
  const operation = assertMergeRefusalOperation(evidence.operation);
  const lines: string[] = [];
  if (failure.code === "merge.landing-unverified") {
    lines.push("result=unverified; landing=unverified");
  } else {
    lines.push(`result=refused; condition=${failure.code}`);
  }
  lines.push(`command=${context.command}`);
  lines.push(`ref=${context.ref}`);
  lines.push(`operation=${operation}`);
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
  if (evidence.branchReason !== undefined) lines.push(`branch-reason=${evidence.branchReason}`);
  if (evidence.requestReason !== undefined) lines.push(`request-reason=${evidence.requestReason}`);
  if (evidence.openCount !== undefined) lines.push(`open=${String(evidence.openCount)}`);
  if (evidence.candidateCount !== undefined) {
    lines.push(`candidates=${String(evidence.candidateCount)}`);
  }
  if (evidence.matchedIdentities !== undefined) {
    lines.push(
      `matched-identities=${evidence.matchedIdentities.length === 0 ? "none" : listText(evidence.matchedIdentities)}`,
    );
  }
  if (evidence.candidateFindings !== undefined) {
    for (const finding of evidence.candidateFindings.slice(0, MERGE_BRANCH_CANDIDATE_MAX)) {
      lines.push(
        `candidate=${clamp(finding.ref, MERGE_MAX_REF_CHARS)} path=${finding.path} cause=${finding.cause}`,
      );
    }
  }
  if (evidence.credentialReference !== undefined) {
    lines.push(
      `credential-reference=${evidence.credentialReference} credential-source=${evidence.credentialSourceKey ?? "-"}`,
    );
  }
  if (evidence.detail !== undefined) lines.push(`evidence=${evidence.detail}`);
  if (evidence.attribution !== undefined) lines.push(`attribution=${evidence.attribution}`);
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
  // The dry run shares exactly the real merge's resolution (F-5): the same
  // open-list read, candidate set, convergence attempt and per-path provider
  // counts, reaching no landing decision and taking no mergeability read.
  const resolution = await resolveChangeBranch({ changeRef, ports });
  if (resolution.kind === "refused") {
    return refused(changeRef, resolution.failure);
  }
  if (resolution.kind === "replay") {
    // The converged-replay dry run reports the resolved replay object
    // (TC-MRG-043's restated oracle): `replayed=true` with the single matched
    // request's identity, zero mutations, zero landing calls, never
    // `result=merged`, never `squash=`, and no post-landing steps. Whether it
    // appends a verification record is pinned in neither direction, so it
    // performs no write at all.
    return {
      kind: "dry-run",
      report: {
        result: "verified",
        changeRef,
        headSha: resolution.request.headSha ?? "",
        gates: [],
        gatesOmitted: 0,
        authorizations: [],
        replayed: true,
        requestIdentity: resolution.identity,
      },
      authorizations: [],
    };
  }
  // The resolved request's asserted full-SHA head is the resolved head; the
  // appended verification record's head is the resolved head (AC-F5-2).
  const head = resolution.request.headSha as string;
  const resolutionFacts: MergeResolutionFacts = {
    source: "declared-at-head",
    branch: resolution.branch,
    requestIdentity: mergeIdentityToken(resolution.request.identity.entityId),
    candidateCount: resolution.candidateCount,
    headSha: head,
  };
  const workItem = await ports.readWorkItem();
  if (!workItem.ok) {
    return refused(changeRef, readFailure(workItem.code, "github-work-item", workItem.credential));
  }
  const checkRuns = await ports.readCheckRuns(head);
  if (!checkRuns.ok) {
    return refused(
      changeRef,
      readFailure(checkRuns.code, "github-check-runs", checkRuns.credential),
    );
  }
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
  // The merge-applicable required-check set, derived once (F-2): the same
  // derivation the live run performs, validated by the exported battery rule.
  const ciEntry = config.gateSet.mergeEntries.find((candidate) => candidate.id === "ci-green");
  let dryRequiredSet: readonly string[] = config.gateSet.mergeEntries
    .filter((entry) => entry.recipe === "required-ci-job")
    .map((entry) => entry.job ?? entry.id);
  let dryExpectedNames: readonly string[] = [];
  if (ciEntry !== undefined) {
    const workflow = await (ports.readCiWorkflow?.() ??
      Promise.resolve<MergeCiWorkflowRead>({ outcome: "failed", names: [] }));
    const valid =
      workflow.outcome === "read" &&
      expectedSetValid({ outcome: workflow.outcome, names: workflow.names });
    if (!valid) {
      return refused(input.changeRef, {
        code: failureCode("ci-green"),
        domainKind: "merge",
        exit: 1,
        evidence: {
          gateId: "ci-green",
          detail:
            workflow.outcome === "read"
              ? "invalid-expected-set"
              : `ci-workflow-${workflow.outcome}`,
          operation: workflow.outcome === "read" ? "-" : ("repository-ci-workflow" as const),
        },
      });
    }
    dryExpectedNames = workflow.names;
    dryRequiredSet = [...dryRequiredSet, ...dryExpectedNames];
  }

  for (const entry of config.gateSet.mergeEntries) {
    if (entry.id === "ci-green") {
      // The merge-surface CI evaluation over the derived required set (F-2):
      // a page for another head is never head evidence, and the first
      // not-green required name carries the delivered reason.
      const pageIsHead = checkRuns.value.sha === undefined || checkRuns.value.sha === head;
      if (!pageIsHead) {
        // The delivered head-unresolved reason names both SHAs: a page for
        // another head is never evidence (TC-MRG-013).
        gates.push({
          id: entry.id,
          verdict: "fail",
          reason: "head-unresolved",
          citation: citationFor({
            identity: { changeRef, headSha: head },
            sources: [{ name: "github-check-runs", outcome: "read" }],
            counts: [{ name: "expected", value: dryRequiredSet.length }],
            names: [{ kind: "missing-jobs", values: ["ci-green"], omitted: 0 }],
            reason: "head-unresolved",
          }),
        });
        continue;
      }
      const posture = checksPostureOf({
        runs: checkRuns.value.items,
        pageSha: checkRuns.value.sha ?? head,
        headSha: head,
        requiredJobs: dryExpectedNames,
      });
      const reason: VerifyGateReason = posture === undefined ? "ci-green" : posture.reason;
      gates.push({
        id: entry.id,
        verdict: posture === undefined ? "pass" : "fail",
        reason,
        citation: citationFor({
          identity: { changeRef, headSha: head },
          sources: [{ name: "github-check-runs", outcome: "read" }],
          counts: [
            { name: "expected", value: dryRequiredSet.length },
            { name: "runs", value: checkRuns.value.pageItemCount },
          ],
          names:
            posture === undefined
              ? [{ kind: "failed-jobs", values: [], omitted: 0 }]
              : [{ kind: "failed-jobs", values: posture.jobs, omitted: 0 }],
          reason,
        }),
      });
      continue;
    }
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
  if (!appended.ok) return refused(changeRef, stateFailure("unreadable", appended.code));

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
    return refused(changeRef, {
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
      // The evaluated required-check posture (F-2): the derivation evaluated
      // every name in the derived set, whose size is disclosed with it.
      requiredChecks: { evaluatedCount: dryRequiredSet.length, setSize: dryRequiredSet.length },
      resolution: resolutionFacts,
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

/** The post-landing step ids the record carries (declared once). */
export const mergePostLandingStepIds = (): readonly string[] => MERGE_POST_LANDING_STEP_IDS;

/** A helper narrowing a policy row's never-merge posture (data-only consumers). */
export const policyRowForClass = (
  policy: OwnerGateSlaPolicy,
  gateClass: string | undefined,
): OwnerGateSlaPolicyRow | undefined =>
  gateClass === undefined ? undefined : policy.rows.find((row) => row.class === gateClass);
