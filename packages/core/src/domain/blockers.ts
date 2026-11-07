/**
 * The pure typed-blocker evaluator (GH-230 F-1..F-7, DM-1..DM-3, DM-5).
 *
 * No I/O, clock, randomness, or ambient environment: every variable fact
 * (including `nowMs`, secrets, capability, policy, and caller-audience fact)
 * arrives through arguments. The exports are the publish/answer validators, the
 * layered credential guard, the audience/delegation resolvers, the one shared
 * ranking, the resume projection, the list/answer/publish projections, and the
 * human renderers. All helpers stay internal.
 */
import {
  BLOCKER_ANSWER_CHANNEL_BY_TYPE,
  BLOCKER_AUDIENCES,
  BLOCKER_DECLARED_RESUME_MODES,
  BLOCKER_DEFAULT_AUDIENCE,
  BLOCKER_DEFAULT_RESUME_MODE,
  BLOCKER_FALLBACK_RESUME_MODE,
  BLOCKER_MAX_ANSWER_CHARS,
  BLOCKER_MAX_OPTION_CHARS,
  BLOCKER_MAX_OPTIONS,
  BLOCKER_MAX_QUESTION_CHARS,
  BLOCKER_PREFILL_COST,
  BLOCKER_PRIORITY_BY_TYPE,
  BLOCKER_QUESTION_TYPES,
  BLOCKER_SESSION_REENTRY_BY_MODE,
  BLOCKER_VARIABLE_NAME_PATTERN,
  BLOCKERS_MAX_HUMAN_BYTES,
  BLOCKERS_MAX_HUMAN_LINES,
  BLOCKERS_MAX_MACHINE_BYTES,
  BLOCKERS_MAX_QUESTIONS,
  BLOCKERS_SCHEMA_VERSION,
  type BlockerAnswerData,
  type BlockerAnsweredView,
  type BlockerAnswerInput,
  type BlockerAnswerRecord,
  type BlockerAudience,
  type BlockerCapabilityFact,
  type BlockerDelegationPolicy,
  type BlockerDelegationPolicyLabel,
  type BlockerLaneResume,
  type BlockerListData,
  type BlockerPublishData,
  type BlockerPublishInput,
  type BlockerQuestionRecord,
  type BlockerQuestionType,
  type BlockerQuestionView,
  type BrandIdentity,
  STATUS_MAX_DETAIL_CHARS,
} from "#contracts";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Ascending Unicode code-point comparison (locale-independent). */
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

/** Whether the value names one of the closed question types. */
export const isBlockerQuestionType = (value: string): value is BlockerQuestionType =>
  (BLOCKER_QUESTION_TYPES as readonly string[]).includes(value);

/** Whether the value names one of the closed audiences. */
export const isBlockerAudience = (value: string): value is BlockerAudience =>
  (BLOCKER_AUDIENCES as readonly string[]).includes(value);

/** The declared question-id form: `q-` plus a non-empty opaque suffix. */
export const formatBlockerQuestionId = (suffix: string): string => `q-${suffix}`;

/** The branding-derived caller-audience variable name (DEC-4, GAP-10). */
export const callerAudienceVariableName = (brand: BrandIdentity): string =>
  `${brand.environmentPrefix}CALLER_AUDIENCE`;

/** Resolve the answering audience: exact values honoured, everything else `owner`. */
export const resolveAnsweringAudience = (fact: string | undefined): BlockerAudience =>
  fact === "coordinator" || fact === "owner" ? fact : "owner";

/* ------------------------------- validation ------------------------------- */

export type BlockerValidationCode = "blockers.invalid-type" | "input.value.rejected";

export type BlockerValidationFailure = {
  readonly ok: false;
  readonly code: BlockerValidationCode;
  readonly summary: string;
};

export type BlockerPublishValidated = {
  readonly type: BlockerQuestionType;
  readonly audience: BlockerAudience;
  readonly lane: string;
  readonly ref: string | null;
  readonly question: string;
  readonly options: readonly string[];
};

export type BlockerPublishValidation =
  | { readonly ok: true; readonly value: BlockerPublishValidated }
  | BlockerValidationFailure;

/** The injectable content caps (production defaults are the contract data). */
export type BlockerContentLimits = {
  readonly maxQuestionChars: number;
  readonly maxOptions: number;
  readonly maxOptionChars: number;
  readonly maxAnswerChars: number;
};

/** The shipped content caps, read from the contract data. */
export const BLOCKER_CONTENT_LIMITS: BlockerContentLimits = {
  maxQuestionChars: BLOCKER_MAX_QUESTION_CHARS,
  maxOptions: BLOCKER_MAX_OPTIONS,
  maxOptionChars: BLOCKER_MAX_OPTION_CHARS,
  maxAnswerChars: BLOCKER_MAX_ANSWER_CHARS,
} as const;

export type BlockerAnswerValidated = {
  readonly choice?: string;
  readonly text?: string;
};

export type BlockerAnswerValidation =
  | { readonly ok: true; readonly value: BlockerAnswerValidated }
  | BlockerValidationFailure;

const rejected = (summary: string): BlockerValidationFailure => ({
  ok: false,
  code: "input.value.rejected",
  summary,
});

/**
 * Validate a publish request.
 *
 * The type is checked first, before any content, audience, or option guard
 * (GAP-5). Options are admitted only on the options-bearing type, preserved
 * verbatim, and bounded by the declared caps.
 */
export const validateBlockerPublish = (
  input: BlockerPublishInput,
  limits: BlockerContentLimits = BLOCKER_CONTENT_LIMITS,
): BlockerPublishValidation => {
  if (!isBlockerQuestionType(input.type)) {
    return {
      ok: false,
      code: "blockers.invalid-type",
      summary: `unknown question type; use one of ${BLOCKER_QUESTION_TYPES.join(", ")}`,
    };
  }
  const type = input.type;
  const audience = input.audience === undefined ? BLOCKER_DEFAULT_AUDIENCE : input.audience;
  if (!isBlockerAudience(audience)) {
    return rejected(`audience must be one of ${BLOCKER_AUDIENCES.join(", ")}`);
  }
  if (typeof input.lane !== "string" || input.lane.trim().length === 0) {
    return rejected("lane must be a non-empty identifier");
  }
  if (typeof input.question !== "string" || input.question.trim().length === 0) {
    return rejected("question text must be non-empty");
  }
  if (charLength(input.question) > limits.maxQuestionChars) {
    return rejected(`question text exceeds ${limits.maxQuestionChars} characters`);
  }
  const channel = BLOCKER_ANSWER_CHANNEL_BY_TYPE[type];
  let options: readonly string[] = [];
  if (channel === "choice") {
    const supplied = input.options ?? [];
    if (supplied.length < 1 || supplied.length > limits.maxOptions) {
      return rejected(
        `decision-needed requires between 1 and ${limits.maxOptions} ordered options`,
      );
    }
    for (const option of supplied) {
      if (typeof option !== "string" || option.length === 0) {
        return rejected("options must be non-empty values");
      }
      if (charLength(option) > limits.maxOptionChars) {
        return rejected(`an option exceeds ${limits.maxOptionChars} characters`);
      }
    }
    options = [...supplied];
  } else if (input.options !== undefined) {
    return rejected(`options are admitted only on decision-needed questions`);
  }
  if (input.ref !== undefined && input.ref !== null && typeof input.ref !== "string") {
    return rejected("ref must be a string when supplied");
  }
  const ref = input.ref === undefined || input.ref === null || input.ref === "" ? null : input.ref;
  return {
    ok: true,
    value: { type, audience, lane: input.lane, ref, question: input.question, options },
  };
};

const choiceIndex = /^[1-9][0-9]*$/;

/**
 * Validate an answer against its question's declared channel.
 *
 * Choice answers record the selected option value, never the 1-based index;
 * every channel, range, both/neither, empty, over-cap, and already-answered
 * violation is `input.value.rejected` (GAP-5, DEC-9).
 */
export const validateBlockerAnswer = (
  question: BlockerQuestionRecord,
  input: BlockerAnswerInput,
  answered: boolean,
  limits: BlockerContentLimits = BLOCKER_CONTENT_LIMITS,
): BlockerAnswerValidation => {
  if (answered) {
    return rejected(`question ${question.id} already has an authoritative answer`);
  }
  const channel = BLOCKER_ANSWER_CHANNEL_BY_TYPE[question.type];
  const hasChoice = input.choice !== undefined;
  const hasText = input.text !== undefined;
  if (channel === "choice") {
    if (hasText) {
      return rejected(`${question.type} is answered with --choice, not --text`);
    }
    if (!hasChoice) {
      return rejected(`${question.type} requires --choice <n>`);
    }
    const raw = input.choice as string;
    if (!choiceIndex.test(raw)) {
      return rejected(`choice index must be a positive integer, received "${raw}"`);
    }
    const index = Number(raw);
    if (index < 1 || index > question.options.length) {
      return rejected(
        `choice index ${index} is outside 1..${question.options.length} for ${question.id}`,
      );
    }
    return { ok: true, value: { choice: question.options[index - 1] as string } };
  }
  if (hasChoice) {
    return rejected(`${question.type} is answered with --text, not --choice`);
  }
  if (!hasText) {
    return rejected(`${question.type} requires --text <answer>`);
  }
  const text = input.text as string;
  if (text.trim().length === 0) return rejected("answer text must be non-empty");
  if (charLength(text) > limits.maxAnswerChars) {
    return rejected(`answer text exceeds ${limits.maxAnswerChars} characters`);
  }
  return { ok: true, value: { text } };
};

/* ------------------------------ credential guard --------------------------- */

export type BlockerGuardRequest = {
  readonly type?: string;
  readonly question?: string;
  readonly options?: readonly string[];
  readonly answerText?: string;
  readonly lane?: string | null;
  readonly ref?: string | null;
  readonly secrets: readonly string[];
};

export type BlockerGuardVerdict =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: "blockers.credential-value-rejected";
      readonly summary: string;
    };

const guardFailure = (summary: string): BlockerGuardVerdict => ({
  ok: false,
  code: "blockers.credential-value-rejected",
  summary,
});

/** Layer 1: a registered secret value appears anywhere in the supplied text. */
const containsRegisteredSecret = (text: string, secrets: readonly string[]): boolean => {
  for (const secret of secrets) {
    if (secret.length === 0) continue;
    if (text.includes(secret)) return true;
  }
  return false;
};

/** Layer 2: the text is exactly a declared variable name, never a value or prose. */
export const isCredentialNameShaped = (
  text: string,
  pattern: string = BLOCKER_VARIABLE_NAME_PATTERN,
): boolean => new RegExp(pattern).test(text);

/**
 * The layered credential guard, evaluated before any record lands.
 *
 * Layer 1 refuses a registered secret value on every content path and on the
 * `lane`/`ref` identifier fields (AC-F3-1, AC-F3-4). Layer 2 applies only to a
 * `credential-missing` question text and requires the declared name shape
 * (AC-F3-2). No token-shape pattern scan exists anywhere (TDR-0011).
 */
export const evaluateBlockerGuard = (
  request: BlockerGuardRequest,
  contract: { readonly namePattern?: string } = {},
): BlockerGuardVerdict => {
  // Layer 1 is the stronger rule and wins over layer 2.
  for (const value of [
    request.question,
    ...(request.options ?? []),
    request.answerText,
    request.lane ?? undefined,
    request.ref ?? undefined,
  ]) {
    if (value === undefined) continue;
    if (containsRegisteredSecret(value, request.secrets)) {
      return guardFailure(
        "the supplied content contains a registered credential value; credential questions carry the variable name only and the value comes from the environment",
      );
    }
  }
  // Layer 2 is path-scoped: only a credential-missing question text.
  if (
    request.type === "credential-missing" &&
    request.question !== undefined &&
    !isCredentialNameShaped(request.question, contract.namePattern ?? BLOCKER_VARIABLE_NAME_PATTERN)
  ) {
    return guardFailure(
      "a credential-missing question must name the variable (for example GITHUB_TOKEN) and carry no value or prose",
    );
  }
  return { ok: true };
};

/* ------------------------------- delegation -------------------------------- */

export type BlockerDelegationPolicyViolation =
  | "duplicate-combination"
  | "missing-combination"
  | "unknown-audience"
  | "inconsistent-policy-label";

/** Validate the injected delegation map: total, closed, and label-consistent. */
export const validateBlockerDelegationPolicy = (
  policy: BlockerDelegationPolicy,
): readonly BlockerDelegationPolicyViolation[] => {
  const violations: BlockerDelegationPolicyViolation[] = [];
  const seen = new Set<string>();
  for (const row of policy.rows) {
    if (!isBlockerAudience(row.questionAudience) || !isBlockerAudience(row.answeringAudience)) {
      violations.push("unknown-audience");
    }
    const key = `${row.questionAudience}->${row.answeringAudience}`;
    if (seen.has(key)) violations.push("duplicate-combination");
    seen.add(key);
    if (row.allowed !== (row.policy === "allowed")) {
      violations.push("inconsistent-policy-label");
    }
  }
  for (const questionAudience of BLOCKER_AUDIENCES) {
    for (const answeringAudience of BLOCKER_AUDIENCES) {
      if (!seen.has(`${questionAudience}->${answeringAudience}`)) {
        violations.push("missing-combination");
      }
    }
  }
  return violations;
};

export type BlockerDelegationDecision = {
  readonly allowed: boolean;
  readonly policy: BlockerDelegationPolicyLabel;
  readonly declared: boolean;
};

/**
 * Resolve a delegation decision purely from the injected map.
 *
 * A missing row is a declared refusal, never an implicit allow; authority is
 * never invented from the question or the runtime (DEC-3).
 */
export const resolveBlockerDelegation = (
  policy: BlockerDelegationPolicy,
  questionAudience: BlockerAudience,
  answeringAudience: BlockerAudience,
): BlockerDelegationDecision => {
  const row = policy.rows.find(
    (candidate) =>
      candidate.questionAudience === questionAudience &&
      candidate.answeringAudience === answeringAudience,
  );
  if (row === undefined) return { allowed: false, policy: "none", declared: false };
  return { allowed: row.allowed, policy: row.policy, declared: true };
};

/* -------------------------------- ranking --------------------------------- */

const priorityOf = (
  type: BlockerQuestionType,
  priorities: Readonly<Record<BlockerQuestionType, number>>,
): number => priorities[type] ?? 4;

const askedMs = (question: BlockerQuestionRecord): number =>
  parseInstant(question.askedAt) ?? Number.POSITIVE_INFINITY;

const renderLane = (lane: string): string => clampChars(lane, STATUS_MAX_DETAIL_CHARS);

const renderRef = (ref: string | null): string | null =>
  ref === null ? null : clampChars(ref, STATUS_MAX_DETAIL_CHARS);

const openView = (
  question: BlockerQuestionRecord,
  nowMs: number,
  rank: number,
): BlockerQuestionView => ({
  id: question.id,
  type: question.type,
  audience: question.audience,
  lane: renderLane(question.lane),
  ref: renderRef(question.ref),
  question: question.question,
  options: [...question.options],
  askedAt: question.askedAt,
  age: ageOf(question.askedAt, nowMs),
  rank,
  status: "open",
});

const answeredView = (
  question: BlockerQuestionRecord,
  answer: BlockerAnswerRecord,
  nowMs: number,
): BlockerAnsweredView => ({
  id: question.id,
  type: question.type,
  audience: question.audience,
  lane: renderLane(question.lane),
  ref: renderRef(question.ref),
  question: question.question,
  options: [...question.options],
  askedAt: question.askedAt,
  age: ageOf(question.askedAt, nowMs),
  status: "answered",
  answer: {
    ...(answer.choice === undefined ? {} : { choice: answer.choice }),
    ...(answer.text === undefined ? {} : { text: answer.text }),
    answeringAudience: answer.answeringAudience,
    answeredAt: answer.answeredAt,
  },
});

const ageOf = (askedAt: string, nowMs: number): number => {
  const parsed = parseInstant(askedAt);
  return parsed === undefined ? 0 : nowMs - parsed;
};

export type BlockerRanking = {
  readonly open: readonly BlockerQuestionView[];
  readonly answered: readonly BlockerAnsweredView[];
};

/**
 * The one shared ranking: priority class, then oldest `askedAt`, then id.
 *
 * Answered records are excluded from the open ranking and returned as a
 * resolved group after all open ones, in age order then id (DEC-7). Ranks are
 * contiguous 1..N over the fully ranked open set.
 */
export const rankBlockerQuestions = (
  questions: readonly BlockerQuestionRecord[],
  answers: readonly BlockerAnswerRecord[],
  nowMs: number,
  priorities: Readonly<Record<BlockerQuestionType, number>> = BLOCKER_PRIORITY_BY_TYPE,
): BlockerRanking => {
  const firstAnswer = new Map<string, BlockerAnswerRecord>();
  for (const answer of answers) {
    if (!firstAnswer.has(answer.questionId)) firstAnswer.set(answer.questionId, answer);
  }
  const open: BlockerQuestionRecord[] = [];
  const answered: {
    readonly question: BlockerQuestionRecord;
    readonly answer: BlockerAnswerRecord;
  }[] = [];
  for (const question of questions) {
    const answer = firstAnswer.get(question.id);
    if (answer === undefined) open.push(question);
    else answered.push({ question, answer });
  }
  open.sort((left, right) => {
    const priority = priorityOf(left.type, priorities) - priorityOf(right.type, priorities);
    if (priority !== 0) return priority;
    const leftAsked = askedMs(left);
    const rightAsked = askedMs(right);
    if (leftAsked !== rightAsked) return leftAsked < rightAsked ? -1 : 1;
    return compareText(left.id, right.id);
  });
  answered.sort((left, right) => {
    const leftAsked = askedMs(left.question);
    const rightAsked = askedMs(right.question);
    if (leftAsked !== rightAsked) return leftAsked < rightAsked ? -1 : 1;
    return compareText(left.question.id, right.question.id);
  });
  return {
    open: open.map((question, index) => openView(question, nowMs, index + 1)),
    answered: answered.map((entry) => answeredView(entry.question, entry.answer, nowMs)),
  };
};

/** The declared pickup predicate: rank 1 is an open coordinator question (DEC-8). */
export const isCoordinatorPickup = (
  items: readonly {
    readonly audience: BlockerAudience;
    readonly rank?: number;
    readonly status?: string;
  }[],
): boolean => {
  const first = items[0];
  return (
    first !== undefined &&
    first.rank === 1 &&
    (first.status === undefined || first.status === "open") &&
    first.audience === "coordinator"
  );
};

/* ---------------------------- resume projection ---------------------------- */

/**
 * Project the recorded resume mode from the injected capability fact (DEC-5).
 *
 * A capability-declaring adapter yields its declared non-re-entry mode (or the
 * stable `boundary-note` default when it declares none); an absent or
 * non-declaring capability yields the `resume-prompt-reentry` fallback with
 * `sessionReentry: true` and the visible prefill-cost marker.
 */
export const projectBlockerLaneResume = (
  capability: BlockerCapabilityFact | undefined,
): BlockerLaneResume => {
  const declaredMode =
    capability !== undefined &&
    capability.resumeInjection === true &&
    typeof capability.mode === "string" &&
    (BLOCKER_DECLARED_RESUME_MODES as readonly string[]).includes(capability.mode)
      ? (capability.mode as BlockerLaneResume["mode"])
      : undefined;
  if (capability !== undefined && capability.resumeInjection === true) {
    const mode = declaredMode ?? BLOCKER_DEFAULT_RESUME_MODE;
    return {
      mode,
      sessionReentry: BLOCKER_SESSION_REENTRY_BY_MODE[mode],
      capabilitySource: "adapter-declared",
    };
  }
  return {
    mode: BLOCKER_FALLBACK_RESUME_MODE,
    sessionReentry: BLOCKER_SESSION_REENTRY_BY_MODE[BLOCKER_FALLBACK_RESUME_MODE],
    capabilitySource: "capability-absent",
    prefillCost: BLOCKER_PREFILL_COST,
  };
};

/* ------------------------------- projections ------------------------------- */

/** Build the bounded `blockers list` payload over the shared ranking. */
export const buildBlockerListData = (
  questions: readonly BlockerQuestionRecord[],
  answers: readonly BlockerAnswerRecord[],
  nowMs: number,
  options: {
    readonly openOnly?: boolean;
    readonly priorities?: Readonly<Record<BlockerQuestionType, number>>;
  } = {},
): BlockerListData => {
  const ranking = rankBlockerQuestions(
    questions,
    answers,
    nowMs,
    options.priorities ?? BLOCKER_PRIORITY_BY_TYPE,
  );
  const renderedOpen = ranking.open.slice(0, BLOCKERS_MAX_QUESTIONS);
  const capacity = Math.max(0, BLOCKERS_MAX_QUESTIONS - renderedOpen.length);
  // `--open` filters answered rows out of the payload; it does not drop them
  // for a bound, so they never contribute to the omitted/truncated count.
  const renderedAnswered = options.openOnly === true ? [] : ranking.answered.slice(0, capacity);
  const answeredOmitted =
    options.openOnly === true ? 0 : ranking.answered.length - renderedAnswered.length;
  let omitted = ranking.open.length - renderedOpen.length + answeredOmitted;
  let rows: readonly (BlockerQuestionView | BlockerAnsweredView)[] = [
    ...renderedOpen,
    ...renderedAnswered,
  ];
  let data: BlockerListData = {
    schemaVersion: BLOCKERS_SCHEMA_VERSION,
    questions: rows,
    truncated: omitted > 0,
    omitted,
  };
  while (utf8ByteLength(JSON.stringify(data)) > BLOCKERS_MAX_MACHINE_BYTES && rows.length > 0) {
    rows = rows.slice(0, rows.length - 1);
    omitted += 1;
    data = {
      schemaVersion: BLOCKERS_SCHEMA_VERSION,
      questions: rows,
      truncated: true,
      omitted,
    };
  }
  return data;
};

/** Build the `blockers answer` payload from the recorded answer. */
export const buildBlockerAnswerData = (record: BlockerAnswerRecord): BlockerAnswerData => ({
  schemaVersion: BLOCKERS_SCHEMA_VERSION,
  answered: record.questionId,
  audience: record.answeringAudience,
  ...(record.choice === undefined ? {} : { choice: record.choice }),
  ...(record.text === undefined ? {} : { text: record.text }),
  applied: record.applied,
  laneResume: record.laneResume,
});

/** Build the `blockers publish` payload from the created record. */
export const buildBlockerPublishData = (record: BlockerQuestionRecord): BlockerPublishData => ({
  schemaVersion: BLOCKERS_SCHEMA_VERSION,
  question: record,
});

/* -------------------------------- rendering -------------------------------- */

const ageLabel = (age: number): string => {
  if (age < 0) return `${age}ms`;
  if (age < HOUR_MS) return `${Math.floor(age / 60_000)}m`;
  if (age < 2 * DAY_MS) return `${Math.floor(age / HOUR_MS)}h`;
  return `${Math.floor(age / DAY_MS)}d`;
};

const optionsSuffix = (options: readonly string[]): string =>
  options.length === 0 ? "" : `  options=${options.join(",")}`;

const openLine = (question: BlockerQuestionView): string =>
  `  ${question.rank}. ${question.id}  ${question.type}  audience=${question.audience}  lane=${question.lane}  age=${ageLabel(question.age)}  "${question.question}"${optionsSuffix(question.options)}`;

const answeredLine = (question: BlockerAnsweredView): string => {
  const substance =
    question.answer.choice !== undefined
      ? `choice "${question.answer.choice}"`
      : `text "${question.answer.text ?? ""}"`;
  return `  ${question.id}  ${question.type}  audience=${question.audience}  lane=${question.lane}  age=${ageLabel(question.age)}  answered-by=${question.answer.answeringAudience}  ${substance}`;
};

const omissionLine = (omitted: number): string => `+${omitted} more questions omitted`;

const boundLines = (lines: readonly string[], omitted: number): string => {
  const kept = [...lines];
  let dropped = 0;
  const compose = (): string => {
    const body = [...kept];
    if (omitted + dropped > 0) body.push(omissionLine(omitted + dropped));
    return `${body.join("\n")}\n`;
  };
  while (
    kept.length > 1 &&
    (kept.length + 1 > BLOCKERS_MAX_HUMAN_LINES ||
      utf8ByteLength(compose()) > BLOCKERS_MAX_HUMAN_BYTES)
  ) {
    kept.pop();
    dropped += 1;
  }
  return compose();
};

/**
 * Render the deterministic, TTY-independent, ANSI-free blockers list.
 *
 * Open questions render ranked first; answered questions render in a visibly
 * separate resolved group. Every drop is marked with an exact omitted count.
 */
export const renderBlockersHuman = (data: BlockerListData, brand: BrandIdentity): string => {
  const open = data.questions.filter(
    (question): question is BlockerQuestionView => question.status === "open",
  );
  const answered = data.questions.filter(
    (question): question is BlockerAnsweredView => question.status === "answered",
  );
  const header = `${clampChars(brand.binaryName, 128)} blockers  open=${open.length}  answered=${answered.length}`;
  const lines: string[] = [header];
  for (const question of open) lines.push(openLine(question));
  if (open.length === 0 && answered.length === 0) lines.push("  no questions");
  if (answered.length > 0) {
    lines.push("answered");
    for (const question of answered) lines.push(answeredLine(question));
  }
  return boundLines(lines, data.omitted);
};

/** Render the single deterministic answer line (recorded mode, never applied). */
export const renderBlockerAnswerHuman = (data: BlockerAnswerData, brand: BrandIdentity): string => {
  const substance =
    data.choice !== undefined ? `choice "${data.choice}"` : `text "${data.text ?? ""}"`;
  const resume = data.laneResume;
  const cost = resume.prefillCost === undefined ? "" : `  prefillCost=${resume.prefillCost}`;
  return `${clampChars(brand.binaryName, 128)} blockers answered ${data.answered}  audience=${data.audience}  ${substance}  applied=${String(data.applied)}  laneResume=${resume.mode} (sessionReentry=${String(resume.sessionReentry)}, source=${resume.capabilitySource})${cost}\n`;
};

/** Render the single deterministic publish line. */
export const renderBlockerPublishHuman = (
  data: BlockerPublishData,
  brand: BrandIdentity,
): string => {
  const question = data.question;
  return `${clampChars(brand.binaryName, 128)} blockers published ${question.id}  type=${question.type}  audience=${question.audience}  lane=${renderLane(question.lane)}\n`;
};
