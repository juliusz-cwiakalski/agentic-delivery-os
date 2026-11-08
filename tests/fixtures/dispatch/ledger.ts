/**
 * Deterministic dispatch ledger builders (GH-239 §6.3): attempt, comparison,
 * corroboration, divergence, handover, and authority-view records with
 * deterministic identities. These are test data, never a ledger writer: every
 * durable append goes through the core ledger functions.
 */
import {
  DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
  DISPATCH_AUTHORITY_SCHEMA,
  DISPATCH_DIVERGENCE_PAYLOAD_SCHEMA,
  DISPATCH_HANDOVER_PAYLOAD_SCHEMA,
  type DeliveryResultToken,
  type DispatchAttemptRecord,
  type DispatchAuthorityView,
  type DispatchComparisonRecord,
  type DispatchCorroborationRecord,
  type DispatchDivergenceRecord,
  type DispatchEvidenceClass,
  type DispatchHandoverOperation,
  type DispatchHandoverRecord,
} from "../../../packages/core/src/contracts/index";
import {
  buildComparisonRecord,
  buildCorroborationRecord,
  dispatchFamilyOf,
  type CorroborationFacts,
} from "../../../packages/core/src/domain/dispatch-comparison";
import { DISPATCH_NOW } from "./harness";

/** A local alias: keeps fixture signatures short and recognizable. */
type DispatchToken = DeliveryResultToken;

export const REPOSITORY = "github.com/owner/repo" as const;
export const REPOSITORY_BETA = "github.com/owner/other" as const;

export const comparisonForToken = (
  token: DispatchToken,
  options: { readonly urlResolved?: boolean } = {},
): DispatchComparisonRecord => {
  const family = dispatchFamilyOf(token);
  if (family === "verify") {
    return buildComparisonRecord({
      kind: "verify-change",
      engineToken: token,
      ledgerOutcome: token,
    });
  }
  if (family === "tracker-pr") {
    return buildComparisonRecord({
      kind: "tracker-truth",
      engineToken: token,
      trackerToken: token === "pr-open-unverified" ? "pr-open" : token,
      ...(options.urlResolved === undefined ? {} : { urlResolved: options.urlResolved }),
    });
  }
  return buildComparisonRecord({
    kind: "not-applicable",
    engineToken: token,
    reason: "dispatch-session-family",
  });
};

export const corroborationFor = (
  token: DispatchToken,
  facts?: CorroborationFacts,
): DispatchCorroborationRecord =>
  buildCorroborationRecord({ token, ...(facts === undefined ? {} : { facts }) });

export const makeAttempt = (
  overrides: Partial<DispatchAttemptRecord> & { readonly token: DispatchToken },
): DispatchAttemptRecord => {
  const token = overrides.token;
  const base: DispatchAttemptRecord = {
    schema: DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
    attemptId: `attempt-${token}`,
    repository: REPOSITORY,
    ref: "GH-239",
    harness: "opencode",
    evidenceClass: "pilot",
    startedAt: DISPATCH_NOW,
    finishedAt: DISPATCH_NOW,
    handoverState: "dual-run",
    outcome: "completed",
    token,
    comparison: comparisonForToken(token),
    falseSuccess: false,
    corroboration: corroborationFor(token, {
      "pm-notes": "satisfied",
      tracker: "satisfied",
      ci: "satisfied",
    }),
    evidenceRefs: ["ledger:phase-2"],
    recordedAt: DISPATCH_NOW,
  };
  return { ...base, ...overrides };
};

export const makeComparison = comparisonForToken;

export const makeDivergence = (
  overrides: Partial<DispatchDivergenceRecord> = {},
): DispatchDivergenceRecord => ({
  schema: DISPATCH_DIVERGENCE_PAYLOAD_SCHEMA,
  divergenceId: "DIV-1",
  repository: REPOSITORY,
  ref: "GH-239",
  attemptId: "attempt-1",
  state: "open",
  comparisonClass: "tracker-truth",
  engineToken: "pr-open",
  comparisonToken: "blocked",
  evidenceRefs: ["attempt:attempt-1"],
  recordedAt: DISPATCH_NOW,
  ...overrides,
});

export const makeHandover = (
  overrides: Partial<DispatchHandoverRecord> = {},
): DispatchHandoverRecord => ({
  schema: DISPATCH_HANDOVER_PAYLOAD_SCHEMA,
  repository: REPOSITORY,
  operation: "authoritative",
  conditions: {
    verdict: "eligible",
    windowStart: DISPATCH_NOW,
    windowStartReason: "first-counted-dispatch",
    countedDeliveries: 20,
    coveragePresent: [],
    coverageMissing: [],
    incidents: 0,
    unresolvedDivergences: 0,
    floorMet: true,
    corroborationSatisfied: 20,
  },
  evidenceRefs: ["window:1"],
  principal: "coder@local",
  recordedAt: DISPATCH_NOW,
  ...overrides,
});

export const makeAuthorityView = (
  overrides: Partial<DispatchAuthorityView> = {},
): DispatchAuthorityView => ({
  schema: DISPATCH_AUTHORITY_SCHEMA,
  repository: REPOSITORY,
  authority: "dual-run",
  recordedAt: DISPATCH_NOW,
  reversalAvailable: false,
  ...overrides,
});

export const makeAttemptFor = (
  token: DispatchToken,
  options: {
    readonly evidenceClass?: DispatchEvidenceClass;
    readonly attemptId?: string;
    readonly repository?: string;
    readonly recordedAt?: string;
    readonly outcome?: DispatchAttemptRecord["outcome"];
    readonly comparison?: DispatchComparisonRecord;
    readonly falseSuccess?: boolean;
    readonly corroboration?: DispatchCorroborationRecord;
    readonly evidenceRefs?: readonly string[];
  } = {},
): DispatchAttemptRecord =>
  makeAttempt({
    token,
    ...(options.evidenceClass === undefined ? {} : { evidenceClass: options.evidenceClass }),
    ...(options.attemptId === undefined ? {} : { attemptId: options.attemptId }),
    ...(options.repository === undefined ? {} : { repository: options.repository }),
    ...(options.recordedAt === undefined ? {} : { recordedAt: options.recordedAt }),
    ...(options.outcome === undefined ? {} : { outcome: options.outcome }),
    ...(options.comparison === undefined ? {} : { comparison: options.comparison }),
    ...(options.falseSuccess === undefined ? {} : { falseSuccess: options.falseSuccess }),
    ...(options.corroboration === undefined ? {} : { corroboration: options.corroboration }),
    ...(options.evidenceRefs === undefined ? {} : { evidenceRefs: options.evidenceRefs }),
  });

export const handoverOperationOf = (
  operation: DispatchHandoverOperation,
): DispatchHandoverOperation => operation;
