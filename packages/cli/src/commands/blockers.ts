/**
 * The `blockers` command definition (GH-230 F-7, DEC-1/DEC-3/DEC-9).
 *
 * The handler owns no stream writes and chooses no exit code. Every dependency
 * is injected through `BlockersCommandRuntime`; the handler validates, guards,
 * reads once, appends once, and returns data or one classified failure. The CLI
 * edge is the only writer and the only chooser of the exit projection.
 */

import {
  buildBlockerAnswerData,
  buildBlockerListData,
  buildBlockerPublishData,
  evaluateBlockerGuard,
  formatBlockerQuestionId,
  projectBlockerLaneResume,
  renderBlockerAnswerHuman,
  renderBlockerPublishHuman,
  renderBlockersHuman,
  resolveAnsweringAudience,
  resolveBlockerDelegation,
  validateBlockerAnswer,
  validateBlockerPublish,
} from "@delivery-os/core";
import {
  type BlockerAnswerData,
  type BlockerAnswerRecord,
  type BlockerAudience,
  type BlockerCapabilityFact,
  type BlockerDelegationPolicy,
  type BlockerListData,
  type BlockerPublishData,
  type BlockerQuestionRecord,
  type BrandIdentity,
  FALLBACK_INVOCATION_CODE,
  type StateResult,
} from "@delivery-os/core/contracts";
import type { BlockerLedgerRead, BlockerRecordAppendOutcome } from "@delivery-os/core/state";
import type { CommandDefinition } from "../index.js";

/** The optional session port: recorded only, never called by this change (v0). */
export type BlockerSessionPort = {
  readonly spawn: (...args: readonly unknown[]) => unknown;
  readonly attach: (...args: readonly unknown[]) => unknown;
  readonly resume: (...args: readonly unknown[]) => unknown;
  readonly steer: (...args: readonly unknown[]) => unknown;
};

/** Everything the blockers handler reads or writes, injected at the edge. */
export type BlockersCommandRuntime = {
  readonly brand: BrandIdentity;
  readonly clock: { readonly nowMs: () => number; readonly nowIso: () => string };
  readonly newQuestionSuffix: () => string;
  readonly newFenceToken: () => string;
  readonly readBlockers: () => StateResult<BlockerLedgerRead>;
  readonly appendQuestion: (
    record: BlockerQuestionRecord,
    current?: BlockerLedgerRead,
  ) => StateResult<BlockerRecordAppendOutcome>;
  readonly appendAnswer: (
    record: BlockerAnswerRecord,
    current?: BlockerLedgerRead,
  ) => StateResult<BlockerRecordAppendOutcome>;
  readonly callerAudienceFact: string | undefined;
  readonly capability: BlockerCapabilityFact | undefined;
  readonly delegationPolicy: BlockerDelegationPolicy;
  readonly secrets: readonly string[];
  readonly session?: BlockerSessionPort;
};

type BlockerSuccess = {
  readonly data: BlockerPublishData | BlockerAnswerData | BlockerListData;
};
type BlockerFailure = {
  readonly error: {
    readonly kind: string;
    readonly code: string;
    readonly summary?: string;
  };
};

const failure = (kind: string, code: string, summary?: string): BlockerFailure => ({
  error: { kind, code, ...(summary === undefined ? {} : { summary }) },
});

const invocationFailure = (summary: string): BlockerFailure =>
  failure("fallback", FALLBACK_INVOCATION_CODE, summary);

/** Project a validation code onto its declared domain kind. */
const validationFailure = (code: string, summary: string): BlockerFailure =>
  failure(code.startsWith("blockers.") ? "blockers" : "input", code, summary);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringFlag = (
  flags: Readonly<Record<string, string | true>>,
  name: string,
): string | undefined => {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
};

const stateFailure = (error: { readonly kind: string; readonly code: string }): BlockerFailure =>
  failure(error.kind, error.code);

const readOnce = (runtime: BlockersCommandRuntime): BlockerFailure | BlockerLedgerRead => {
  const read = runtime.readBlockers();
  return read.ok ? read.value : stateFailure(read.error);
};

const listHandler = (
  runtime: BlockersCommandRuntime,
  flags: Readonly<Record<string, string | true>>,
  positionals: readonly string[],
): BlockerSuccess | BlockerFailure => {
  if (positionals.length !== 1) {
    return invocationFailure("blockers list takes no positional arguments");
  }
  const read = readOnce(runtime);
  if ("error" in read) return read;
  return {
    data: buildBlockerListData(read.questions, read.answers, runtime.clock.nowMs(), {
      openOnly: flags["--open"] === true,
    }),
  };
};

const publishHandler = (
  runtime: BlockersCommandRuntime,
  flags: Readonly<Record<string, string | true>>,
  positionals: readonly string[],
): BlockerSuccess | BlockerFailure => {
  if (positionals.length !== 3) {
    return invocationFailure('blockers publish requires: publish <type> --lane <id> "<question>"');
  }
  const type = positionals[1] as string;
  const question = positionals[2] as string;
  const lane = stringFlag(flags, "--lane");
  if (lane === undefined) return invocationFailure("blockers publish requires --lane <id>");
  const rawOptions = stringFlag(flags, "--options");
  const audience = stringFlag(flags, "--audience");
  const validated = validateBlockerPublish({
    type,
    ...(audience === undefined ? {} : { audience }),
    lane,
    question,
    ...(rawOptions === undefined ? {} : { options: rawOptions.split(",") }),
  });
  if (!validated.ok) return validationFailure(validated.code, validated.summary);
  const guarded = evaluateBlockerGuard({
    type: validated.value.type,
    question: validated.value.question,
    options: validated.value.options,
    lane: validated.value.lane,
    ref: validated.value.ref,
    secrets: runtime.secrets,
  });
  if (!guarded.ok) return failure("blockers", guarded.code, guarded.summary);
  const record: BlockerQuestionRecord = {
    schemaId: "delivery.blocker.question.v1",
    id: formatBlockerQuestionId(runtime.newQuestionSuffix()),
    type: validated.value.type,
    audience: validated.value.audience,
    lane: validated.value.lane,
    ref: validated.value.ref,
    question: validated.value.question,
    options: validated.value.options,
    askedAt: runtime.clock.nowIso(),
  };
  const appended = runtime.appendQuestion(record);
  if (!appended.ok) return stateFailure(appended.error);
  return { data: buildBlockerPublishData(record) };
};

const answerHandler = (
  runtime: BlockersCommandRuntime,
  flags: Readonly<Record<string, string | true>>,
  positionals: readonly string[],
): BlockerSuccess | BlockerFailure => {
  if (positionals.length !== 2) {
    return invocationFailure("blockers answer requires exactly one question id");
  }
  const questionId = positionals[1] as string;
  const choice = stringFlag(flags, "--choice");
  const text = stringFlag(flags, "--text");
  // The answer text is a content path, so the guard runs before any state read.
  if (text !== undefined) {
    const early = evaluateBlockerGuard({ answerText: text, secrets: runtime.secrets });
    if (!early.ok) return failure("blockers", early.code, early.summary);
  }
  const read = readOnce(runtime);
  if ("error" in read) return read;
  const question = read.questions.find((candidate) => candidate.id === questionId);
  if (question === undefined) {
    return failure(
      "blockers",
      "blockers.unknown-id",
      `question ${questionId} does not exist in this store`,
    );
  }
  const guarded = evaluateBlockerGuard({
    question: question.question,
    options: question.options,
    ...(text === undefined ? {} : { answerText: text }),
    lane: question.lane,
    ref: question.ref,
    secrets: runtime.secrets,
  });
  if (!guarded.ok) return failure("blockers", guarded.code, guarded.summary);

  const answeringAudience: BlockerAudience = resolveAnsweringAudience(runtime.callerAudienceFact);
  const delegation = resolveBlockerDelegation(
    runtime.delegationPolicy,
    question.audience,
    answeringAudience,
  );
  if (!delegation.allowed) {
    return failure(
      "blockers",
      "blockers.audience-mismatch",
      `question ${question.id} is addressed to audience ${question.audience}; delegation policy: ${delegation.policy}`,
    );
  }

  const validated = validateBlockerAnswer(
    question,
    {
      questionId,
      ...(choice === undefined ? {} : { choice }),
      ...(text === undefined ? {} : { text }),
    },
    read.answers.some((answer) => answer.questionId === questionId),
  );
  if (!validated.ok) return validationFailure(validated.code, validated.summary);

  const record: BlockerAnswerRecord = {
    schemaId: "delivery.blocker.answer.v1",
    questionId,
    answeringAudience,
    ...(validated.value.choice === undefined ? {} : { choice: validated.value.choice }),
    ...(validated.value.text === undefined ? {} : { text: validated.value.text }),
    answeredAt: runtime.clock.nowIso(),
    applied: false,
    laneResume: projectBlockerLaneResume(runtime.capability),
  };
  const appended = runtime.appendAnswer(record, read);
  if (!appended.ok) return stateFailure(appended.error);
  return { data: buildBlockerAnswerData(record) };
};

const humanText = (data: unknown, brand: BrandIdentity): string | undefined => {
  if (!isRecord(data)) return undefined;
  if (Array.isArray(data.questions)) return renderBlockersHuman(data as BlockerListData, brand);
  if (typeof data.answered === "string")
    return renderBlockerAnswerHuman(data as BlockerAnswerData, brand);
  if (isRecord(data.question)) return renderBlockerPublishHuman(data as BlockerPublishData, brand);
  return undefined;
};

/** Build the `blockers` command definition over the injected runtime. */
export const createBlockersCommandDefinition = (
  runtime: BlockersCommandRuntime,
): CommandDefinition => ({
  flags: ["--open"],
  requiresValue: ["--lane", "--options", "--audience", "--choice", "--text"],
  positionals: { max: 3 },
  humanText,
  handler: async (invocation) => {
    const positionals = invocation.positionals;
    const subcommand = positionals[0];
    if (subcommand === "list") return listHandler(runtime, invocation.flags, positionals);
    if (subcommand === "answer") return answerHandler(runtime, invocation.flags, positionals);
    if (subcommand === "publish") return publishHandler(runtime, invocation.flags, positionals);
    return invocationFailure("blockers requires one of: list, answer, publish");
  },
});
