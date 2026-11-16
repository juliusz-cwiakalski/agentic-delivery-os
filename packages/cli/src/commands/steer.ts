/**
 * The `steer` command definition (GH-298 F-1..F-9, DM-1..DM-8).
 *
 * The handler owns no stream writes and chooses no exit code. Every dependency
 * is injected through `SteerCommandRuntime`; the handler validates and guards
 * value paths before any state read, reads the queue at most once per
 * subcommand, appends through the verified state operations, and returns data
 * or one classified failure. The CLI edge is the only writer and the only
 * chooser of the exit projection.
 */

import {
  buildSteerCompleteData,
  buildSteerListData,
  buildSteerReadData,
  buildSteerSendData,
  deriveSteerLifecycle,
  evaluateSteerGuard,
  formatSteerMessageId,
  planSteerRead,
  renderSteerCompleteHuman,
  renderSteerListHuman,
  renderSteerReadHuman,
  renderSteerSendHuman,
  validateSteerCompletion,
  validateSteerSend,
} from "@delivery-os/core";
import type {
  BrandIdentity,
  StateResult,
  SteerAskSource,
  SteerCompleteData,
  SteerCompletionRecord,
  SteerListData,
  SteerMessageRecord,
  SteerOrigin,
  SteerOutcome,
  SteerPhaseFoldView,
  SteerReadData,
  SteerSendData,
} from "@delivery-os/core/contracts";
import type {
  SteeringAppendOutcome,
  SteeringBatchAppendOutcome,
  SteeringQueueRead,
} from "@delivery-os/core/state";
import type { CommandDefinition } from "../index.js";

/** The optional session port: recorded only, never called by this family (DEC-12). */
export type SteerSessionPort = {
  readonly spawn: (...args: readonly unknown[]) => unknown;
  readonly attach: (...args: readonly unknown[]) => unknown;
  readonly resume: (...args: readonly unknown[]) => unknown;
  readonly steer: (...args: readonly unknown[]) => unknown;
};

/** Everything the steer handler reads or writes, injected at the edge. */
export type SteerCommandRuntime = {
  readonly brand: BrandIdentity;
  readonly clock: { readonly nowMs: () => number; readonly nowIso: () => string };
  readonly newMessageSuffix: () => string;
  readonly newFenceToken: () => string;
  /** The origin block derived from the invoking checkout, never asked (DEC-6). */
  readonly origin: () => SteerOrigin;
  readonly readQueue: () => StateResult<SteeringQueueRead>;
  readonly appendMessage: (
    record: SteerMessageRecord,
    current?: SteeringQueueRead,
  ) => StateResult<SteeringAppendOutcome>;
  readonly appendOutcomes: (
    records: readonly SteerOutcome[],
    current?: SteeringQueueRead,
  ) => StateResult<SteeringBatchAppendOutcome>;
  readonly appendCompletion: (
    record: SteerCompletionRecord,
    current?: SteeringQueueRead,
  ) => StateResult<SteeringAppendOutcome>;
  /** The delivered phase fold for the invoking checkout's bound change. */
  readonly readPhaseFold: (changeRef: string | null) => StateResult<SteerPhaseFoldView>;
  /** The delivered open-question view plus the PDR-0003 join facts, read-only. */
  readonly readAsks: () => StateResult<SteerAskSource>;
  readonly secrets: readonly string[];
  /** Present for the no-session-operation assertion; never invoked. */
  readonly session?: SteerSessionPort;
};

type SteerSuccess = {
  readonly data: SteerSendData | SteerListData | SteerReadData | SteerCompleteData;
};
type SteerFailure = {
  readonly error: {
    readonly kind: string;
    readonly code: string;
    readonly summary?: string;
  };
};

const failure = (kind: string, code: string, summary?: string): SteerFailure => ({
  error: { kind, code, ...(summary === undefined ? {} : { summary }) },
});

const invocationFailure = (summary: string): SteerFailure =>
  failure("fallback", "fallback.invocation", summary);

const valueFailure = (field: string, summary: string): SteerFailure =>
  failure("input", "input.value.rejected", `${field}: ${summary}`);

const queueUnavailable = (code: string): SteerFailure =>
  failure(
    "steer",
    "steer.queue-unavailable",
    `the steering queue is unavailable (${code}); nothing is reported landed or completed`,
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringFlag = (
  flags: Readonly<Record<string, string | true>>,
  name: string,
): string | undefined => {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
};

const readOnce = (runtime: SteerCommandRuntime): SteerFailure | SteeringQueueRead => {
  const read = runtime.readQueue();
  return read.ok ? read.value : queueUnavailable(read.error.code);
};

const sendHandler = (
  runtime: SteerCommandRuntime,
  flags: Readonly<Record<string, string | true>>,
  positionals: readonly string[],
): SteerSuccess | SteerFailure => {
  if (positionals.length !== 2) {
    return invocationFailure(
      'steer send requires exactly one note text: send "<text>" [--kind ...] [--priority ...] [--ttl ...] [--ref ...]',
    );
  }
  const text = positionals[1] as string;
  const kind = stringFlag(flags, "--kind");
  const priority = stringFlag(flags, "--priority");
  const ttl = stringFlag(flags, "--ttl");
  const ref = stringFlag(flags, "--ref");
  const validated = validateSteerSend({
    text,
    ...(kind === undefined ? {} : { kind }),
    ...(priority === undefined ? {} : { priority }),
    ...(ttl === undefined ? {} : { ttl }),
    ...(ref === undefined ? {} : { ref }),
  });
  if (!validated.ok) return valueFailure(validated.field, validated.summary);
  const origin = runtime.origin();
  const guarded = evaluateSteerGuard({
    subject: validated.value.text,
    ref: validated.value.ref,
    origin,
    secrets: runtime.secrets,
  });
  if (!guarded.ok) return failure("steer", guarded.code, `${guarded.field}: ${guarded.summary}`);
  const record: SteerMessageRecord = {
    id: formatSteerMessageId(runtime.newMessageSuffix()),
    from: "owner",
    to: "delivery",
    scope: "repo",
    kind: validated.value.kind,
    subject: validated.value.text,
    ref: validated.value.ref,
    origin,
    priority: validated.value.priority,
    created: runtime.clock.nowIso(),
    ttl: validated.value.ttl,
  };
  const appended = runtime.appendMessage(record);
  if (!appended.ok) return queueUnavailable(appended.error.code);
  return { data: buildSteerSendData(record, runtime.clock.nowMs()) };
};

const listHandler = (
  runtime: SteerCommandRuntime,
  positionals: readonly string[],
): SteerSuccess | SteerFailure => {
  if (positionals.length !== 1) {
    return invocationFailure("steer list takes no positional arguments");
  }
  const read = readOnce(runtime);
  if ("error" in read) return read;
  return {
    data: buildSteerListData(
      { messages: read.messages, outcomes: read.outcomes, completions: read.completions },
      runtime.clock.nowMs(),
    ),
  };
};

const readHandler = (
  runtime: SteerCommandRuntime,
  positionals: readonly string[],
): SteerSuccess | SteerFailure => {
  if (positionals.length !== 1) {
    // Any positional on `read` is the grammar refusal, never `steer.unknown-id`.
    return invocationFailure("steer read takes no positional arguments");
  }
  const read = readOnce(runtime);
  if ("error" in read) return read;
  const phase = runtime.readPhaseFold(runtime.origin().change);
  if (!phase.ok) return queueUnavailable(phase.error.code);
  const asks = runtime.readAsks();
  if (!asks.ok) return queueUnavailable(asks.error.code);
  const plan = planSteerRead({
    records: { messages: read.messages, outcomes: read.outcomes, completions: read.completions },
    phase: phase.value,
    nowMs: runtime.clock.nowMs(),
    nowIso: runtime.clock.nowIso(),
  });
  if (plan.transitions.length > 0) {
    const appended = runtime.appendOutcomes(plan.transitions, read);
    if (!appended.ok) return queueUnavailable(appended.error.code);
  }
  return { data: buildSteerReadData(plan, asks.value) };
};

const completeHandler = (
  runtime: SteerCommandRuntime,
  flags: Readonly<Record<string, string | true>>,
  positionals: readonly string[],
): SteerSuccess | SteerFailure => {
  if (positionals.length !== 2) {
    return invocationFailure("steer complete requires exactly one id and --ref <artifact>");
  }
  const id = positionals[1] as string;
  if (id.length === 0 || id.trim().length === 0) {
    return valueFailure("id", "completion requires a steering record id");
  }
  const ref = stringFlag(flags, "--ref");
  const preValidated = validateSteerCompletion(
    { id, ...(ref === undefined ? {} : { ref }) },
    "landed",
  );
  if (!preValidated.ok) return valueFailure(preValidated.field, preValidated.summary);
  const guarded = evaluateSteerGuard({
    ref: preValidated.value.artifact,
    secrets: runtime.secrets,
  });
  if (!guarded.ok) return failure("steer", guarded.code, `${guarded.field}: ${guarded.summary}`);
  const read = readOnce(runtime);
  if ("error" in read) return read;
  const message = read.messages.find((candidate) => candidate.id === id);
  if (message === undefined) {
    return failure(
      "steer",
      "steer.unknown-id",
      "the requested id is not a steering record of this repository; run `steer list` to read the recorded ids",
    );
  }
  const lifecycle = deriveSteerLifecycle(id, read.outcomes, read.completions);
  const validated = validateSteerCompletion({ id, ref: preValidated.value.artifact }, lifecycle);
  if (!validated.ok) return valueFailure(validated.field, validated.summary);
  const record: SteerCompletionRecord = {
    schemaId: "delivery.steering.completion.v1",
    id,
    completedAt: runtime.clock.nowIso(),
    artifact: validated.value.artifact,
  };
  const appended = runtime.appendCompletion(record, read);
  if (!appended.ok) return queueUnavailable(appended.error.code);
  return { data: buildSteerCompleteData(record) };
};

const humanText = (data: unknown, brand: BrandIdentity): string | undefined => {
  if (!isRecord(data)) return undefined;
  if (isRecord(data.boundary)) return renderSteerReadHuman(data as SteerReadData, brand);
  if (Array.isArray(data.queued)) return renderSteerListHuman(data as SteerListData, brand);
  if (isRecord(data.record)) {
    if (data.lifecycle === "queued") return renderSteerSendHuman(data as SteerSendData, brand);
    if (isRecord(data.record) && data.record.lifecycle === "completed") {
      return renderSteerCompleteHuman(data as SteerCompleteData, brand);
    }
  }
  return undefined;
};

/** Build the `steer` command definition over the injected runtime. */
export const createSteerCommandDefinition = (runtime: SteerCommandRuntime): CommandDefinition => ({
  flags: [],
  requiresValue: ["--kind", "--priority", "--ttl", "--ref"],
  positionals: { max: 2 },
  humanText,
  handler: async (invocation) => {
    const positionals = invocation.positionals;
    const subcommand = positionals[0];
    if (subcommand === "send") return sendHandler(runtime, invocation.flags, positionals);
    if (subcommand === "list") return listHandler(runtime, positionals);
    if (subcommand === "read") return readHandler(runtime, positionals);
    if (subcommand === "complete") return completeHandler(runtime, invocation.flags, positionals);
    return invocationFailure("steer requires one of: send, list, read, complete");
  },
});
