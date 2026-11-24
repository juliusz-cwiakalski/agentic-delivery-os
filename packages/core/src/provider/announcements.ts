/**
 * Structured fail-loud announcements (GH-182 F-6, DM-11, EVT-2..EVT-4).
 *
 * Every non-clear condition that persists a park emits exactly one announcement
 * for that park generation. Codes, severities, and evidence are closed sets.
 */
import type {
  AnnouncementCode,
  AnnouncementSeverity,
  CredentialFailureProjection,
  ParkCause,
  ProviderAnnouncementRecord,
  ProviderParkRecord,
} from "#contracts";
import { createAnnouncementRecord, parkGeneration } from "./parks.js";

const INFO_CODES = new Set<AnnouncementCode>([
  "provider.peak.parked",
  "provider.quota.parked",
  "provider.resumed",
  "provider.budget.parked",
]);

/** Map a park cause (and its failure class) to the closed announcement code. */
export const announcementCodeForCondition = (
  cause: ParkCause,
  failureClass?: string,
): AnnouncementCode => {
  switch (cause) {
    case "peak-window":
      return "provider.peak.parked";
    case "quota-exhausted":
      return "provider.quota.parked";
    case "budget-exhausted":
      return "provider.budget.parked";
    case "provider-outage":
      if (failureClass?.startsWith("http_")) return "provider.quota.http_error";
      if (
        failureClass === "malformed_json" ||
        failureClass === "invalid_envelope" ||
        failureClass === "limits_absent" ||
        failureClass === "limits_nonarray" ||
        failureClass === "pct_non_numeric"
      ) {
        return "provider.quota.malformed";
      }
      return "provider.quota.unreachable";
    case "credential-missing":
      return "provider.credential.missing";
    case "credential-rejected":
      return "provider.quota.auth_rejected";
    case "chain-exhausted":
      return "provider.chain.exhausted";
    case "reevaluation-cap":
      return "provider.reevaluation.cap";
  }
};

/** `info` for parks and resumes; `warning` for every failure class. */
export const severityForAnnouncementCode = (code: AnnouncementCode): AnnouncementSeverity =>
  INFO_CODES.has(code) ? "info" : "warning";

const messageFor = (
  subjectKind: "provider" | "chain",
  subjectName: string,
  code: AnnouncementCode,
  resumeAt?: string,
  credential?: CredentialFailureProjection,
): string => {
  const subject = `${subjectKind} ${subjectName}`;
  if (code === "provider.resumed") return `${subject} resumed`;
  if (code === "provider.reevaluation.cap") {
    return `${subject} reached the re-evaluation cap${resumeAt === undefined ? "" : ` until ${resumeAt}`}`;
  }
  if (code === "provider.chain.exhausted") {
    return `${subject} chain is exhausted${resumeAt === undefined ? "" : ` until ${resumeAt}`}`;
  }
  // The credential-missing line derives from the code plus the reason token
  // (DEC-14): the classified projection rides the log line — identifier-only
  // data and the fixed remedy text — never a park-record field.
  if (code === "provider.credential.missing" && credential !== undefined) {
    const remedy = credential.remedy === undefined ? "" : ` ${credential.remedy}`;
    return (
      `${subject} is parked (${code}; source ${credential.source ?? "-"}, ` +
      `reason ${credential.reason ?? "-"})${remedy}${resumeAt === undefined ? "" : ` until ${resumeAt}`}`
    );
  }
  return `${subject} is parked (${code})${resumeAt === undefined ? "" : ` until ${resumeAt}`}`;
};

/**
 * The rendered-refusal note for a reconstructed credential failure (DEC-14):
 * the code stays the delivered identity; the projection rides the summary
 * text, because the rendered refusal and the log line are the only reason
 * carriers. Absent projection keeps the delivered line byte-identical.
 */
export const credentialRefusalNote = (credential?: CredentialFailureProjection): string =>
  credential === undefined
    ? ""
    : ` (credential source ${credential.source ?? "-"}, reason ${credential.reason ?? "-"}${
        credential.remedy === undefined ? "" : `; ${credential.remedy}`
      })`;

/**
 * The DEC-10 cost-sparsity note (GH-350). It rides the message only: the
 * evidence allowlist stays five fields, so sparsity is stated, never a field.
 */
export const sparsityNote = (basis: string | undefined, sparse: boolean): string =>
  basis === "cost" && sparse ? "; harness cost was sparse, unpriced records are excluded" : "";

/** The budget park message: the budget, its figures, the measured ref, the resume. */
export const budgetParkMessage = (
  subjectName: string,
  park: Pick<ProviderParkRecord, "evidence" | "expiresAt">,
  context: { readonly workItemRef?: string; readonly sparse?: boolean } = {},
): string => {
  const evidence = park.evidence;
  const ref = context.workItemRef === undefined ? "" : ` for ${context.workItemRef}`;
  const sparse = sparsityNote(evidence.budgetBasis, context.sparse === true);
  return (
    `provider ${subjectName} is parked on budget ${evidence.budgetName ?? "?"} ` +
    `(${evidence.budgetScope ?? "?"}, ${evidence.budgetBasis ?? "?"} ` +
    `${String(evidence.budgetMeasured ?? 0)} of ${String(evidence.budgetCeiling ?? 0)})${ref} ` +
    `until ${park.expiresAt}${sparse}`
  );
};

/** The budget crossing message: the budget, its figures, the measured ref, and the terminal fact. */
export const budgetCrossedMessage = (
  subjectName: string,
  evidence: {
    readonly budgetName?: string;
    readonly budgetScope?: string;
    readonly budgetBasis?: string;
    readonly budgetMeasured?: number;
    readonly budgetCeiling?: number;
  },
  context: { readonly workItemRef?: string; readonly sparse?: boolean } = {},
): string => {
  const ref = context.workItemRef === undefined ? "" : ` for ${context.workItemRef}`;
  const sparse = sparsityNote(evidence.budgetBasis, context.sparse === true);
  return (
    `provider ${subjectName} crossed budget ${evidence.budgetName ?? "?"} ` +
    `(${evidence.budgetScope ?? "?"}, ${evidence.budgetBasis ?? "?"} ` +
    `${String(evidence.budgetMeasured ?? 0)} of ${String(evidence.budgetCeiling ?? 0)})${ref}; ` +
    `the ceiling cannot reopen while this work item keeps its history${sparse}`
  );
};

/** Build the one announcement for a park generation. */
export const createParkAnnouncement = (
  park: ProviderParkRecord,
  nowMs: number,
  context: {
    readonly workItemRef?: string;
    readonly sparse?: boolean;
    /** The in-process credential projection (DEC-14); never persisted. */
    readonly credential?: CredentialFailureProjection;
  } = {},
): ProviderAnnouncementRecord => {
  const code = announcementCodeForCondition(park.cause, park.evidence.failureClass);
  const message =
    code === "provider.budget.parked"
      ? budgetParkMessage(park.subjectName, park, context)
      : messageFor(park.subjectKind, park.subjectName, code, park.expiresAt, context.credential);
  return createAnnouncementRecord({
    subjectKind: park.subjectKind,
    subjectName: park.subjectName,
    code,
    severity: severityForAnnouncementCode(code),
    createdAtMs: nowMs,
    message,
    cause: park.cause,
    conditions: park.conditions,
    park,
    evidence: { ...park.evidence, announcementCode: code },
  });
};

/** Build the `provider.resumed` announcement for a cleared generation (EVT-4). */
export const createResumedAnnouncement = (
  park: ProviderParkRecord,
  nowMs: number,
): ProviderAnnouncementRecord =>
  createAnnouncementRecord({
    subjectKind: park.subjectKind,
    subjectName: park.subjectName,
    code: "provider.resumed",
    severity: "info",
    createdAtMs: nowMs,
    message: messageFor(park.subjectKind, park.subjectName, "provider.resumed"),
    cause: park.cause,
    conditions: park.conditions,
    generation: parkGeneration(park),
    evidence: { announcementCode: "provider.resumed" },
  });
