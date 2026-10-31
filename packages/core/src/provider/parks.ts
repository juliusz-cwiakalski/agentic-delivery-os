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
  type ProviderParkView,
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
  readonly generation?: string;
  readonly evidence: ProviderAnnouncementEvidence;
};

/** Construct one announcement record with deterministic identity. */
export const createAnnouncementRecord = (
  input: AnnouncementInput,
): ProviderAnnouncementRecord => {
  const generation =
    input.generation ?? (input.park === undefined ? "none" : parkGeneration(input.park));
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

/* ------------------------------------------------------------------------- *
 * State-layer integration (Phase 5): fenced appends, verified reads, the
 * `provider-parks.json` projection, and zero-write read-time views (PD-A).
 * ------------------------------------------------------------------------- */

import {
  PROVIDER_ANNOUNCEMENT_RECORD_KEY,
  PROVIDER_ANNOUNCEMENT_SCHEMA_ID,
  PROVIDER_PARK_RECORD_KEY,
  PROVIDER_PARKS_DOCUMENT_NAME,
  PROVIDER_PARKS_PROJECTION_SCHEMA_ID,
  type StateDocumentReport,
  type StateFailure,
  type StateJsonValue,
  type StateReadEvidence,
  type StateResult,
  type StateStorePort,
} from "#contracts";

const isRecordValue = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stateFailure = (code: StateFailure["code"], path: string): StateResult<never> => ({
  ok: false,
  error: { kind: "state", code, consequence: "not_landed", location: { path } },
});

const parkFromJson = (value: unknown): ProviderParkRecord | undefined => {
  if (!isRecordValue(value)) return undefined;
  if (value.schemaVersion !== PROVIDER_PARK_SCHEMA_ID) return undefined;
  if (typeof value.name !== "string" || typeof value.subjectName !== "string") return undefined;
  if (value.subjectKind !== "provider" && value.subjectKind !== "chain") return undefined;
  if (typeof value.cause !== "string" || !Array.isArray(value.conditions)) return undefined;
  if (value.state !== "active" && value.state !== "cleared") return undefined;
  if (typeof value.createdAtMs !== "number" || typeof value.expiresAtMs !== "number")
    return undefined;
  if (typeof value.createdAt !== "string" || typeof value.expiresAt !== "string") return undefined;
  return value as unknown as ProviderParkRecord;
};

const announcementFromJson = (value: unknown): ProviderAnnouncementRecord | undefined => {
  if (!isRecordValue(value)) return undefined;
  if (value.schemaVersion !== PROVIDER_ANNOUNCEMENT_SCHEMA_ID) return undefined;
  if (typeof value.identity !== "string" || typeof value.code !== "string") return undefined;
  if (
    value.severity !== "info" &&
    value.severity !== "warning"
  )
    return undefined;
  return value as unknown as ProviderAnnouncementRecord;
};

export type ProviderLedgerState = {
  readonly parks: readonly ProviderParkRecord[];
  readonly announcements: readonly ProviderAnnouncementRecord[];
  readonly evidence: StateReadEvidence | undefined;
};

const readKey = (
  store: StateStorePort,
  key: string,
): StateResult<StateJsonValue | undefined> => {
  const read = store.read({ requiredKeys: [key] });
  if (read.ok) return { ok: true, value: read.value.values[key] };
  if (read.error.code === "state.keys.missing") return { ok: true, value: undefined };
  return read;
};

/** Read verified park/announcement truth; an absent or empty ledger is empty. */
export const readProviderLedger = (store: StateStorePort): StateResult<ProviderLedgerState> => {
  const probe = store.read({ requiredKeys: [] });
  if (!probe.ok) return probe;
  if (probe.value.evidence.verifiedEmpty) {
    return { ok: true, value: { parks: [], announcements: [], evidence: probe.value.evidence } };
  }
  const parksValue = readKey(store, PROVIDER_PARK_RECORD_KEY);
  if (!parksValue.ok) return parksValue;
  const announcementsValue = readKey(store, PROVIDER_ANNOUNCEMENT_RECORD_KEY);
  if (!announcementsValue.ok) return announcementsValue;

  const parks: ProviderParkRecord[] = [];
  const parksPayload = parksValue.value;
  if (parksPayload !== undefined) {
    if (!isRecordValue(parksPayload) || !Array.isArray(parksPayload.parks)) {
      return stateFailure("state.store.torn", PROVIDER_PARK_RECORD_KEY);
    }
    for (const entry of parksPayload.parks) {
      const parsed = parkFromJson(entry);
      if (parsed === undefined) return stateFailure("state.store.torn", PROVIDER_PARK_RECORD_KEY);
      parks.push(parsed);
    }
  }
  const announcements: ProviderAnnouncementRecord[] = [];
  const announcementsPayload = announcementsValue.value;
  if (announcementsPayload !== undefined) {
    if (
      !isRecordValue(announcementsPayload) ||
      !Array.isArray(announcementsPayload.announcements)
    ) {
      return stateFailure("state.store.torn", PROVIDER_ANNOUNCEMENT_RECORD_KEY);
    }
    for (const entry of announcementsPayload.announcements) {
      const parsed = announcementFromJson(entry);
      if (parsed === undefined) {
        return stateFailure("state.store.torn", PROVIDER_ANNOUNCEMENT_RECORD_KEY);
      }
      announcements.push(parsed);
    }
  }
  return {
    ok: true,
    value: { parks, announcements, evidence: probe.value.evidence },
  };
};

const parksPayload = (parks: readonly ProviderParkRecord[]): StateJsonValue => ({
  schemaVersion: PROVIDER_PARK_SCHEMA_ID,
  parks: parks as unknown as StateJsonValue,
});

const announcementsPayload = (
  announcements: readonly ProviderAnnouncementRecord[],
): StateJsonValue => ({
  schemaVersion: PROVIDER_ANNOUNCEMENT_SCHEMA_ID,
  announcements: announcements as unknown as StateJsonValue,
});

/** The rebuildable projection content: latest record per park name (DM-12). */
export const providerParksProjection = (
  parks: readonly ProviderParkRecord[],
): StateJsonValue => ({
  schemaVersion: PROVIDER_PARKS_PROJECTION_SCHEMA_ID,
  parks: foldParks(parks) as unknown as StateJsonValue,
});

export type PersistResolutionInput = {
  readonly store: StateStorePort;
  readonly fenceToken: string;
  readonly nowMs: number;
  readonly parks: readonly ProviderParkRecord[];
  readonly announcements: readonly ProviderAnnouncementRecord[];
};

export type PersistResolutionOutcome = {
  readonly parks: readonly ProviderParkRecord[];
  readonly announcements: readonly ProviderAnnouncementRecord[];
  readonly appendedParks: boolean;
  readonly appendedAnnouncements: boolean;
  readonly newParks: readonly ProviderParkRecord[];
  readonly newAnnouncements: readonly ProviderAnnouncementRecord[];
  readonly document: StateDocumentReport | undefined;
};

const latestByName = (
  parks: readonly ProviderParkRecord[],
): ReadonlyMap<string, ProviderParkRecord> => {
  const latest = new Map<string, ProviderParkRecord>();
  for (const park of parks) latest.set(park.name, park);
  return latest;
};

/**
 * Persist one mutating resolve: dedupe unchanged generations, append a
 * `cleared` record and a `provider.resumed` announcement for observed clears,
 * then replace the `provider-parks.json` projection only when truth changed.
 */
export const persistProviderResolution = (
  input: PersistResolutionInput,
): StateResult<PersistResolutionOutcome> => {
  const acquired = input.store.acquireFence(input.fenceToken);
  if (!acquired.ok) return acquired;
  const handle = acquired.value.handle;
  const release = (): void => {
    input.store.releaseFence(handle);
  };
  const previous = readProviderLedger(input.store);
  if (!previous.ok) {
    release();
    return previous;
  }
  const previousLatest = latestByName(previous.value.parks);
  const currentLatest = latestByName(input.parks);
  const appendedParks: ProviderParkRecord[] = [...previous.value.parks];
  const appendedAnnouncements: ProviderAnnouncementRecord[] = [
    ...previous.value.announcements,
  ];
  let parksChanged = false;
  let announcementsChanged = false;
  const newParks: ProviderParkRecord[] = [];
  const newAnnouncements: ProviderAnnouncementRecord[] = [];

  const knownAnnouncements = new Set(
    previous.value.announcements.map((announcement) => announcement.identity),
  );
  const addAnnouncement = (announcement: ProviderAnnouncementRecord): void => {
    if (knownAnnouncements.has(announcement.identity)) return;
    knownAnnouncements.add(announcement.identity);
    appendedAnnouncements.push(announcement);
    newAnnouncements.push(announcement);
    announcementsChanged = true;
  };

  for (const park of input.parks) {
    const prior = previousLatest.get(park.name);
    if (
      prior !== undefined &&
      prior.state === "active" &&
      parkGeneration(prior) === parkGeneration(park)
    ) {
      continue;
    }
    appendedParks.push(park);
    newParks.push(park);
    parksChanged = true;
  }

  for (const [name, prior] of previousLatest) {
    if (prior.state !== "active") continue;
    const current = currentLatest.get(name);
    if (current !== undefined && parkGeneration(current) === parkGeneration(prior)) continue;
    if (current !== undefined) continue;
    const cleared = clearParkRecord(prior, input.nowMs);
    appendedParks.push(cleared);
    newParks.push(cleared);
    parksChanged = true;
    addAnnouncement(
      createAnnouncementRecord({
        subjectKind: prior.subjectKind,
        subjectName: prior.subjectName,
        code: "provider.resumed",
        severity: "info",
        createdAtMs: input.nowMs,
        message: `${prior.subjectKind} ${prior.subjectName} resumed`,
        cause: prior.cause,
        conditions: prior.conditions,
        generation: parkGeneration(prior),
        evidence: { announcementCode: "provider.resumed" },
      }),
    );
  }

  for (const announcement of input.announcements) addAnnouncement(announcement);

  if (parksChanged) {
    const appended = input.store.append(handle, {
      kind: "provider.park",
      recordKey: PROVIDER_PARK_RECORD_KEY,
      payload: parksPayload(appendedParks),
    });
    if (!appended.ok) {
      release();
      return appended;
    }
  }
  if (announcementsChanged) {
    const appended = input.store.append(handle, {
      kind: "provider.announcement",
      recordKey: PROVIDER_ANNOUNCEMENT_RECORD_KEY,
      payload: announcementsPayload(appendedAnnouncements),
    });
    if (!appended.ok) {
      release();
      return appended;
    }
  }
  let document: StateDocumentReport | undefined;
  if (parksChanged) {
    const replaced = input.store.replaceDocument(handle, {
      name: PROVIDER_PARKS_DOCUMENT_NAME,
      content: providerParksProjection(appendedParks),
    });
    if (!replaced.ok) {
      release();
      return replaced;
    }
    document = replaced.value;
  }
  release();
  return {
    ok: true,
    value: {
      parks: appendedParks,
      announcements: appendedAnnouncements,
      appendedParks: parksChanged,
      appendedAnnouncements: announcementsChanged,
      newParks,
      newAnnouncements,
      document,
    },
  };
};

/** Read-only park views from verified ledger truth; never writes (PD-A). */
export const readProviderParkViews = (
  store: StateStorePort,
  nowMs: number,
  options: { readonly all?: boolean; readonly providerName?: string } = {},
): StateResult<readonly ProviderParkView[]> => {
  const ledger = readProviderLedger(store);
  if (!ledger.ok) return ledger;
  const views = foldParks(ledger.value.parks)
    .map((park) => parkView(park, nowMs))
    .filter((view) => {
      if (options.providerName !== undefined && view.subjectName !== options.providerName) {
        return false;
      }
      return options.all === true ? true : view.state === "active";
    });
  return { ok: true, value: views };
};
