/**
 * The two additive blocker record kinds over the injected state port (GH-230
 * F-1, EVT-1/EVT-2, DM-1/DM-2, DEC-11).
 *
 * Additive inside `delivery.state.v1`: one fenced append per question or answer,
 * post-append coverage verification, verified reads that fold answer presence
 * into derived closure, and fail-closed classification. The record kind and
 * payload schema are validated at the artifact boundary before any byte lands.
 * No runtime API, clock, randomness, or environment access exists here.
 */
import {
  BLOCKER_ANSWER_PAYLOAD_SCHEMA,
  BLOCKER_ANSWER_RECORD_KIND,
  BLOCKER_AUDIENCES,
  BLOCKER_CAPABILITY_SOURCES,
  BLOCKER_PREFILL_COST,
  BLOCKER_QUESTION_PAYLOAD_SCHEMA,
  BLOCKER_QUESTION_RECORD_KIND,
  BLOCKER_QUESTION_TYPES,
  BLOCKER_RESUME_MODES,
  BLOCKER_SESSION_REENTRY_BY_MODE,
  type BlockerAnswerRecord,
  type BlockerLaneResume,
  type BlockerQuestionRecord,
  type StateAppendOutcome,
  type StateArtifactBoundaryDeclaration,
  type StateJsonValue,
  type StateReadEvidence,
  type StateResult,
  type StateSafeLocation,
  type StateStorePort,
} from "#contracts";
import { createArtifactBoundary } from "./artifact-boundary.js";

/** The boundary-owned store key prefix covering both blocker kinds. */
export const BLOCKERS_RECORD_KEY_PREFIX = "blockers." as const;
/** The question key prefix (one immutable record per question id). */
export const BLOCKER_QUESTION_RECORD_KEY_PREFIX = "blockers.questions:" as const;
/** The answer key prefix (one authoritative answer per question id). */
export const BLOCKER_ANSWER_RECORD_KEY_PREFIX = "blockers.answers:" as const;

/** The question record key for one id. */
export const blockerQuestionRecordKey = (id: string): string =>
  `${BLOCKER_QUESTION_RECORD_KEY_PREFIX}${id}`;

/** The answer record key for one question id. */
export const blockerAnswerRecordKey = (questionId: string): string =>
  `${BLOCKER_ANSWER_RECORD_KEY_PREFIX}${questionId}`;

/** The validated artifact-boundary declaration for the two block record kinds. */
export const BLOCKERS_ARTIFACT_BOUNDARY: StateArtifactBoundaryDeclaration = {
  recordKeyPrefix: BLOCKERS_RECORD_KEY_PREFIX,
  kinds: [
    {
      kind: BLOCKER_QUESTION_RECORD_KIND,
      payloadSchema: BLOCKER_QUESTION_PAYLOAD_SCHEMA,
      identityField: "id",
      fields: [
        { name: "schemaId", type: "string", required: true },
        { name: "id", type: "string", required: true },
        { name: "type", type: "string", required: true },
        { name: "audience", type: "string", required: true },
        { name: "lane", type: "string", required: true },
        { name: "question", type: "string", required: true },
        { name: "options", type: "array", required: true },
        { name: "askedAt", type: "string", required: true },
      ],
      vocabularies: [
        { field: "type", values: BLOCKER_QUESTION_TYPES },
        { field: "audience", values: BLOCKER_AUDIENCES },
      ],
    },
    {
      kind: BLOCKER_ANSWER_RECORD_KIND,
      payloadSchema: BLOCKER_ANSWER_PAYLOAD_SCHEMA,
      identityField: "questionId",
      fields: [
        { name: "schemaId", type: "string", required: true },
        { name: "questionId", type: "string", required: true },
        { name: "answeringAudience", type: "string", required: true },
        { name: "answeredAt", type: "string", required: true },
        { name: "applied", type: "boolean", required: true },
        { name: "laneResume", type: "object", required: true },
      ],
      vocabularies: [{ field: "answeringAudience", values: BLOCKER_AUDIENCES }],
    },
  ],
};

/** A verified read of every blocker record, folded into questions and answers. */
export type BlockerLedgerRead = {
  readonly verifiedEmpty: boolean;
  readonly questions: readonly BlockerQuestionRecord[];
  readonly answers: readonly BlockerAnswerRecord[];
  readonly recordCount: number;
  readonly evidence: StateReadEvidence;
};

/** One successful append outcome. */
export type BlockerRecordAppendOutcome = {
  readonly appended: true;
  readonly record: BlockerQuestionRecord | BlockerAnswerRecord;
  readonly append: StateAppendOutcome;
  readonly fenceReleased: boolean;
};

const ok = <T>(value: T): StateResult<T> => ({ ok: true, value });

const fail = (
  code: "state.store.torn" | "state.store.unknown",
  location: StateSafeLocation,
): StateResult<never> => ({
  ok: false,
  error: { kind: "state", code, consequence: "not_landed", location },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const hasOnlyKeys = (
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
): boolean => Object.keys(value).every((key) => allowed.includes(key));

const QUESTION_KEYS = [
  "schemaId",
  "id",
  "type",
  "audience",
  "lane",
  "ref",
  "question",
  "options",
  "askedAt",
] as const;

const ANSWER_KEYS = [
  "schemaId",
  "questionId",
  "answeringAudience",
  "choice",
  "text",
  "answeredAt",
  "applied",
  "laneResume",
] as const;

const RESUME_KEYS = ["mode", "sessionReentry", "capabilitySource", "prefillCost"] as const;

const questionPayload = (record: BlockerQuestionRecord): StateJsonValue => ({
  schemaId: record.schemaId,
  id: record.id,
  type: record.type,
  audience: record.audience,
  lane: record.lane,
  ref: record.ref,
  question: record.question,
  options: [...record.options],
  askedAt: record.askedAt,
});

const laneResumePayload = (resume: BlockerLaneResume): StateJsonValue => ({
  mode: resume.mode,
  sessionReentry: resume.sessionReentry,
  capabilitySource: resume.capabilitySource,
  ...(resume.prefillCost === undefined ? {} : { prefillCost: resume.prefillCost }),
});

const answerPayload = (record: BlockerAnswerRecord): StateJsonValue => ({
  schemaId: record.schemaId,
  questionId: record.questionId,
  answeringAudience: record.answeringAudience,
  ...(record.choice === undefined ? {} : { choice: record.choice }),
  ...(record.text === undefined ? {} : { text: record.text }),
  answeredAt: record.answeredAt,
  applied: record.applied,
  laneResume: laneResumePayload(record.laneResume),
});

const laneResumeFrom = (
  value: unknown,
  location: StateSafeLocation,
): StateResult<BlockerLaneResume> => {
  if (!isRecord(value) || !hasOnlyKeys(value, RESUME_KEYS)) {
    return fail("state.store.torn", location);
  }
  if (
    typeof value.mode !== "string" ||
    !(BLOCKER_RESUME_MODES as readonly string[]).includes(value.mode)
  ) {
    return fail("state.store.torn", location);
  }
  const mode = value.mode as BlockerLaneResume["mode"];
  if (value.sessionReentry !== BLOCKER_SESSION_REENTRY_BY_MODE[mode]) {
    return fail("state.store.torn", location);
  }
  if (
    typeof value.capabilitySource !== "string" ||
    !(BLOCKER_CAPABILITY_SOURCES as readonly string[]).includes(value.capabilitySource)
  ) {
    return fail("state.store.torn", location);
  }
  const isFallback = mode === "resume-prompt-reentry";
  if (isFallback) {
    if (value.prefillCost !== BLOCKER_PREFILL_COST) return fail("state.store.torn", location);
    if (value.capabilitySource !== "capability-absent") return fail("state.store.torn", location);
  } else {
    if (Object.hasOwn(value, "prefillCost")) return fail("state.store.torn", location);
    if (value.capabilitySource !== "adapter-declared") return fail("state.store.torn", location);
  }
  return ok({
    mode,
    sessionReentry: value.sessionReentry as boolean,
    capabilitySource: value.capabilitySource as BlockerLaneResume["capabilitySource"],
    ...(isFallback ? { prefillCost: BLOCKER_PREFILL_COST } : {}),
  });
};

const questionFrom = (
  value: unknown,
  location: StateSafeLocation,
): StateResult<BlockerQuestionRecord> => {
  if (!isRecord(value) || !hasOnlyKeys(value, QUESTION_KEYS)) {
    return fail("state.store.torn", location);
  }
  // An undeclared schema, field, or vocabulary value is a boundary-relative
  // payload violation; malformed structure inside a declared record is torn.
  if (value.schemaId !== BLOCKER_QUESTION_PAYLOAD_SCHEMA)
    return fail("state.store.unknown", location);
  if (!isNonEmptyString(value.id)) return fail("state.store.unknown", location);
  if (
    typeof value.type !== "string" ||
    !(BLOCKER_QUESTION_TYPES as readonly string[]).includes(value.type)
  ) {
    return fail("state.store.unknown", location);
  }
  if (
    typeof value.audience !== "string" ||
    !(BLOCKER_AUDIENCES as readonly string[]).includes(value.audience)
  ) {
    return fail("state.store.unknown", location);
  }
  if (!isNonEmptyString(value.lane)) return fail("state.store.unknown", location);
  if (!isNonEmptyString(value.question)) return fail("state.store.unknown", location);
  if (!isNonEmptyString(value.askedAt)) return fail("state.store.unknown", location);
  if (value.ref !== null && typeof value.ref !== "string")
    return fail("state.store.torn", location);
  if (!Array.isArray(value.options) || value.options.some((option) => typeof option !== "string")) {
    return fail("state.store.torn", location);
  }
  return ok(value as unknown as BlockerQuestionRecord);
};

const answerFrom = (
  value: unknown,
  location: StateSafeLocation,
): StateResult<BlockerAnswerRecord> => {
  if (!isRecord(value) || !hasOnlyKeys(value, ANSWER_KEYS)) {
    return fail("state.store.torn", location);
  }
  if (value.schemaId !== BLOCKER_ANSWER_PAYLOAD_SCHEMA)
    return fail("state.store.unknown", location);
  if (!isNonEmptyString(value.questionId)) return fail("state.store.unknown", location);
  if (
    typeof value.answeringAudience !== "string" ||
    !(BLOCKER_AUDIENCES as readonly string[]).includes(value.answeringAudience)
  ) {
    return fail("state.store.unknown", location);
  }
  const hasChoice = value.choice !== undefined;
  const hasText = value.text !== undefined;
  if (hasChoice === hasText) return fail("state.store.torn", location);
  if (hasChoice && typeof value.choice !== "string") return fail("state.store.torn", location);
  if (hasText && typeof value.text !== "string") return fail("state.store.torn", location);
  if (!isNonEmptyString(value.answeredAt)) return fail("state.store.unknown", location);
  if (value.applied !== false) return fail("state.store.torn", location);
  const resume = laneResumeFrom(value.laneResume, location);
  if (!resume.ok) return resume;
  return ok({
    schemaId: BLOCKER_ANSWER_PAYLOAD_SCHEMA,
    questionId: value.questionId,
    answeringAudience: value.answeringAudience as BlockerAnswerRecord["answeringAudience"],
    ...(hasChoice ? { choice: value.choice as string } : {}),
    ...(hasText ? { text: value.text as string } : {}),
    answeredAt: value.answeredAt,
    applied: false,
    laneResume: resume.value,
  });
};

/**
 * Read every verified blocker record.
 *
 * The boundary validates kind, schema, required fields, and the closed
 * vocabularies; this module additionally validates record semantics and fails
 * closed on duplicate question ids or duplicate answers for one question id.
 */
export const readBlockerLedger = (store: StateStorePort): StateResult<BlockerLedgerRead> => {
  const boundary = createArtifactBoundary(store, BLOCKERS_ARTIFACT_BOUNDARY);
  const read = boundary.read();
  if (!read.ok) return read;
  const questions: BlockerQuestionRecord[] = [];
  const answers: BlockerAnswerRecord[] = [];
  const questionIds = new Set<string>();
  const answeredIds = new Set<string>();
  for (const artifact of read.value.artifacts) {
    const location: StateSafeLocation = {
      path: read.value.evidence.storePath,
      record: artifact.sequence,
    };
    if (artifact.kind === BLOCKER_QUESTION_RECORD_KIND) {
      const parsed = questionFrom(artifact.payload, location);
      if (!parsed.ok) return parsed;
      if (questionIds.has(parsed.value.id)) return fail("state.store.torn", location);
      questionIds.add(parsed.value.id);
      questions.push(parsed.value);
      continue;
    }
    const parsed = answerFrom(artifact.payload, location);
    if (!parsed.ok) return parsed;
    if (answeredIds.has(parsed.value.questionId)) return fail("state.store.torn", location);
    answeredIds.add(parsed.value.questionId);
    answers.push(parsed.value);
  }
  return ok({
    verifiedEmpty: read.value.verdict === "verified-empty",
    questions,
    answers,
    recordCount: read.value.artifacts.length,
    evidence: read.value.evidence,
  });
};

const appendRecord = (
  store: StateStorePort,
  request: {
    readonly kind: string;
    readonly recordKey: string;
    readonly payload: StateJsonValue;
    readonly fenceToken: string;
    readonly expectedRecordCount: number;
  },
): StateResult<{ readonly append: StateAppendOutcome; readonly fenceReleased: boolean }> => {
  const boundary = createArtifactBoundary(store, BLOCKERS_ARTIFACT_BOUNDARY);
  const acquired = store.acquireFence(request.fenceToken);
  if (!acquired.ok) return acquired;
  const handle = acquired.value.handle;
  const appended = boundary.append(handle, {
    kind: request.kind,
    recordKey: request.recordKey,
    payload: request.payload,
  });
  if (!appended.ok) {
    store.releaseFence(handle);
    return appended;
  }
  const coverage = boundary.read();
  const released = store.releaseFence(handle);
  if (!coverage.ok) return coverage;
  if (coverage.value.artifacts.length !== request.expectedRecordCount + 1) {
    return fail("state.store.torn", {
      path: coverage.value.evidence.storePath,
      record: coverage.value.artifacts.length,
    });
  }
  return ok({ append: appended.value, fenceReleased: released.ok && released.value.released });
};

/**
 * Append one immutable question record under a single-writer fence.
 *
 * The payload is validated against the declared kind before any byte lands;
 * the post-append read proves exactly one new record. A duplicate question id
 * fails closed instead of rewriting history.
 */
export const appendBlockerQuestion = (
  store: StateStorePort,
  request: { readonly record: BlockerQuestionRecord; readonly fenceToken: string },
): StateResult<BlockerRecordAppendOutcome> => {
  const current = readBlockerLedger(store);
  if (!current.ok) return current;
  if (current.value.questions.some((question) => question.id === request.record.id)) {
    return fail("state.store.torn", {
      path: current.value.evidence.storePath,
      record: current.value.recordCount,
    });
  }
  const validated = questionFrom(questionPayload(request.record), {
    path: store.identity.stateDirectory,
  });
  if (!validated.ok) return validated;
  const appended = appendRecord(store, {
    kind: BLOCKER_QUESTION_RECORD_KIND,
    recordKey: blockerQuestionRecordKey(request.record.id),
    payload: questionPayload(request.record),
    fenceToken: request.fenceToken,
    expectedRecordCount: current.value.recordCount,
  });
  if (!appended.ok) return appended;
  return ok({
    appended: true,
    record: request.record,
    append: appended.value.append,
    fenceReleased: appended.value.fenceReleased,
  });
};

/**
 * Append one answer intent record under a single-writer fence.
 *
 * Exactly one answer per question id is authoritative; a duplicate fails
 * closed. The payload is validated before landing and coverage proves +1.
 */
export const appendBlockerAnswer = (
  store: StateStorePort,
  request: { readonly record: BlockerAnswerRecord; readonly fenceToken: string },
): StateResult<BlockerRecordAppendOutcome> => {
  const current = readBlockerLedger(store);
  if (!current.ok) return current;
  if (current.value.answers.some((answer) => answer.questionId === request.record.questionId)) {
    return fail("state.store.torn", {
      path: current.value.evidence.storePath,
      record: current.value.recordCount,
    });
  }
  const validated = answerFrom(answerPayload(request.record), {
    path: store.identity.stateDirectory,
  });
  if (!validated.ok) return validated;
  const appended = appendRecord(store, {
    kind: BLOCKER_ANSWER_RECORD_KIND,
    recordKey: blockerAnswerRecordKey(request.record.questionId),
    payload: answerPayload(request.record),
    fenceToken: request.fenceToken,
    expectedRecordCount: current.value.recordCount,
  });
  if (!appended.ok) return appended;
  return ok({
    appended: true,
    record: request.record,
    append: appended.value.append,
    fenceReleased: appended.value.fenceReleased,
  });
};
