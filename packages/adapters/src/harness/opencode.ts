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
  type HarnessVersionWarning,
  type EconomicsSourcedSignalReading,
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
  readonly buildEnvironment: HarnessEnvironmentBuilder;
  readonly classify: HarnessClassifier;
  readonly assembleLiveness: HarnessLivenessAssembler;
  readonly now: () => string;
  readonly timeoutMs?: number;
  readonly spawnArgs?: readonly string[];
  readonly resumeArgs?: readonly string[];
  readonly listArgs?: readonly string[];
  readonly livenessFacts?: readonly HarnessLivenessSourcedReading[];
  /** Injected sourced-signal facts (GH-235 D-3); read-only, never re-queried. */
  readonly sourcedSignals?: readonly EconomicsSourcedSignalReading[];
  readonly capabilities?: HarnessCapabilityDeclaration;
};

const DEFAULT_TIMEOUT_MS = 300_000;

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

const sessionIdOf = (value: Record<string, unknown>): string | undefined => {
  const session = isRecord(value.session) ? value.session : undefined;
  if (session !== undefined && typeof session.id === "string" && session.id.length > 0) {
    return session.id;
  }
  if (typeof value.sessionId === "string" && value.sessionId.length > 0) return value.sessionId;
  if (typeof value.id === "string" && value.id.length > 0) return value.id;
  return undefined;
};

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

type SessionRecord = {
  readonly handle: HarnessSessionHandle;
  readonly evidence: HarnessEvidence;
  readonly descriptor: HarnessSpawnInput["descriptor"];
};

/** Build the opencode session port over injected I/O seams. */
export const createOpencodeSession = (options: OpencodeHarnessOptions): HarnessSessionPort => {
  const sessions = new Map<string, SessionRecord>();
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const capabilities = options.capabilities ?? OPENCODE_CAPABILITIES;

  const run = async (
    input: HarnessSpawnInput,
    args: readonly string[],
    stdin: string,
  ): Promise<HarnessResult<HarnessSessionHandle>> => {
    const environment = options.buildEnvironment(input.descriptor);
    if (!environment.ok) return environment;
    const result = await options.runner(options.command, args, {
      cwd: input.descriptor.workDirectory,
      env: environment.value,
      timeout,
      stdin,
    });
    let parsed: Record<string, unknown> | undefined;
    try {
      const decoded: unknown = JSON.parse(result.stdout);
      if (isRecord(decoded)) parsed = decoded;
    } catch {
      parsed = undefined;
    }
    const sessionId = parsed === undefined ? undefined : sessionIdOf(parsed);
    if (sessionId === undefined) {
      if (result.status !== 0 || result.timedOut) {
        return failure("harness.spawn.refused", {
          status: result.status,
          summary: result.timedOut
            ? "harness spawn timed out without machine-readable output"
            : "harness exited non-zero without machine-readable output",
        });
      }
      return failure("harness.spawn.invalid-output", {
        summary: "harness spawn output carried no session id",
      });
    }
    const handle: HarnessSessionHandle = {
      harnessKind: "opencode",
      sessionId,
      treeRoot: sessionId,
      workItemRef: input.workItemRef,
    };
    sessions.set(sessionId, {
      handle,
      descriptor: input.descriptor,
      evidence:
        parsed === undefined
          ? {
              completionMarker: false,
              exitStatus: result.status,
              timedOut: false,
              spawnRefused: false,
              failureReported: false,
              toolFailure: false,
            }
          : { ...evidenceOf(parsed), exitStatus: result.status, timedOut: result.timedOut },
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
    const result = await options.runner(
      options.command,
      [...(options.resumeArgs ?? []), input.handle.sessionId],
      {
        cwd: descriptor.workDirectory,
        env: environment.value,
        timeout,
        stdin: input.prompt,
      },
    );
    if (result.timedOut || result.status !== 0) {
      return failure("harness.session.unknown", {
        status: result.status,
        summary: "resume target is unknown or refused",
      });
    }
    if (record !== undefined) {
      sessions.set(input.handle.sessionId, {
        handle: { ...record.handle, treeRoot: input.handle.treeRoot },
        evidence: record.evidence,
        descriptor: record.descriptor,
      });
    }
    return {
      ok: true,
      value: { ...input.handle, treeRoot: record?.handle.treeRoot ?? input.handle.treeRoot },
    };
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
      return { ok: true, value: record.evidence };
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
