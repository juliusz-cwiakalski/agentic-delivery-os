/**
 * Pure capsule rules (GH-240 F-1, F-2, F-11; DEC-3; NFR-5, NFR-11).
 *
 * Deterministic functions of injected strings and declared contract data. No
 * filesystem, clock, randomness, or network access; the file runtime in the
 * `./file` adapter reads bytes and delegates validation here.
 */
import {
  CAPSULE_CANDIDATE_CLASSES,
  CAPSULE_CANDIDATE_STATUSES,
  CAPSULE_ENVELOPE_KEYS,
  type CapsuleAppendResult,
  type CapsuleDisclosure,
  type CapsuleEvent,
  type CapsuleEventKind,
  CAPSULE_EVENT_KINDS,
  CAPSULE_MAX_EVENT_PAYLOAD_BYTES,
  CAPSULE_MAX_BYTES,
  CAPSULE_MAX_EVENTS,
  CAPSULE_PAYLOAD_FIELDS,
  CAPSULE_SCHEMA_ID,
  CAPSULE_WRITERS,
  type CapsulePayload,
  type CapsuleReadResult,
  type CapsuleRefusalCode,
  type CapsuleReviewArtifact,
  type CloseoutExpectedCapsuleEvent,
  type CapsuleWriter,
} from "#contracts";
import { sha256Hex } from "./sha256.js";

/** Whether a value is one of the eleven closed event kinds. */
export const isCapsuleEventKind = (value: string): value is CapsuleEventKind =>
  (CAPSULE_EVENT_KINDS as readonly string[]).includes(value);

/** Whether a value is one of the four closed writer identities. */
export const isCapsuleWriter = (value: string): value is CapsuleWriter =>
  (CAPSULE_WRITERS as readonly string[]).includes(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const utf8Bytes = (text: string): number => new TextEncoder().encode(text).length;

/** Canonical JSON with sorted object keys (deterministic across engines). */
export const canonicalCapsuleJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalCapsuleJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalCapsuleJson(record[key])}`).join(",")}}`;
};

/**
 * Validate a payload against its kind's declared field set.
 *
 * Returns a human-readable violation list; an empty list is valid. Unknown
 * keys, missing required keys, and non-object payloads are all violations.
 */
export const payloadFieldViolations = (kind: CapsuleEventKind, payload: unknown): string[] => {
  if (!isRecord(payload)) return ["payload is not an object"];
  const declared = CAPSULE_PAYLOAD_FIELDS[kind];
  const allowed = new Set<string>([...declared.required, ...declared.optional]);
  const violations: string[] = [];
  for (const key of declared.required) {
    if (!Object.hasOwn(payload, key)) violations.push(`missing required payload key ${key}`);
  }
  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) violations.push(`undeclared payload key ${key}`);
  }
  return violations;
};

/** Serialize one event as one LF-terminated JSON line (F-1, LF framing). */
export const serializeCapsuleEvent = (event: CapsuleEvent): string => `${JSON.stringify(event)}\n`;

/** Parse and validate a whole `events.jsonl` text without writing anything. */
export const parseCapsuleEvents = (text: string): CapsuleReadResult => {
  if (text.length === 0) return { ok: true, events: [], bytes: 0 };
  const bytes = utf8Bytes(text);
  if (text.includes("\r")) {
    return {
      ok: false,
      code: "capsule.malformed-line",
      detail: "CRLF framing is not valid capsule framing",
      line: text.slice(0, text.indexOf("\r")).split("\n").length,
    };
  }
  if (!text.endsWith("\n")) {
    const line = text.split("\n").length;
    return {
      ok: false,
      code: "capsule.torn-tail",
      detail: "the final line is not LF-terminated",
      line,
    };
  }
  const lines = text.slice(0, -1).split("\n");
  const events: CapsuleEvent[] = [];
  const keys = new Set<string>();
  let closedAtLine: number | undefined;
  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    if (closedAtLine !== undefined) {
      return {
        ok: false,
        code: "capsule.post-close",
        detail: `a line follows the terminal capsule.closed event`,
        line: lineNumber,
      };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      return {
        ok: false,
        code: "capsule.malformed-line",
        detail: "the line is not valid JSON",
        line: lineNumber,
      };
    }
    if (!isRecord(parsed)) {
      return {
        ok: false,
        code: "capsule.malformed-line",
        detail: "the line is not a JSON object",
        line: lineNumber,
      };
    }
    const envelopeKeys = Object.keys(parsed).sort();
    const expectedKeys = [...CAPSULE_ENVELOPE_KEYS].sort();
    if (envelopeKeys.join("|") !== expectedKeys.join("|")) {
      return {
        ok: false,
        code: "capsule.malformed-line",
        detail: "the envelope key set is not the declared set",
        line: lineNumber,
      };
    }
    if (parsed.schemaId !== CAPSULE_SCHEMA_ID) {
      return {
        ok: false,
        code: "capsule.malformed-line",
        detail: "the schema id is not the capsule event schema",
        line: lineNumber,
      };
    }
    if (typeof parsed.sequence !== "number" || parsed.sequence !== lineNumber) {
      return {
        ok: false,
        code: "capsule.sequence-gap",
        detail: `expected sequence ${lineNumber}`,
        line: lineNumber,
      };
    }
    if (typeof parsed.eventKey !== "string" || parsed.eventKey.length === 0) {
      return {
        ok: false,
        code: "capsule.malformed-line",
        detail: "the event key is missing",
        line: lineNumber,
      };
    }
    if (keys.has(parsed.eventKey)) {
      return {
        ok: false,
        code: "capsule.duplicate-key",
        detail: `duplicate event key ${parsed.eventKey}`,
        line: lineNumber,
      };
    }
    keys.add(parsed.eventKey);
    if (typeof parsed.kind !== "string" || !isCapsuleEventKind(parsed.kind)) {
      return {
        ok: false,
        code: "capsule.invalid-vocabulary",
        detail: "the event kind is outside the closed vocabulary",
        line: lineNumber,
      };
    }
    if (typeof parsed.writer !== "string" || !isCapsuleWriter(parsed.writer)) {
      return {
        ok: false,
        code: "capsule.invalid-vocabulary",
        detail: "the writer is outside the closed vocabulary",
        line: lineNumber,
      };
    }
    if (typeof parsed.workItemRef !== "string" || typeof parsed.runId !== "string") {
      return {
        ok: false,
        code: "capsule.malformed-line",
        detail: "the work item ref or run id is missing",
        line: lineNumber,
      };
    }
    if (typeof parsed.occurredAt !== "string" || parsed.occurredAt.length === 0) {
      return {
        ok: false,
        code: "capsule.malformed-line",
        detail: "the occurred-at timestamp is missing",
        line: lineNumber,
      };
    }
    const payloadViolations = payloadFieldViolations(parsed.kind, parsed.payload);
    if (payloadViolations.length > 0) {
      return {
        ok: false,
        code: "capsule.invalid-vocabulary",
        detail: payloadViolations.join("; "),
        line: lineNumber,
      };
    }
    if (utf8Bytes(JSON.stringify(parsed.payload)) > CAPSULE_MAX_EVENT_PAYLOAD_BYTES) {
      return {
        ok: false,
        code: "capsule.payload-cap",
        detail: `the payload exceeds ${CAPSULE_MAX_EVENT_PAYLOAD_BYTES} bytes`,
        line: lineNumber,
      };
    }
    const event = parsed as unknown as CapsuleEvent;
    events.push(event);
    if (event.kind === "capsule.closed") closedAtLine = lineNumber;
  }
  if (events.length > 0 && events[0]?.kind !== "capsule.opened") {
    return {
      ok: false,
      code: "capsule.invalid-vocabulary",
      detail: "the first event must be capsule.opened",
      line: 1,
    };
  }
  return { ok: true, events, bytes };
};

/**
 * The bounded capsule digest: lowercase SHA-256 hex over the canonical JSON of
 * the pre-close event payloads (F-3, D-3). Never includes the close event.
 */
export const capsuleDigest = (events: readonly CapsuleEvent[]): string =>
  sha256Hex(
    canonicalCapsuleJson(
      events.filter((event) => event.kind !== "capsule.closed").map((e) => e.payload),
    ),
  );

/** Derive a deterministic event key from identity parts (F-2). */
export const deriveCapsuleEventKey = (parts: readonly (string | number | undefined)[]): string =>
  sha256Hex(parts.map((part) => (part === undefined ? "" : String(part))).join("\u0000"));

/**
 * The phase-transition event key: change + phase + operation + commit SHA.
 *
 * A no-commit transition uses its persisted transition identity (the phase
 * record timestamp) as the discriminator, so distinct transitions stay distinct
 * while a re-run of the same landed transition is a no-op (F-2, F-18).
 */
export const capsulePhaseEventKey = (input: {
  readonly changeRef: string;
  readonly phaseId: string;
  readonly operation: string;
  readonly commitSha?: string;
  readonly transitionId?: string;
}): string =>
  deriveCapsuleEventKey([
    input.changeRef,
    input.phaseId,
    input.operation,
    input.commitSha ?? input.transitionId,
  ]);

/** The gate-outcome event key: gate-set identity + head SHA (F-2). */
export const capsuleGateEventKey = (gateSet: string, headSha: string): string =>
  deriveCapsuleEventKey([gateSet, headSha]);

/** The candidate vocabulary checks used by the candidate evaluator (F-4). */
export const isCapsuleCandidateClass = (value: unknown): boolean =>
  typeof value === "string" && (CAPSULE_CANDIDATE_CLASSES as readonly string[]).includes(value);

/** Whether a value is one of the three candidate statuses. */
export const isCapsuleCandidateStatus = (value: unknown): boolean =>
  typeof value === "string" && (CAPSULE_CANDIDATE_STATUSES as readonly string[]).includes(value);

/** Build the classified refusal an append path returns (never a throw). */
export const capsuleRefusal = (
  code: CapsuleRefusalCode,
  detail: string,
  extra: { readonly cap?: number; readonly refused?: number; readonly retryable?: boolean } = {},
): CapsuleAppendResult => ({
  ok: false,
  code,
  detail,
  ...(extra.cap === undefined ? {} : { cap: extra.cap }),
  ...(extra.refused === undefined ? {} : { refused: extra.refused }),
  ...(extra.retryable === undefined ? {} : { retryable: extra.retryable }),
});

/** One readable review verdict and the artifact it came from (F-3). */
export type CapsuleReviewIngestion = {
  readonly verdicts: readonly {
    readonly iteration: number;
    readonly verdict: string;
    readonly artifact: string;
  }[];
  readonly unreadable: readonly string[];
};

/**
 * Ingest `review-iter-*.yaml` artifacts as review verdicts (F-3).
 *
 * A readable artifact contributes one verdict; a missing iteration/status line
 * or an unreadable file is named as unreadable residue, never capsule damage.
 */
export const ingestReviewArtifacts = (
  artifacts: readonly CapsuleReviewArtifact[],
): CapsuleReviewIngestion => {
  const verdicts: CapsuleReviewIngestion["verdicts"][number][] = [];
  const unreadable: string[] = [];
  for (const artifact of artifacts) {
    if (!artifact.readable) {
      unreadable.push(artifact.name);
      continue;
    }
    const iteration = /^iteration:\s*(\d+)\s*$/m.exec(artifact.text);
    const status = /^status:\s*([A-Za-z][A-Za-z-]*)\s*$/m.exec(artifact.text);
    if (
      iteration === null ||
      status === null ||
      iteration[1] === undefined ||
      status[1] === undefined
    ) {
      unreadable.push(artifact.name);
      continue;
    }
    verdicts.push({
      iteration: Number(iteration[1]),
      verdict: status[1],
      artifact: artifact.name,
    });
  }
  verdicts.sort((left, right) => left.iteration - right.iteration);
  return { verdicts, unreadable };
};

/** The expected capsule events that are absent, in declared order (F-3). */
export const capsuleEventGaps = (
  events: readonly CapsuleEvent[],
  expected: readonly CloseoutExpectedCapsuleEvent[],
): readonly CloseoutExpectedCapsuleEvent[] => {
  const present = new Set(events.map((event) => event.eventKey));
  return expected.filter((entry) => !present.has(entry.eventKey));
};

/** The promotion decision counts from the durable promotion events (EVT-2). */
export const capsulePromotionCounts = (
  events: readonly CapsuleEvent[],
): { readonly promoted: number; readonly rejected: number } => {
  let promoted = 0;
  let rejected = 0;
  for (const event of events) {
    if (event.kind !== "capsule.promotion") continue;
    if (event.payload.decision === "promoted") promoted += 1;
    else if (event.payload.decision === "rejected") rejected += 1;
  }
  return { promoted, rejected };
};

/** Project an append result into the bounded non-gating disclosure (F-2). */
export const capsuleDisclosureOf = (
  result: CapsuleAppendResult,
  eventKey: string,
): CapsuleDisclosure =>
  result.ok
    ? {
        appended: result.appended,
        eventKey,
        ...(result.reason === undefined ? {} : { detail: result.reason }),
      }
    : {
        appended: false,
        eventKey,
        code: result.code,
        ...(result.retryable === undefined ? {} : { retryable: result.retryable }),
        detail: result.detail,
      };

/** Capsule growth caps, read by the tests and the appender (NFR-2). */
export const capsuleCaps = {
  events: CAPSULE_MAX_EVENTS,
  bytes: CAPSULE_MAX_BYTES,
  payloadBytes: CAPSULE_MAX_EVENT_PAYLOAD_BYTES,
} as const;

/** Whether an append would breach a capsule cap; returns the breached code. */
export const capsuleCapBreach = (input: {
  readonly eventCount: number;
  readonly bytes: number;
  readonly lineBytes: number;
}): CapsuleRefusalCode | undefined => {
  if (input.eventCount + 1 > CAPSULE_MAX_EVENTS) return "capsule.event-cap";
  if (input.bytes + input.lineBytes > CAPSULE_MAX_BYTES) return "capsule.byte-cap";
  return undefined;
};

/** An empty payload for a kind that carries no fields yet (test/support helper). */
export const emptyCapsulePayload: CapsulePayload = {};
