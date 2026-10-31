/**
 * Structured fail-loud announcements (GH-182 F-6, DM-11, EVT-2..EVT-4).
 *
 * Every non-clear condition that persists a park emits exactly one announcement
 * for that park generation. Codes, severities, and evidence are closed sets.
 */
import type {
  AnnouncementCode,
  AnnouncementSeverity,
  ParkCause,
  ProviderAnnouncementRecord,
  ProviderParkRecord,
} from "#contracts";
import { createAnnouncementRecord, parkGeneration } from "./parks.js";

const INFO_CODES = new Set<AnnouncementCode>([
  "provider.peak.parked",
  "provider.quota.parked",
  "provider.resumed",
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
): string => {
  const subject = `${subjectKind} ${subjectName}`;
  if (code === "provider.resumed") return `${subject} resumed`;
  if (code === "provider.reevaluation.cap") {
    return `${subject} reached the re-evaluation cap${resumeAt === undefined ? "" : ` until ${resumeAt}`}`;
  }
  if (code === "provider.chain.exhausted") {
    return `${subject} chain is exhausted${resumeAt === undefined ? "" : ` until ${resumeAt}`}`;
  }
  return `${subject} is parked (${code})${resumeAt === undefined ? "" : ` until ${resumeAt}`}`;
};

/** Build the one announcement for a park generation. */
export const createParkAnnouncement = (
  park: ProviderParkRecord,
  nowMs: number,
): ProviderAnnouncementRecord => {
  const code = announcementCodeForCondition(park.cause, park.evidence.failureClass);
  return createAnnouncementRecord({
    subjectKind: park.subjectKind,
    subjectName: park.subjectName,
    code,
    severity: severityForAnnouncementCode(code),
    createdAtMs: nowMs,
    message: messageFor(park.subjectKind, park.subjectName, code, park.expiresAt),
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
