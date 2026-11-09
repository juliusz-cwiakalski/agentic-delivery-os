/**
 * The opencode delivery adapter (GH-233 F-3, AC-F3-1, DEC-10).
 *
 * Spawns with machine-readable output, delivers the prompt as data, maps the
 * session id to the work item as the tree root, resumes the existing session
 * with the steering payload verbatim, lists sessions read-only, sources the
 * declared liveness kinds, and normalizes every outcome into the neutral
 * evidence shape. It never classifies with its own logic: the classifier is the
 * shared bound reference injected by composition.
 */
import {
  ECONOMICS_SOURCED_SIGNAL_KINDS,
  type EconomicsSourcedSignalReading,
  HARNESS_LIFECYCLE_CAPABILITIES,
  HARNESS_LIVENESS_KINDS,
  HARNESS_MAX_SESSIONS,
  HARNESS_OPERATIONS,
  type HarnessCapabilityDeclaration,
  type HarnessClassifier,
  type HarnessEnvironmentBuilder,
  type HarnessEvidence,
  type HarnessFailure,
  type HarnessInstance,
  type HarnessKind,
  type HarnessListInput,
  type HarnessLivenessAssembler,
  type HarnessLivenessKind,
  type HarnessLivenessSourcedReading,
  type HarnessResult,
  type HarnessResumeInput,
  type HarnessSessionHandle,
  type HarnessSessionPort,
  type HarnessSpawnInput,
  type HarnessSpawnRunner,
  type HarnessSpawnRunnerResult,
  type HarnessSpawnStarter,
  type HarnessSpawnStream,
  type HarnessSpawnStreamOptions,
  type HarnessVersionWarning,
} from "@delivery-os/core/contracts";

/** The opencode capability declaration (F-1, DM-4). */
export const OPENCODE_CAPABILITIES: HarnessCapabilityDeclaration = {
  supportedOperations: [...HARNESS_OPERATIONS],
  lifecycleCapabilities: [...HARNESS_LIFECYCLE_CAPABILITIES],
  livenessSources: ["session-traffic", "process"],
  declaredGaps: [{ capability: "worktree-activity", reason: "provider-unsupported" }],
  sourcedSignalSources: ["heartbeat-age", "token-delta"],
};

/** Build the configured opencode instance (injected observed version). */
export const createOpencodeInstance = (input: {
  readonly kind: HarnessKind;
  readonly observedVersion: string | null;
  readonly versionWarning?: HarnessVersionWarning;
}): HarnessInstance => ({
  kind: input.kind,
  observedVersion: input.observedVersion,
  ...(input.versionWarning === undefined ? {} : { versionWarning: input.versionWarning }),
  capabilities: OPENCODE_CAPABILITIES,
});

export type OpencodeHarnessOptions = {
  readonly command: string;
  readonly runner: HarnessSpawnRunner;
  /** The streaming spawn seam (GH-275 DEC-1); required so a spawn is never completion-gated. */
  readonly starter: HarnessSpawnStarter;
  readonly buildEnvironment: HarnessEnvironmentBuilder;
  readonly classify: HarnessClassifier;
  readonly assembleLiveness: HarnessLivenessAssembler;
  readonly now: () => string;
  /** The one-shot listing timeout; never applied to a spawn or resume stream. */
  readonly timeoutMs?: number;
  /** The handle-acquisition bound; defaults to 60_000 ms. */
  readonly handleTimeoutMs?: number;
  /** An optional whole-session bound; absent or 0 means unbounded. */
  readonly sessionTimeoutMs?: number;
  readonly spawnArgs?: readonly string[];
  readonly resumeArgs?: readonly string[];
  readonly listArgs?: readonly string[];
  readonly livenessFacts?: readonly HarnessLivenessSourcedReading[];
  /** Injected sourced-signal facts (GH-235 D-3); read-only, never re-queried. */
  readonly sourcedSignals?: readonly EconomicsSourcedSignalReading[];
  readonly capabilities?: HarnessCapabilityDeclaration;
};

const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_HANDLE_TIMEOUT_MS = 60_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const failure = (
  code: HarnessFailure["code"],
  input: { summary?: string; status?: number; field?: string },
): HarnessResult<never> => ({
  ok: false,
  error: {
    kind: "harness",
    code,
    ...(input.summary === undefined ? {} : { summary: input.summary }),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.field === undefined ? {} : { field: input.field }),
  },
});

/**
 * The session identifier precedence (GH-275 DEC-4): the real CLI's top-level
 * `sessionID` first, then the previously accepted fallback shapes. An
 * empty-string identifier is not an identifier.
 */
const sessionIdOf = (value: Record<string, unknown>): string | undefined => {
  if (typeof value.sessionID === "string" && value.sessionID.length > 0) return value.sessionID;
  const session = isRecord(value.session) ? value.session : undefined;
  if (session !== undefined && typeof session.id === "string" && session.id.length > 0) {
    return session.id;
  }
  if (typeof value.sessionId === "string" && value.sessionId.length > 0) return value.sessionId;
  if (typeof value.id === "string" && value.id.length > 0) return value.id;
  return undefined;
};

/** Parse one JSONL line independently; blank, non-JSON, and non-object lines are skipped. */
const decodeLine = (line: string): Record<string, unknown> | undefined => {
  const withoutCr = line.endsWith("\r") ? line.slice(0, -1) : line;
  if (withoutCr.trim().length === 0) return undefined;
  try {
    const decoded: unknown = JSON.parse(withoutCr);
    return isRecord(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
};

/** The delivered legacy-envelope evidence mapping (unchanged). */
const evidenceOf = (parsed: Record<string, unknown>): HarnessEvidence => {
  const result = isRecord(parsed.result) ? parsed.result : {};
  const completion = result.completion;
  return {
    completionMarker: completion === "complete" || result.completed === true,
    exitStatus: null,
    timedOut: false,
    spawnRefused: result.refused === true,
    failureReported: result.failure === true || result.status === "failed",
    toolFailure: result.toolFailure === true,
  };
};

/**
 * A decoded line is a legacy single-document envelope when it carries a
 * `result` object, or one of the accepted identifier-only shapes without the
 * real CLI's top-level `sessionID` (GH-275 F-4/DEC-5).
 */
const isLegacyEnvelope = (parsed: Record<string, unknown>): boolean => {
  if (isRecord(parsed.result)) return true;
  return typeof parsed.sessionID !== "string" && sessionIdOf(parsed) !== undefined;
};

/** The stream facts accumulated while acquiring and draining the stdout stream. */
type StreamFacts = {
  legacyEnvelope: Record<string, unknown> | undefined;
  finalStepReason: string | undefined;
  toolFailure: boolean;
  failureReported: boolean;
};

const emptyFacts = (): StreamFacts => ({
  legacyEnvelope: undefined,
  finalStepReason: undefined,
  toolFailure: false,
  failureReported: false,
});

/** Accumulate the terminal evidence facts from one decoded line. */
const accumulate = (facts: StreamFacts, parsed: Record<string, unknown>): void => {
  if (facts.legacyEnvelope === undefined && isLegacyEnvelope(parsed)) {
    facts.legacyEnvelope = parsed;
  }
  if (parsed.type === "step_finish") {
    const part = isRecord(parsed.part) ? parsed.part : {};
    facts.finalStepReason = typeof part.reason === "string" ? part.reason : undefined;
  }
  if (parsed.type === "tool_use") {
    const part = isRecord(parsed.part) ? parsed.part : {};
    const state = isRecord(part.state) ? part.state : {};
    if (state.status === "error") facts.toolFailure = true;
  }
  if (parsed.type === "error") facts.failureReported = true;
};

/** Derive completion-scoped evidence from the accumulated facts and host result. */
const evidenceFrom = (facts: StreamFacts, result: HarnessSpawnRunnerResult): HarnessEvidence => {
  if (facts.legacyEnvelope !== undefined) {
    return {
      ...evidenceOf(facts.legacyEnvelope),
      exitStatus: result.status,
      timedOut: result.timedOut,
    };
  }
  return {
    completionMarker: facts.finalStepReason === "stop" && result.status === 0 && !result.timedOut,
    exitStatus: result.status,
    timedOut: result.timedOut,
    spawnRefused: false,
    failureReported: facts.failureReported,
    toolFailure: facts.toolFailure,
  };
};

type AcquisitionOutcome =
  | {
      readonly kind: "acquired";
      readonly sessionId: string;
      readonly completion: Promise<HarnessEvidence>;
    }
  | { readonly kind: "mismatch" }
  | { readonly kind: "absent"; readonly result: HarnessSpawnRunnerResult };

/**
 * Decode the stream and acquire the first identified session line (GH-275 F-1,
 * F-2, DEC-4). On acquisition it returns immediately with a completion promise
 * that keeps draining the stream and resolves only when the process closes.
 */
const acquireFromStream = async (
  stream: HarnessSpawnStream,
  accept: (sessionId: string) => boolean,
): Promise<AcquisitionOutcome> => {
  const facts = emptyFacts();
  let observedId: string | undefined;
  let acquisitionSettled = false;
  let resolveAcquisition: (() => void) | undefined;
  const acquisition = new Promise<void>((resolve) => {
    resolveAcquisition = resolve;
  });
  const settleAcquisition = (): void => {
    if (acquisitionSettled) return;
    acquisitionSettled = true;
    resolveAcquisition?.();
  };

  const pump = (async (): Promise<void> => {
    try {
      for await (const line of stream.lines) {
        const parsed = decodeLine(line);
        if (parsed === undefined) continue;
        accumulate(facts, parsed);
        if (observedId !== undefined) continue;
        const candidate = sessionIdOf(parsed);
        if (candidate === undefined) continue;
        observedId = candidate;
        settleAcquisition();
        if (!accept(candidate)) return;
        stream.acquired();
      }
    } finally {
      settleAcquisition();
    }
  })();

  const completion = (async (): Promise<HarnessEvidence> => {
    await pump;
    return evidenceFrom(facts, await stream.completion);
  })();

  await acquisition;
  if (observedId !== undefined) {
    return accept(observedId)
      ? { kind: "acquired", sessionId: observedId, completion }
      : { kind: "mismatch" };
  }
  return { kind: "absent", result: await stream.completion };
};

type SessionRecord = {
  readonly handle: HarnessSessionHandle;
  readonly descriptor: HarnessSpawnInput["descriptor"];
  readonly completion: Promise<HarnessEvidence>;
};

/** Build the opencode session port over injected I/O seams. */
export const createOpencodeSession = (options: OpencodeHarnessOptions): HarnessSessionPort => {
  const sessions = new Map<string, SessionRecord>();
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const capabilities = options.capabilities ?? OPENCODE_CAPABILITIES;

  /** The stream options a spawn, resume, or deliver hands to the starter as data. */
  const streamOptions = (
    cwd: string,
    env: Readonly<Record<string, string>>,
    stdin?: string,
  ): HarnessSpawnStreamOptions => ({
    cwd,
    env,
    ...(stdin === undefined ? {} : { stdin }),
    handleTimeoutMs: options.handleTimeoutMs ?? DEFAULT_HANDLE_TIMEOUT_MS,
    ...(options.sessionTimeoutMs === undefined
      ? {}
      : { sessionTimeoutMs: options.sessionTimeoutMs }),
  });

  const run = async (
    input: HarnessSpawnInput,
    args: readonly string[],
    stdin: string,
  ): Promise<HarnessResult<HarnessSessionHandle>> => {
    const environment = options.buildEnvironment(input.descriptor);
    if (!environment.ok) return environment;
    const stream = options.starter(
      options.command,
      args,
      streamOptions(input.descriptor.workDirectory, environment.value, stdin),
    );
    const outcome = await acquireFromStream(stream, () => true);
    if (outcome.kind !== "acquired") {
      stream.kill();
      const result = outcome.kind === "absent" ? outcome.result : undefined;
      if (result !== undefined && (result.status !== 0 || result.timedOut)) {
        return failure("harness.spawn.refused", {
          status: result.status,
          summary: result.timedOut
            ? "harness spawn timed out waiting for the session identifier (acquisition timeout)"
            : "harness exited non-zero without machine-readable output",
        });
      }
      return failure("harness.spawn.invalid-output", {
        summary: "harness spawn output carried no session id",
      });
    }
    const handle: HarnessSessionHandle = {
      harnessKind: "opencode",
      sessionId: outcome.sessionId,
      treeRoot: outcome.sessionId,
      workItemRef: input.workItemRef,
    };
    sessions.set(outcome.sessionId, {
      handle,
      descriptor: input.descriptor,
      completion: outcome.completion,
    });
    return { ok: true, value: handle };
  };

  const gap = (capability: string): HarnessResult<never> => ({
    ok: false,
    error: {
      kind: "harness",
      code: "harness.capability.gap",
      field: "capability",
      summary: `opencode does not declare ${capability}`,
    },
  });

  const resume = async (
    input: HarnessResumeInput,
  ): Promise<HarnessResult<HarnessSessionHandle>> => {
    if (!capabilities.supportedOperations.includes("resume")) {
      return gap("resume");
    }
    const record = sessions.get(input.handle.sessionId);
    const descriptor = record?.descriptor ?? input.descriptor;
    if (descriptor === undefined) {
      return failure("harness.session.unknown", {
        summary: `session ${input.handle.sessionId} has no declared execution environment`,
      });
    }
    const environment = options.buildEnvironment(descriptor);
    if (!environment.ok) return environment;
    const stream = options.starter(
      options.command,
      [...(options.resumeArgs ?? []), input.handle.sessionId],
      streamOptions(descriptor.workDirectory, environment.value, input.prompt),
    );
    const outcome = await acquireFromStream(
      stream,
      (sessionId) => sessionId === input.handle.sessionId,
    );
    if (outcome.kind === "mismatch") {
      stream.kill();
      return failure("harness.session.unknown", {
        summary: "resumed stream identified a different session than the caller's handle",
      });
    }
    if (outcome.kind === "absent") {
      stream.kill();
      return failure("harness.session.unknown", {
        status: outcome.result.status,
        summary: outcome.result.timedOut
          ? "harness resume timed out waiting for the session identifier (acquisition timeout)"
          : "resume target is unknown or refused",
      });
    }
    const handle: HarnessSessionHandle = {
      ...input.handle,
      treeRoot: record?.handle.treeRoot ?? input.handle.treeRoot,
    };
    if (record !== undefined) {
      sessions.set(input.handle.sessionId, {
        handle,
        descriptor: record.descriptor,
        completion: outcome.completion,
      });
    }
    return { ok: true, value: handle };
  };

  return {
    spawn: (input) => run(input, options.spawnArgs ?? [], input.prompt),
    deliver: resume,
    resume,
    collect: async (input) => {
      const record = sessions.get(input.handle.sessionId);
      if (record === undefined) {
        return failure("harness.session.unknown", {
          summary: `session ${input.handle.sessionId} has no collected facts`,
        });
      }
      return { ok: true, value: await record.completion };
    },
    classify: options.classify,
    liveness: async () => {
      const facts = options.livenessFacts ?? [];
      const declared = capabilities.livenessSources;
      const sourced = facts.filter((fact) => declared.includes(fact.kind));
      const absenceReasons = Object.fromEntries(
        HARNESS_LIVENESS_KINDS.filter((kind) => !declared.includes(kind)).map((kind) => [
          kind,
          "harness-unsupported",
        ]),
      ) as Partial<Record<HarnessLivenessKind, "harness-unsupported" | "not-observed">>;
      const declaredSourcedSignals = capabilities.sourcedSignalSources ?? [];
      const sourcedSignalFacts = (options.sourcedSignals ?? []).filter(
        (fact) => fact.status === "sourced" && declaredSourcedSignals.includes(fact.kind),
      );
      const sourcedSignalAbsenceReasons = Object.fromEntries(
        ECONOMICS_SOURCED_SIGNAL_KINDS.filter((kind) => !declaredSourcedSignals.includes(kind)).map(
          (kind) => [kind, "harness-unsupported"],
        ),
      ) as Partial<
        Record<
          (typeof ECONOMICS_SOURCED_SIGNAL_KINDS)[number],
          "harness-unsupported" | "not-observed"
        >
      >;
      return {
        ok: true,
        value: options.assembleLiveness({
          sourced,
          absenceReasons,
          sourcedSignalFacts,
          sourcedSignalAbsenceReasons,
        }),
      };
    },
    listSessions: async (input: HarnessListInput) => {
      if (!capabilities.supportedOperations.includes("session-list")) {
        return gap("session-list");
      }
      const descriptor = input.descriptor;
      if (descriptor === undefined) {
        return failure("harness.listing.invalid-output", {
          summary: "session listing requires a declared execution environment",
        });
      }
      const environment = options.buildEnvironment(descriptor);
      if (!environment.ok) return environment;
      const result = await options.runner(options.command, options.listArgs ?? [], {
        cwd: descriptor.workDirectory,
        env: environment.value,
        timeout,
      });
      if (result.timedOut || result.status !== 0) {
        return failure("harness.listing.invalid-output", {
          status: result.status,
          summary: "session listing exited non-zero",
        });
      }
      let decoded: unknown;
      try {
        decoded = JSON.parse(result.stdout);
      } catch {
        return failure("harness.listing.invalid-output", {
          summary: "session listing output was not JSON",
        });
      }
      const entries = Array.isArray(decoded)
        ? decoded
        : isRecord(decoded) && Array.isArray(decoded.sessions)
          ? decoded.sessions
          : undefined;
      if (entries === undefined) {
        return failure("harness.listing.invalid-output", {
          summary: "session listing output carried no session array",
        });
      }
      const handles: HarnessSessionHandle[] = [];
      for (const entry of entries) {
        if (!isRecord(entry)) {
          return failure("harness.listing.invalid-output", {
            summary: "a session listing entry was not an object",
          });
        }
        const sessionId = sessionIdOf(entry);
        if (sessionId === undefined) {
          return failure("harness.listing.invalid-output", {
            summary: "a session listing entry carried no session id",
          });
        }
        const treeRoot =
          typeof entry.treeRoot === "string" && entry.treeRoot.length > 0
            ? entry.treeRoot
            : typeof entry.parentId === "string" && entry.parentId.length > 0
              ? entry.parentId
              : sessionId;
        handles.push({
          harnessKind: "opencode",
          sessionId,
          treeRoot,
          workItemRef: input.workItemRef,
        });
      }
      const cap = HARNESS_MAX_SESSIONS;
      if (handles.length <= cap) return { ok: true, value: { handles } };
      return {
        ok: true,
        value: {
          handles: handles.slice(0, cap),
          truncation: { truncated: true, omitted: handles.length - cap, cap },
        },
      };
    },
  };
};
