/**
 * The pure steering domain (GH-298 F-1..F-10, DM-1..DM-6, DM-8).
 *
 * No I/O, clock, randomness, or ambient environment: every variable fact
 * (including `nowMs`/`nowIso`, secrets, the delivered phase fold, and the
 * delivered asks view) arrives through arguments. The exports are the shared
 * record and request validators, the one ttl parser and predicate, measured
 * aging, the shared derived rank, the boundary-open derivation over the
 * delivered phase fold, derived lifecycle, the send/list/read/complete
 * projections, the asks-batch composition, the registered-value guard, and the
 * bounded human renderers. All helpers stay internal.
 */
import {
  type BrandIdentity,
  STEER_DEFAULT_TTL,
  STEER_EXPIRY_REASON,
  STEER_FILING_KINDS,
  STEER_KINDS,
  STEER_MAX_ASKS,
  STEER_MAX_HUMAN_BYTES,
  STEER_MAX_HUMAN_LINES,
  STEER_MAX_LIST_ROWS_PER_GROUP,
  STEER_MAX_MACHINE_BYTES,
  STEER_MAX_READ_PAYLOAD_NOTES,
  STEER_MAX_REF_CHARS,
  STEER_MAX_TEXT_CHARS,
  STEER_MAX_TTL_MS,
  STEER_PHASE_IN_PROGRESS_REASON,
  STEER_PRIORITIES,
  STEER_PRIORITY_CLASS_BY_PRIORITY,
  STEER_RECORD_FIELDS,
  STEER_SCHEMA_VERSION,
  STEER_SCOPES,
  STEER_TTL_UNIT_MS,
  type SteerAskFact,
  type SteerAskRow,
  type SteerAskSource,
  type SteerBoundaryBlock,
  type SteerCompleteData,
  type SteerCompleteInput,
  type SteerCompletionRecord,
  type SteerExpiredOutcomeRecord,
  type SteerKind,
  type SteerLifecycle,
  type SteerListData,
  type SteerListRow,
  type SteerMessageRecord,
  type SteerOrigin,
  type SteerOutcome,
  type SteerOutcomeRecord,
  type SteerPhaseFoldView,
  type SteerPriority,
  type SteerReadData,
  type SteerReadNote,
  type SteerReadPlan,
  type SteerReceipt,
  type SteerRecordProjection,
  type SteerRecordSet,
  type SteerScope,
  type SteerSendData,
  type SteerSendInput,
  type SteerTtlUnit,
} from "#contracts";

const compareText = (left: string, right: string): number => {
  const a = Array.from(left);
  const b = Array.from(right);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const leftPoint = a[index]?.codePointAt(0) ?? 0;
    const rightPoint = b[index]?.codePointAt(0) ?? 0;
    if (leftPoint !== rightPoint) return leftPoint < rightPoint ? -1 : 1;
  }
  return a.length === b.length ? 0 : a.length < b.length ? -1 : 1;
};

const utf8ByteLength = (value: string): number => {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (point <= 0x7f) bytes += 1;
    else if (point <= 0x7ff) bytes += 2;
    else if (point <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
};

const charLength = (value: string): number => Array.from(value).length;

const clampChars = (value: string, maximum: number): string => {
  const points = Array.from(value);
  if (points.length <= maximum) return value;
  return `${points.slice(0, maximum - 1).join("")}+`;
};

const parseInstant = (value: string): number | undefined => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isFilingKind = (value: string): value is (typeof STEER_FILING_KINDS)[number] =>
  (STEER_FILING_KINDS as readonly string[]).includes(value);

const isSteerKind = (value: string): value is SteerKind =>
  (STEER_KINDS as readonly string[]).includes(value);

const isSteerScope = (value: string): value is SteerScope =>
  (STEER_SCOPES as readonly string[]).includes(value);

const isSteerPriority = (value: string): value is SteerPriority =>
  (STEER_PRIORITIES as readonly string[]).includes(value);

/* ------------------------------- validation ------------------------------- */

/** The one refusal identity every S5 value violation reuses (F-9, DM-7). */
export type SteerValidationCode = "input.value.rejected";

export type SteerValidationFailure = {
  readonly ok: false;
  readonly code: SteerValidationCode;
  readonly field: string;
  readonly summary: string;
};

const rejected = (field: string, summary: string): SteerValidationFailure => ({
  ok: false,
  code: "input.value.rejected",
  field,
  summary,
});

export type SteerSendValidated = {
  readonly text: string;
  readonly kind: (typeof STEER_FILING_KINDS)[number];
  readonly priority: SteerPriority;
  readonly ttl: number;
  readonly ref: string | null;
};

export type SteerSendValidation =
  | { readonly ok: true; readonly value: SteerSendValidated }
  | SteerValidationFailure;

export type SteerTtlParse =
  | { readonly ok: true; readonly ms: number; readonly unit: SteerTtlUnit }
  | { readonly ok: false; readonly reason: "malformed" | "too-large"; readonly raw: string };

const TTL_GRAMMAR = /^([1-9][0-9]*)([smhd])$/u;

/** The declared message-id form: `msg-` plus a non-empty opaque suffix (DM-1). */
export const formatSteerMessageId = (suffix: string): string => `msg-${suffix}`;

/**
 * Parse the one declared ttl grammar: `<positive-integer><unit>` with unit in
 * `s | m | h | d` (spec section 8.3). Zero, negative, malformed, and oversized
 * values are refused with no coercion to a neighbouring duration.
 */
export const parseSteerTtl = (raw: string): SteerTtlParse => {
  const match = TTL_GRAMMAR.exec(raw);
  if (match === null) return { ok: false, reason: "malformed", raw };
  const amount = Number(match[1]);
  const unit = match[2] as SteerTtlUnit;
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { ok: false, reason: "malformed", raw };
  }
  const ms = amount * STEER_TTL_UNIT_MS[unit];
  if (!Number.isFinite(ms) || ms > STEER_MAX_TTL_MS) {
    return { ok: false, reason: "too-large", raw };
  }
  return { ok: true, ms, unit };
};

/** The derived absolute expiry instant of a stored record (DM-1). */
export const steerExpiresAt = (created: string, ttlMs: number): string => {
  const createdMs = parseInstant(created);
  if (createdMs === undefined) return new Date(0).toISOString();
  return new Date(createdMs + ttlMs).toISOString();
};

/** The inclusive ttl judgement: `now >= created + ttl` on the injected clock (DM-5). */
export const steerTtlElapsed = (nowMs: number, created: string, ttlMs: number): boolean => {
  const createdMs = parseInstant(created);
  if (createdMs === undefined) return true;
  return nowMs >= createdMs + ttlMs;
};

/** Measured age in whole milliseconds, never stored and never negative (DM-5). */
export const steerAgeMs = (nowMs: number, created: string): number => {
  const createdMs = parseInstant(created);
  if (createdMs === undefined) return 0;
  return Math.max(0, Math.trunc(nowMs - createdMs));
};

const validateRefValue = (
  value: string | null | undefined,
): string | null | SteerValidationFailure => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return rejected("ref", "ref must be a string or null");
  if (value.length === 0 || value.trim().length === 0) {
    return rejected("ref", "ref must be a non-empty artifact reference");
  }
  if (charLength(value) > STEER_MAX_REF_CHARS) {
    return rejected("ref", `ref exceeds ${STEER_MAX_REF_CHARS} characters`);
  }
  return value;
};

/**
 * Validate a filing request in the fixed order: text, kind, priority, ttl, ref.
 *
 * The filing path applies the declared S5 subset as a restriction over the
 * shared vocabulary; a shared member outside the subset (for example `notify`)
 * is refused here, never widened into the filing path.
 */
export const validateSteerSend = (input: SteerSendInput): SteerSendValidation => {
  if (typeof input.text !== "string" || input.text.trim().length === 0) {
    return rejected("text", "note text must be non-empty");
  }
  if (charLength(input.text) > STEER_MAX_TEXT_CHARS) {
    return rejected("text", `note text exceeds ${STEER_MAX_TEXT_CHARS} characters`);
  }
  const kind = input.kind ?? "request";
  if (!isFilingKind(kind)) {
    return rejected(
      "kind",
      `kind must be one of ${STEER_FILING_KINDS.join(", ")} on the filing path`,
    );
  }
  const priority = input.priority ?? "normal";
  if (!isSteerPriority(priority)) {
    return rejected("priority", `priority must be one of ${STEER_PRIORITIES.join(", ")}`);
  }
  const ttlRaw = input.ttl ?? STEER_DEFAULT_TTL;
  const ttl = parseSteerTtl(ttlRaw);
  if (!ttl.ok) {
    return rejected(
      "ttl",
      ttl.reason === "too-large"
        ? `ttl exceeds the declared maximum of 30d (${STEER_MAX_TTL_MS} ms)`
        : `ttl must match <positive-integer><unit> with unit s|m|h|d`,
    );
  }
  const ref = validateRefValue(input.ref);
  if (ref !== null && typeof ref !== "string") return ref;
  return {
    ok: true,
    value: { text: input.text, kind, priority, ttl: ttl.ms, ref },
  };
};

export type SteerCompletionValidated = { readonly artifact: string };

export type SteerCompletionValidation =
  | { readonly ok: true; readonly value: SteerCompletionValidated }
  | SteerValidationFailure;

/**
 * Validate a completion request against the note's derived lifecycle.
 *
 * Completion is landed-only, requires a proving artifact, and the first
 * completion is authoritative: a queued or expired note has no read receipt and
 * a completed note is already final (F-6, AC-F6-1, AC-F6-2).
 */
export const validateSteerCompletion = (
  input: SteerCompleteInput,
  lifecycle: SteerLifecycle,
): SteerCompletionValidation => {
  if (lifecycle === "queued") {
    return rejected("id", "the note has no read receipt; a queued note cannot complete");
  }
  if (lifecycle === "expired") {
    return rejected("id", "the note expired without landing; an expired note cannot complete");
  }
  if (lifecycle === "completed") {
    return rejected("id", "the note already has an authoritative completion");
  }
  if (input.ref === undefined || input.ref.length === 0 || input.ref.trim().length === 0) {
    return rejected("ref", "completion requires the proving artifact via --ref");
  }
  if (charLength(input.ref) > STEER_MAX_REF_CHARS) {
    return rejected("ref", `ref exceeds ${STEER_MAX_REF_CHARS} characters`);
  }
  return { ok: true, value: { artifact: input.ref } };
};

/* --------------------------- shared record validator ---------------------- */

export type SteerMessageValidation =
  | { readonly ok: true; readonly value: SteerMessageRecord }
  | SteerValidationFailure;

const RECORD_FIELD_NAMES: readonly string[] = STEER_RECORD_FIELDS.map((field) => field.name);

const originFrom = (
  value: unknown,
): { readonly ok: true; readonly value: SteerOrigin } | SteerValidationFailure => {
  if (!isRecord(value)) return rejected("origin", "origin must be an object");
  const keys = Object.keys(value);
  for (const key of keys) {
    if (key !== "change" && key !== "repo" && key !== "agent") {
      return rejected("origin", `origin carries the undeclared field "${key}"`);
    }
  }
  if (value.change !== null && !isNonEmptyString(value.change)) {
    return rejected("origin.change", "origin.change must be a non-empty string or null");
  }
  if (!isNonEmptyString(value.repo)) {
    return rejected("origin.repo", "origin.repo must be a non-empty string");
  }
  if (!isNonEmptyString(value.agent)) {
    return rejected("origin.agent", "origin.agent must be a non-empty string");
  }
  return {
    ok: true,
    value: {
      change: value.change === null ? null : value.change,
      repo: value.repo,
      agent: value.agent,
    },
  };
};

/**
 * Validate any message against the one shared schema (DM-1, AC-F2-1).
 *
 * The key set is closed at the eleven declared fields, every vocabulary member
 * is one of the shared closed sets, and no owner-specific branch exists — a
 * non-owner-issued message validates identically.
 */
export const validateSteerMessage = (value: unknown): SteerMessageValidation => {
  if (!isRecord(value)) return rejected("record", "a steering record must be an object");
  for (const key of Object.keys(value)) {
    if (!RECORD_FIELD_NAMES.includes(key)) {
      return rejected(key, `the shared record declares no field "${key}"`);
    }
  }
  for (const field of RECORD_FIELD_NAMES) {
    if (!Object.hasOwn(value, field)) {
      return rejected(field, `the shared record is missing "${field}"`);
    }
  }
  if (!isNonEmptyString(value.id)) return rejected("id", "id must be a non-empty string");
  if (!isNonEmptyString(value.from)) return rejected("from", "from must be a non-empty principal");
  if (!isNonEmptyString(value.to)) return rejected("to", "to must be a non-empty target");
  if (typeof value.scope !== "string" || !isSteerScope(value.scope)) {
    return rejected("scope", `scope must be one of ${STEER_SCOPES.join(", ")}`);
  }
  if (typeof value.kind !== "string" || !isSteerKind(value.kind)) {
    return rejected("kind", `kind must be one of ${STEER_KINDS.join(", ")}`);
  }
  if (!isNonEmptyString(value.subject)) {
    return rejected("subject", "subject must be non-empty");
  }
  if (charLength(value.subject) > STEER_MAX_TEXT_CHARS) {
    return rejected("subject", `subject exceeds ${STEER_MAX_TEXT_CHARS} characters`);
  }
  const rawRef = value.ref;
  if (rawRef !== null && typeof rawRef !== "string") {
    return rejected("ref", "ref must be a string or null");
  }
  if (typeof rawRef === "string" && charLength(rawRef) > STEER_MAX_REF_CHARS) {
    return rejected("ref", `ref exceeds ${STEER_MAX_REF_CHARS} characters`);
  }
  const ref: string | null = typeof rawRef === "string" ? rawRef : null;
  const origin = originFrom(value.origin);
  if (!origin.ok) return origin;
  if (typeof value.priority !== "string" || !isSteerPriority(value.priority)) {
    return rejected("priority", `priority must be one of ${STEER_PRIORITIES.join(", ")}`);
  }
  if (!isNonEmptyString(value.created) || parseInstant(value.created) === undefined) {
    return rejected("created", "created must be a parseable instant");
  }
  if (
    typeof value.ttl !== "number" ||
    !Number.isSafeInteger(value.ttl) ||
    value.ttl <= 0 ||
    value.ttl > STEER_MAX_TTL_MS
  ) {
    return rejected("ttl", `ttl must be a positive integer no greater than ${STEER_MAX_TTL_MS} ms`);
  }
  return {
    ok: true,
    value: {
      id: value.id,
      from: value.from,
      to: value.to,
      scope: value.scope,
      kind: value.kind,
      subject: value.subject,
      ref,
      origin: origin.value,
      priority: value.priority,
      created: value.created,
      ttl: value.ttl,
    },
  };
};

/* -------------------------------- guard ----------------------------------- */

export type SteerGuardRequest = {
  readonly subject?: string;
  readonly ref?: string | null;
  readonly origin?: SteerOrigin;
  readonly secrets: readonly string[];
};

export type SteerGuardVerdict =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: "steer.credential-value-rejected";
      readonly field: string;
      readonly summary: string;
    };

const containsRegisteredSecret = (text: string, secrets: readonly string[]): boolean => {
  for (const secret of secrets) {
    if (secret.length === 0) continue;
    if (text.includes(secret)) return true;
  }
  return false;
};

/**
 * The registered-value guard over every content and identifier path (F-7).
 *
 * Exactly the registered-value match exists, with no token-shape pattern scan
 * (TDR-0012): an unregistered value of any shape passes.
 */
export const evaluateSteerGuard = (request: SteerGuardRequest): SteerGuardVerdict => {
  const paths: readonly { readonly field: string; readonly value: string | null | undefined }[] = [
    { field: "subject", value: request.subject },
    { field: "ref", value: request.ref },
    { field: "origin.change", value: request.origin?.change },
    { field: "origin.repo", value: request.origin?.repo },
    { field: "origin.agent", value: request.origin?.agent },
  ];
  for (const path of paths) {
    if (path.value === undefined || path.value === null) continue;
    if (containsRegisteredSecret(path.value, request.secrets)) {
      return {
        ok: false,
        code: "steer.credential-value-rejected",
        field: path.field,
        summary: `the ${path.field} contains a registered credential value; supply content without registered secrets`,
      };
    }
  }
  return { ok: true };
};

/* ----------------------------- rank and lifecycle -------------------------- */

export type SteerDerivedNote = {
  readonly record: SteerMessageRecord;
  readonly rank: number;
  readonly age: number;
  readonly expiresAt: string;
  readonly lifecycle: SteerLifecycle;
  readonly outcome?: SteerOutcome;
  readonly completion?: SteerCompletionRecord;
};

const createdMs = (record: SteerMessageRecord): number =>
  parseInstant(record.created) ?? Number.POSITIVE_INFINITY;

const classOf = (record: SteerMessageRecord): number =>
  STEER_PRIORITY_CLASS_BY_PRIORITY[record.priority];

/**
 * The one shared derived rank: priority class, then oldest created, then id.
 *
 * Ranks are contiguous `1..N` over the fully ranked set, assigned before any
 * render cap (DM-5, DEC-11).
 */
export const rankSteerMessages = (
  messages: readonly SteerMessageRecord[],
): readonly { readonly record: SteerMessageRecord; readonly rank: number }[] => {
  const sorted = [...messages].sort((left, right) => {
    const byClass = classOf(left) - classOf(right);
    if (byClass !== 0) return byClass;
    const leftCreated = createdMs(left);
    const rightCreated = createdMs(right);
    if (leftCreated !== rightCreated) return leftCreated < rightCreated ? -1 : 1;
    return compareText(left.id, right.id);
  });
  return sorted.map((record, index) => ({ record, rank: index + 1 }));
};

/** Derive the lifecycle from appended records; never a stored flag (DM-2). */
export const deriveSteerLifecycle = (
  id: string,
  outcomes: readonly SteerOutcome[],
  completions: readonly SteerCompletionRecord[],
): SteerLifecycle => {
  const outcome = outcomes.find((candidate) => candidate.id === id);
  if (outcome === undefined) return "queued";
  if (outcome.outcome === "expired") return "expired";
  const completion = completions.find((candidate) => candidate.id === id);
  return completion === undefined ? "landed" : "completed";
};

const derivedNotes = (records: SteerRecordSet, nowMs: number): readonly SteerDerivedNote[] =>
  rankSteerMessages(records.messages).map(({ record, rank }) => {
    const outcome = records.outcomes.find((candidate) => candidate.id === record.id);
    const completion = records.completions.find((candidate) => candidate.id === record.id);
    const lifecycle: SteerLifecycle =
      outcome === undefined
        ? "queued"
        : outcome.outcome === "expired"
          ? "expired"
          : completion === undefined
            ? "landed"
            : "completed";
    return {
      record,
      rank,
      age: steerAgeMs(nowMs, record.created),
      expiresAt: steerExpiresAt(record.created, record.ttl),
      lifecycle,
      ...(outcome === undefined ? {} : { outcome }),
      ...(completion === undefined ? {} : { completion }),
    };
  });

/* ------------------------------- boundary --------------------------------- */

/**
 * Derive the boundary-open condition from the delivered phase fold (DEC-5).
 *
 * No lifecycle entry (or no record) is open with `phase: null` and the
 * `phase-unrecorded` reason; every entry completed is open at the latest
 * completed entry; an entry in progress is closed at that entry.
 */
export const deriveSteerBoundary = (fold: SteerPhaseFoldView): SteerBoundaryBlock => {
  if (!fold.present || fold.entries.length === 0) {
    return { open: true, phase: null, phaseUnknownReason: "phase-unrecorded" };
  }
  const inProgress = fold.entries.find((entry) => entry.completed === null);
  if (inProgress !== undefined) return { open: false, phase: inProgress.phaseId };
  const completed = [...fold.entries]
    .filter((entry) => entry.completed !== null)
    .sort((left, right) => {
      const leftAt = parseInstant(left.completed ?? "") ?? Number.NEGATIVE_INFINITY;
      const rightAt = parseInstant(right.completed ?? "") ?? Number.NEGATIVE_INFINITY;
      if (leftAt !== rightAt) return rightAt - leftAt;
      return compareText(left.phaseId, right.phaseId);
    });
  const latest = completed[0];
  return latest === undefined
    ? { open: true, phase: null, phaseUnknownReason: "phase-unrecorded" }
    : { open: true, phase: latest.phaseId };
};

const boundaryLabel = (boundary: SteerBoundaryBlock): string =>
  boundary.phase ?? "phase-unrecorded";

/* ------------------------------- projections ------------------------------ */

const receiptFor = (
  record: SteerMessageRecord,
  at: string,
  boundary: SteerBoundaryBlock,
): SteerReceipt => ({
  origin: record.origin,
  readReceipt: { at, boundary: boundaryLabel(boundary) },
  ttl: record.ttl,
  expiresAt: steerExpiresAt(record.created, record.ttl),
});

export type SteerReadPlanInput = {
  readonly records: SteerRecordSet;
  readonly phase: SteerPhaseFoldView;
  readonly nowMs: number;
  readonly nowIso: string;
};

/**
 * Plan the read point over the folded history (F-3, DM-2, DM-3, AC-F3-1..5).
 *
 * A boundary-open read transitions every unresolved due note in one batch (one
 * outcome per note) and classifies elapsed notes as `ttl-elapsed`; a
 * boundary-closed read transitions nothing and renders every unresolved note
 * with the declared pending reason.
 */
export const planSteerRead = (input: SteerReadPlanInput): SteerReadPlan => {
  const boundary = deriveSteerBoundary(input.phase);
  const notes = derivedNotes(input.records, input.nowMs);
  const transitions: SteerOutcome[] = [];
  const rows: SteerReadNote[] = [];
  for (const note of notes) {
    // AC-F3-5: the read returns the notes it considered — the transitions it
    // performed — not a replay of already-resolved history. Pre-resolved notes
    // stay visible on the list view.
    if (note.outcome !== undefined) continue;
    if (!boundary.open) {
      rows.push({
        id: note.record.id,
        kind: note.record.kind,
        priority: note.record.priority,
        subject: note.record.subject,
        ref: note.record.ref,
        origin: note.record.origin,
        created: note.record.created,
        ttl: note.record.ttl,
        expiresAt: note.expiresAt,
        age: note.age,
        rank: note.rank,
        lifecycle: "queued",
        applied: false,
        pendingReason: STEER_PHASE_IN_PROGRESS_REASON,
      });
      continue;
    }
    if (steerTtlElapsed(input.nowMs, note.record.created, note.record.ttl)) {
      const record: SteerExpiredOutcomeRecord = {
        schemaId: "delivery.steering.outcome.v1",
        id: note.record.id,
        outcome: "expired",
        recordedAt: input.nowIso,
        reason: STEER_EXPIRY_REASON,
      };
      transitions.push(record);
      rows.push({
        id: note.record.id,
        kind: note.record.kind,
        priority: note.record.priority,
        subject: note.record.subject,
        ref: note.record.ref,
        origin: note.record.origin,
        created: note.record.created,
        ttl: note.record.ttl,
        expiresAt: note.expiresAt,
        age: note.age,
        rank: note.rank,
        lifecycle: "expired",
        applied: false,
        expiry: { reason: STEER_EXPIRY_REASON, recordedAt: input.nowIso },
      });
      continue;
    }
    const record: SteerOutcomeRecord = {
      schemaId: "delivery.steering.outcome.v1",
      id: note.record.id,
      outcome: "applied",
      recordedAt: input.nowIso,
      receipt: receiptFor(note.record, input.nowIso, boundary),
    };
    transitions.push(record);
    rows.push({
      id: note.record.id,
      kind: note.record.kind,
      priority: note.record.priority,
      subject: note.record.subject,
      ref: note.record.ref,
      origin: note.record.origin,
      created: note.record.created,
      ttl: note.record.ttl,
      expiresAt: note.expiresAt,
      age: note.age,
      rank: note.rank,
      lifecycle: "landed",
      applied: true,
      receipt: record.receipt,
    });
  }
  return {
    boundary,
    applied: transitions.some((transition) => transition.outcome === "applied"),
    transitions,
    rows,
  };
};

const dataBytes = (data: unknown): number => utf8ByteLength(JSON.stringify(data));

/**
 * Build the bounded read payload: list at most the declared 20 notes in shared
 * rank order, then apply the 65 536-byte guard dropping asks first and notes
 * tail-first by rank, counting every drop (DM-8, AC-F3-4, AC-F10-3).
 *
 * The landing write happened before this function; this display bound never
 * changes the transitions.
 */
export const buildSteerReadData = (
  plan: SteerReadPlan,
  askSource: SteerAskSource,
): SteerReadData => {
  const asks = composeSteerAsks(askSource);
  const listed = plan.rows.slice(0, STEER_MAX_READ_PAYLOAD_NOTES);
  let notes = listed;
  let renderedAsks = asks;
  const ownerAskCount = askSource.facts.filter((fact) => fact.audience === "owner").length;
  let omitted = plan.rows.length - listed.length + Math.max(0, ownerAskCount - asks.length);
  let expired = plan.transitions.some((transition) => transition.outcome === "expired");
  let data: SteerReadData = {
    schemaVersion: STEER_SCHEMA_VERSION,
    boundary: plan.boundary,
    applied: plan.applied,
    ...(expired ? { expiry: { reason: STEER_EXPIRY_REASON } } : {}),
    notes,
    asks: renderedAsks,
    omitted,
    truncated: omitted > 0,
  };
  while (dataBytes(data) > STEER_MAX_MACHINE_BYTES) {
    if (renderedAsks.length > 0) {
      renderedAsks = renderedAsks.slice(0, renderedAsks.length - 1);
    } else if (notes.length > 0) {
      notes = notes.slice(0, notes.length - 1);
    } else {
      break;
    }
    omitted += 1;
    expired = plan.transitions.some((transition) => transition.outcome === "expired");
    data = {
      schemaVersion: STEER_SCHEMA_VERSION,
      boundary: plan.boundary,
      applied: plan.applied,
      ...(expired ? { expiry: { reason: STEER_EXPIRY_REASON } } : {}),
      notes,
      asks: renderedAsks,
      omitted,
      truncated: true,
    };
  }
  return data;
};

/**
 * Compose the asks batch from the delivered open-question view (DM-6).
 *
 * Owner-audience rows only, the delivered rank preserved verbatim, the
 * delivered cap of 8, and the PDR-0003 join values read from the injected
 * facts — no second ranking and no second default source.
 */
export const composeSteerAsks = (source: SteerAskSource): readonly SteerAskRow[] => {
  const owner = source.facts.filter((fact) => fact.audience === "owner");
  return owner.slice(0, STEER_MAX_ASKS).map((fact: SteerAskFact) => {
    const drawn = fact.ref === null ? undefined : source.join.defaultableRefs[fact.ref];
    const drawnDefault = drawn ?? null;
    const defaultState =
      drawnDefault === null
        ? "none"
        : fact.ref !== null && source.join.appliedRefs.includes(fact.ref)
          ? "applied"
          : "pending";
    return {
      id: fact.id,
      type: fact.type,
      ref: fact.ref,
      lane: fact.lane,
      question: fact.question,
      askedAt: fact.askedAt,
      age: fact.age,
      drawnDefault,
      defaultState,
      rank: fact.rank,
    };
  });
};

/** Build the `steer send` payload from the appended record (spec section 8.3). */
export const buildSteerSendData = (record: SteerMessageRecord, nowMs: number): SteerSendData => ({
  schemaVersion: STEER_SCHEMA_VERSION,
  record: {
    ...record,
    expiresAt: steerExpiresAt(record.created, record.ttl),
    age: steerAgeMs(nowMs, record.created),
  } satisfies SteerRecordProjection,
  lifecycle: "queued",
});

/** Build the `steer complete` payload from the appended record (section 8.3). */
export const buildSteerCompleteData = (record: SteerCompletionRecord): SteerCompleteData => ({
  schemaVersion: STEER_SCHEMA_VERSION,
  record: {
    id: record.id,
    lifecycle: "completed",
    completedAt: record.completedAt,
    artifact: record.artifact,
  },
});

const listRow = (note: SteerDerivedNote): SteerListRow => {
  const base = {
    id: note.record.id,
    from: note.record.from,
    to: note.record.to,
    scope: note.record.scope,
    kind: note.record.kind,
    subject: note.record.subject,
    ref: note.record.ref,
    origin: note.record.origin,
    priority: note.record.priority,
    created: note.record.created,
    ttl: note.record.ttl,
    expiresAt: note.expiresAt,
    age: note.age,
    rank: note.rank,
  } as const;
  if (note.outcome === undefined) {
    return { ...base, lifecycle: "queued" };
  }
  if (note.outcome.outcome === "expired") {
    return {
      ...base,
      lifecycle: "expired",
      expiry: { reason: STEER_EXPIRY_REASON, recordedAt: note.outcome.recordedAt },
    };
  }
  return {
    ...base,
    lifecycle: note.completion === undefined ? "landed" : "completed",
    receipt: note.outcome.receipt,
    completedWith: note.completion === undefined ? null : note.completion.artifact,
  };
};

/**
 * Build the three-group queue view, each group capped at 8 rows with every
 * omission counted, then the 65 536-byte guard dropping expired, landed, then
 * queued rows tail-first (DM-4, DM-8).
 */
export const buildSteerListData = (records: SteerRecordSet, nowMs: number): SteerListData => {
  const notes = derivedNotes(records, nowMs);
  const queuedAll = notes.filter((note) => note.lifecycle === "queued").map(listRow);
  const landedAll = notes
    .filter((note) => note.lifecycle === "landed" || note.lifecycle === "completed")
    .map(listRow);
  const expiredAll = notes.filter((note) => note.lifecycle === "expired").map(listRow);
  let queued = queuedAll.slice(0, STEER_MAX_LIST_ROWS_PER_GROUP);
  let landed = landedAll.slice(0, STEER_MAX_LIST_ROWS_PER_GROUP);
  let expired = expiredAll.slice(0, STEER_MAX_LIST_ROWS_PER_GROUP);
  let omitted =
    queuedAll.length -
    queued.length +
    (landedAll.length - landed.length) +
    (expiredAll.length - expired.length);
  let data: SteerListData = {
    schemaVersion: STEER_SCHEMA_VERSION,
    queued,
    landed,
    expired,
    omitted,
    truncated: omitted > 0,
  };
  while (dataBytes(data) > STEER_MAX_MACHINE_BYTES) {
    if (expired.length > 0) expired = expired.slice(0, expired.length - 1);
    else if (landed.length > 0) landed = landed.slice(0, landed.length - 1);
    else if (queued.length > 0) queued = queued.slice(0, queued.length - 1);
    else break;
    omitted += 1;
    data = {
      schemaVersion: STEER_SCHEMA_VERSION,
      queued,
      landed,
      expired,
      omitted,
      truncated: true,
    };
  }
  return data;
};

/* -------------------------------- rendering ------------------------------- */

const ageLabel = (age: number): string => {
  if (age < 60_000) return `${String(age)}ms`;
  if (age < 3_600_000) return `${String(Math.floor(age / 60_000))}m`;
  if (age < 86_400_000) return `${String(Math.floor(age / 3_600_000))}h`;
  return `${String(Math.floor(age / 86_400_000))}d`;
};

const subjectLabel = (subject: string): string => `"${clampChars(subject, STEER_MAX_TEXT_CHARS)}"`;

const receiptLabel = (receipt: SteerReceipt | undefined): string => {
  if (receipt === undefined) return "receipt=-";
  const at = `${receipt.readReceipt.at}/${receipt.readReceipt.boundary}`;
  return `receipt=${at} ttl=${String(receipt.ttl)}ms`;
};

const boundGenericLines = (lines: readonly string[], omitted: number, marker: string): string => {
  const kept = [...lines];
  let dropped = 0;
  const compose = (): string => {
    const body = [...kept];
    const total = omitted + dropped;
    if (total > 0) body.push(marker.replace("{n}", String(total)));
    return `${body.join("\n")}\n`;
  };
  while (
    kept.length > 1 &&
    (kept.length + (omitted + dropped > 0 ? 1 : 0) > STEER_MAX_HUMAN_LINES ||
      utf8ByteLength(compose()) > STEER_MAX_HUMAN_BYTES)
  ) {
    kept.pop();
    dropped += 1;
  }
  return compose();
};

/** Render the `steer send` human line. */
export const renderSteerSendHuman = (data: SteerSendData, brand: BrandIdentity): string => {
  const record = data.record;
  const origin = record.origin.change === null ? "-" : clampChars(record.origin.change, 40);
  return `${clampChars(brand.binaryName, 128)} steer queued ${record.id}  kind=${record.kind}  priority=${record.priority}  ttl=${String(record.ttl)}ms  origin=${origin}@${clampChars(record.origin.repo, 80)}  age=${ageLabel(record.age)}\n`;
};

/** Render the `steer list` queue view with the three declared groups. */
export const renderSteerListHuman = (data: SteerListData, brand: BrandIdentity): string => {
  const lines: string[] = [
    `${clampChars(brand.binaryName, 128)} steer list  queued=${String(data.queued.length)}  landed=${String(data.landed.length)}  expired=${String(data.expired.length)}`,
  ];
  const queuedLines = data.queued.map(
    (row) =>
      `  ${String(row.rank)}. ${row.id}  ${row.kind}  priority=${row.priority}  age=${ageLabel(row.age)}  ${subjectLabel(row.subject)}`,
  );
  if (queuedLines.length > 0) lines.push("queued", ...queuedLines);
  const landedLines = data.landed.map((row) => {
    const completed = row.completedWith === null ? "" : `  completedWith=${row.completedWith}`;
    return `  ${String(row.rank)}. ${row.id}  ${row.kind}  priority=${row.priority}  age=${ageLabel(row.age)}  ${receiptLabel(row.receipt)}${completed}  ${subjectLabel(row.subject)}`;
  });
  if (landedLines.length > 0) lines.push("landed", ...landedLines);
  const expiredLines = data.expired.map(
    (row) =>
      `  ${String(row.rank)}. ${row.id}  ${row.kind}  priority=${row.priority}  age=${ageLabel(row.age)}  expired=${row.expiry?.reason ?? "-"}  ${subjectLabel(row.subject)}`,
  );
  if (expiredLines.length > 0) lines.push("expired", ...expiredLines);
  if (data.queued.length === 0 && data.landed.length === 0 && data.expired.length === 0) {
    lines.push("  no steering notes");
  }
  return boundGenericLines(lines, data.omitted, "+{n} more notes omitted");
};

/** Render the `steer read` decision-point view; the boundary block is never dropped. */
export const renderSteerReadHuman = (data: SteerReadData, brand: BrandIdentity): string => {
  const boundary = data.boundary;
  const boundaryLine =
    boundary.phase === null
      ? `  boundary=open phase=- (${boundary.phaseUnknownReason ?? "phase-unrecorded"})`
      : `  boundary=${boundary.open ? "open" : "closed"} phase=${boundary.phase}`;
  const header = [
    `${clampChars(brand.binaryName, 128)} steer read  notes=${String(data.notes.length)}  asks=${String(data.asks.length)}  applied=${String(data.applied)}`,
    boundaryLine,
  ];
  const noteLines = data.notes.map((note) => {
    const state =
      note.lifecycle === "landed"
        ? `${receiptLabel(note.receipt)}`
        : note.lifecycle === "expired"
          ? `expired=${note.expiry?.reason ?? "-"}`
          : `pending=${note.pendingReason ?? "-"}`;
    return `  ${String(note.rank)}. ${note.id}  ${note.kind}  priority=${note.priority}  age=${ageLabel(note.age)}  ${state}  ${subjectLabel(note.subject)}`;
  });
  const askLines = data.asks.map(
    (ask) =>
      `  ask ${String(ask.rank)}. ${ask.id}  ${ask.type}  lane=${clampChars(ask.lane, 40)}  age=${ageLabel(ask.age)}  drawnDefault=${ask.drawnDefault ?? "-"}  defaultState=${ask.defaultState}`,
  );
  // Human bound: drop asks tail-first, then notes tail-first by rank; the two
  // header lines (with the boundary block) are never dropped (DM-8).
  let keptNotes = [...noteLines];
  let keptAsks = [...askLines];
  let dropped = 0;
  const compose = (): string => {
    const body = [...header];
    if (keptNotes.length > 0) body.push("notes", ...keptNotes);
    if (keptAsks.length > 0) body.push("asks", ...keptAsks);
    const total = data.omitted + dropped;
    if (total > 0) body.push(`+${String(total)} more rows omitted`);
    return `${body.join("\n")}\n`;
  };
  while (
    keptNotes.length + keptAsks.length > 0 &&
    (compose()
      .split("\n")
      .filter((line) => line.length > 0).length > STEER_MAX_HUMAN_LINES ||
      utf8ByteLength(compose()) > STEER_MAX_HUMAN_BYTES)
  ) {
    if (keptAsks.length > 0) keptAsks = keptAsks.slice(0, keptAsks.length - 1);
    else keptNotes = keptNotes.slice(0, keptNotes.length - 1);
    dropped += 1;
  }
  return compose();
};

/** Render the single `steer complete` line. */
export const renderSteerCompleteHuman = (data: SteerCompleteData, brand: BrandIdentity): string =>
  `${clampChars(brand.binaryName, 128)} steer completed ${data.record.id}  artifact=${clampChars(data.record.artifact, 80)}  at=${data.record.completedAt}\n`;
