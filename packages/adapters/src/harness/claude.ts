/**
 * The Claude Code delivery adapter (GH-233 F-4, AC-F4-1, DEC-4).
 *
 * Headless spawn with the prompt delivered as data, result collection, and
 * classification through the shared bound classifier. Resume/steer injection,
 * session listing, session introspection, and the liveness kinds headless mode
 * does not afford are explicit declared gaps returned before any invocation.
 * The gap carries no executable fallback instruction.
 */
import {
  HARNESS_LIVENESS_KINDS,
  type HarnessCapabilityDeclaration,
  type HarnessClassifier,
  type HarnessEnvironmentBuilder,
  type HarnessEvidence,
  type HarnessFailure,
  type HarnessInstance,
  type HarnessKind,
  type HarnessLivenessAssembler,
  type HarnessResult,
  type HarnessSessionHandle,
  type HarnessSessionPort,
  type HarnessSpawnInput,
  type HarnessSpawnRunner,
  type HarnessVersionWarning,
} from "@delivery-os/core/contracts";

/** The Claude Code capability declaration (F-1, DM-4; DEC-4). */
export const CLAUDE_CAPABILITIES: HarnessCapabilityDeclaration = {
  supportedOperations: ["spawn", "collect"],
  lifecycleCapabilities: ["headless-spawn", "telemetry-extraction"],
  livenessSources: [],
  declaredGaps: [
    { capability: "deliver", reason: "headless-mode-limitation" },
    { capability: "resume", reason: "headless-mode-limitation" },
    { capability: "steer", reason: "headless-mode-limitation" },
    { capability: "session-list", reason: "headless-mode-limitation" },
    { capability: "resume-steer-injection", reason: "headless-mode-limitation" },
    { capability: "session-introspection", reason: "headless-mode-limitation" },
    ...HARNESS_LIVENESS_KINDS.map((kind) => ({
      capability: kind,
      reason: "provider-unsupported" as const,
    })),
  ],
};

/** Build the configured Claude Code instance (injected observed version). */
export const createClaudeInstance = (input: {
  readonly kind: HarnessKind;
  readonly observedVersion: string | null;
  readonly versionWarning?: HarnessVersionWarning;
}): HarnessInstance => ({
  kind: input.kind,
  observedVersion: input.observedVersion,
  ...(input.versionWarning === undefined ? {} : { versionWarning: input.versionWarning }),
  capabilities: CLAUDE_CAPABILITIES,
});

export type ClaudeHarnessOptions = {
  readonly command: string;
  readonly runner: HarnessSpawnRunner;
  readonly buildEnvironment: HarnessEnvironmentBuilder;
  readonly classify: HarnessClassifier;
  readonly assembleLiveness: HarnessLivenessAssembler;
  readonly now: () => string;
  readonly timeoutMs?: number;
  readonly headlessArgs?: readonly string[];
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

const gap = (kind: HarnessKind, capability: string): HarnessResult<never> => ({
  ok: false,
  error: {
    kind: "harness",
    code: "harness.capability.gap",
    field: "capability",
    summary: `${kind} declares ${capability} as a capability gap`,
  },
});

const decode = (stdout: string): Record<string, unknown> | undefined => {
  try {
    const parsed: unknown = JSON.parse(stdout);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const sessionIdOf = (value: Record<string, unknown>): string | undefined => {
  if (typeof value.session_id === "string" && value.session_id.length > 0) return value.session_id;
  if (typeof value.sessionId === "string" && value.sessionId.length > 0) return value.sessionId;
  const session = isRecord(value.session) ? value.session : undefined;
  if (session !== undefined && typeof session.id === "string" && session.id.length > 0) {
    return session.id;
  }
  return undefined;
};

const evidenceOf = (
  parsed: Record<string, unknown>,
  status: number,
  timedOut: boolean,
): HarnessEvidence => {
  const subtype = parsed.subtype;
  const isError = parsed.is_error === true;
  const completionMarker = parsed.type === "result" && subtype === "success" && !isError;
  const failureReported = isError || subtype === "error" || subtype === "error_max_turns";
  return {
    completionMarker,
    exitStatus: status,
    timedOut,
    spawnRefused: parsed.refused === true,
    failureReported,
    toolFailure: parsed.tool_failure === true,
    ...(parsed.usage === undefined ? { warnings: ["optional-field-absent" as const] } : {}),
  };
};

type SessionRecord = {
  readonly handle: HarnessSessionHandle;
  readonly evidence: HarnessEvidence;
  readonly descriptor: HarnessSpawnInput["descriptor"];
};

/** Build the Claude Code session port over injected I/O seams. */
export const createClaudeSession = (options: ClaudeHarnessOptions): HarnessSessionPort => {
  const sessions = new Map<string, SessionRecord>();
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    spawn: async (input) => {
      const environment = options.buildEnvironment(input.descriptor);
      if (!environment.ok) return environment;
      const result = await options.runner(options.command, options.headlessArgs ?? [], {
        cwd: input.descriptor.workDirectory,
        env: environment.value,
        timeout,
        stdin: input.prompt,
      });
      const parsed = decode(result.stdout);
      const sessionId = parsed === undefined ? undefined : sessionIdOf(parsed);
      if (sessionId === undefined) {
        if (result.status !== 0 || result.timedOut) {
          return failure("harness.spawn.refused", {
            status: result.status,
            summary: result.timedOut
              ? "headless spawn timed out without machine-readable output"
              : "headless harness exited non-zero without machine-readable output",
          });
        }
        return failure("harness.spawn.invalid-output", {
          summary: "headless output carried no session id",
        });
      }
      const handle: HarnessSessionHandle = {
        harnessKind: "claude-code",
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
                timedOut: result.timedOut,
                spawnRefused: false,
                failureReported: false,
                toolFailure: false,
              }
            : evidenceOf(parsed, result.status, result.timedOut),
      });
      return { ok: true, value: handle };
    },
    deliver: async () => gap("claude-code", "deliver"),
    resume: async () => gap("claude-code", "resume"),
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
    liveness: async () => ({
      ok: true,
      value: options.assembleLiveness({
        sourced: [],
        absenceReasons: {
          "session-traffic": "harness-unsupported",
          "worktree-activity": "harness-unsupported",
          process: "harness-unsupported",
        },
      }),
    }),
    listSessions: async () => gap("claude-code", "session-list"),
  };
};
