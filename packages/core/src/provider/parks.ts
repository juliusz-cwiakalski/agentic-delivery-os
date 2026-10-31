/**
 * Park records, deterministic naming, and portable UTC rendering (GH-182 F-5).
 *
 * Runtime-neutral: pure data construction and arithmetic only. The state-layer
 * persistence helpers and the fold/projection view are added in Phase 3/5.
 */
import {
  type ParkCause,
  PARK_EVIDENCE_FIELDS,
  PROVIDER_PARK_SCHEMA_ID,
  type ProviderAnnouncementEvidence,
  type ProviderAnnouncementRecord,
  type ProviderConditionKind,
  type ProviderParkEvidence,
  type ProviderParkRecord,
} from "#contracts";

const DAY_MS = 86_400_000;

const pad = (value: number, width = 2): string => String(value).padStart(width, "0");

type CivilDate = { readonly year: number; readonly month: number; readonly day: number };

/** Days since 1970-01-01 to a proleptic Gregorian civil date (Howard Hinnant). */
const civilFromDays = (days: number): CivilDate => {
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1_460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365,
  );
  const yearOfEra = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  return { year: yearOfEra + (month <= 2 ? 1 : 0), month, day };
};

/** Render epoch milliseconds as an ISO-8601 UTC instant, independent of host locale. */
export const formatUtcIso = (milliseconds: number): string => {
  const days = Math.floor(milliseconds / DAY_MS);
  const remainder = milliseconds - days * DAY_MS;
  const civil = civilFromDays(days);
  const hours = Math.floor(remainder / 3_600_000);
  const minutes = Math.floor((remainder % 3_600_000) / 60_000);
  const seconds = Math.floor((remainder % 60_000) / 1_000);
  const millis = remainder % 1_000;
  return `${pad(civil.year, 4)}-${pad(civil.month)}-${pad(civil.day)}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}Z`;
};

/** `provider:<name>` (DM-10). */
export const providerParkName = (providerName: string): string => `provider:${providerName}`;

/** `chain:<name>` (DM-10). */
export const chainParkName = (chainName: string): string => `chain:${chainName}`;

const uniqueKinds = (kinds: readonly ProviderConditionKind[]): readonly ProviderConditionKind[] => [
  ...new Set(kinds),
];

/** Project evidence through the closed eight-field allowlist only. */
export const projectParkEvidence = (
  evidence: ProviderParkEvidence,
): ProviderParkEvidence => {
  const projected: Record<string, unknown> = {};
  for (const field of PARK_EVIDENCE_FIELDS) {
    const value = evidence[field];
    if (value !== undefined) projected[field] = value;
  }
  return projected as ProviderParkEvidence;
};

export type ParkInput = {
  readonly subjectKind: "provider" | "chain";
  readonly subjectName: string;
  readonly cause: ParkCause;
  readonly conditions: readonly ProviderConditionKind[];
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
  readonly evidence: ProviderParkEvidence;
};

/** Construct one active park record with deterministic naming and expiry. */
export const createParkRecord = (input: ParkInput): ProviderParkRecord => ({
  schemaVersion: PROVIDER_PARK_SCHEMA_ID,
  name:
    input.subjectKind === "provider"
      ? providerParkName(input.subjectName)
      : chainParkName(input.subjectName),
  subjectKind: input.subjectKind,
  subjectName: input.subjectName,
  cause: input.cause,
  conditions: uniqueKinds(input.conditions),
  state: "active",
  createdAt: formatUtcIso(input.createdAtMs),
  createdAtMs: input.createdAtMs,
  expiresAt: formatUtcIso(input.expiresAtMs),
  expiresAtMs: input.expiresAtMs,
  evidence: projectParkEvidence({
    ...input.evidence,
    ...(input.subjectKind === "provider"
      ? { providerName: input.subjectName }
      : { chainName: input.subjectName }),
    conditionKinds: uniqueKinds(input.conditions),
  }),
});

/** Construct one `cleared` park record from an active record. */
export const clearParkRecord = (
  park: ProviderParkRecord,
  clearedAtMs: number,
): ProviderParkRecord => ({
  ...park,
  state: "cleared",
  clearedAt: formatUtcIso(clearedAtMs),
  clearedAtMs,
});

/** The deterministic park generation identity: cause plus absolute expiry (DEC-12). */
export const parkGeneration = (park: ProviderParkRecord): string =>
  `${park.cause}:${park.expiresAtMs}`;

/** A parked/expired/cleared read-time view (DM-12, NFR-7). */
export const parkView = (
  park: ProviderParkRecord,
  nowMs: number,
): import("#contracts").ProviderParkView => ({
  name: park.name,
  subjectKind: park.subjectKind,
  subjectName: park.subjectName,
  cause: park.cause,
  conditions: park.conditions,
  state: park.state === "cleared" ? "cleared" : park.expiresAtMs <= nowMs ? "expired" : "active",
  createdAt: park.createdAt,
  expiresAt: park.expiresAt,
  ...(park.clearedAt === undefined ? {} : { clearedAt: park.clearedAt }),
  evidence: park.evidence,
});

/** Deterministic ordering: expiry ascending, then name lexical (AC-F5-5). */
export const compareParks = (left: ProviderParkRecord, right: ProviderParkRecord): number =>
  left.expiresAtMs - right.expiresAtMs ||
  (left.name < right.name ? -1 : left.name > right.name ? 1 : 0);

/** Fold the ledger's park records to the latest record per park name (DM-12). */
export const foldParks = (
  records: readonly ProviderParkRecord[],
): readonly ProviderParkRecord[] => {
  const latest = new Map<string, ProviderParkRecord>();
  for (const record of records) latest.set(record.name, record);
  return [...latest.values()].sort(compareParks);
};

/** Announcement identity is deterministic from subject + code + park generation (DEC-12). */
export const announcementIdentity = (
  subjectKind: "provider" | "chain",
  subjectName: string,
  code: string,
  generation: string,
): string => `${subjectKind}:${subjectName}:${code}:${generation}`;

/** Build the announcement evidence view; it is closed to the eleven-field allowlist. */
export const announcementEvidence = (
  evidence: ProviderAnnouncementEvidence,
): ProviderAnnouncementEvidence => {
  const projected: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(evidence)) {
    if (value !== undefined) projected[key] = value;
  }
  return projected as ProviderAnnouncementEvidence;
};

export type AnnouncementInput = {
  readonly subjectKind: "provider" | "chain";
  readonly subjectName: string;
  readonly code: ProviderAnnouncementRecord["code"];
  readonly severity: ProviderAnnouncementRecord["severity"];
  readonly createdAtMs: number;
  readonly message: string;
  readonly cause?: ParkCause;
  readonly conditions?: readonly ProviderConditionKind[];
  readonly park?: ProviderParkRecord;
  readonly evidence: ProviderAnnouncementEvidence;
};

/** Construct one announcement record with deterministic identity. */
export const createAnnouncementRecord = (
  input: AnnouncementInput,
): ProviderAnnouncementRecord => {
  const generation =
    input.park === undefined
      ? "none"
      : parkGeneration(input.park);
  return {
    schemaVersion: "delivery.provider.announcement.v1",
    identity: announcementIdentity(
      input.subjectKind,
      input.subjectName,
      input.code,
      generation,
    ),
    code: input.code,
    severity: input.severity,
    subjectKind: input.subjectKind,
    subjectName: input.subjectName,
    createdAt: formatUtcIso(input.createdAtMs),
    ...(input.cause === undefined ? {} : { cause: input.cause }),
    ...(input.conditions === undefined ? {} : { conditions: uniqueKinds(input.conditions) }),
    ...(input.park === undefined
      ? {}
      : { parkName: input.park.name, parkExpiresAt: input.park.expiresAt }),
    message: input.message,
    evidence: announcementEvidence({
      ...input.evidence,
      ...(input.park === undefined
        ? {}
        : { parkName: input.park.name, parkExpiresAt: input.park.expiresAt }),
      announcementCode: input.code,
    }),
  };
};
