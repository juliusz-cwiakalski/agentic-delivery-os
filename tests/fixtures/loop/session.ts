/**
 * The scripted loop session port (GH-348 F-2, F-6; TC-SPAWN-*, TC-INSTANCE-*).
 *
 * Every effect is recorded: spawn, resume, join, and the exact argv-shaped
 * facts the supervisor handed to the adapter. Modes cover a pid-present adapter,
 * a pid-absent adapter (never fabricated), a live recorded session, an ended
 * session, and a refused pre-session call. Nothing spawns a real process.
 */
import type { LoopSessionEffect, LoopSessionFacts } from "../../../packages/core/src/app/index";

export type SpawnCall = {
  readonly title: string;
  readonly prompt: string;
};

export type ResumeCall = {
  readonly sessionId: string;
  readonly prompt: string;
};

export type ScriptedSessionOptions = {
  /** The recorded facts the port reports before any effect. */
  readonly facts?: Partial<LoopSessionFacts>;
  /** The pid a fresh spawn reports; `null` models a pid-absent adapter. */
  readonly spawnPid?: number | null;
  /** The platform start time a fresh spawn reports. */
  readonly spawnStartTimeMs?: number | null;
  readonly harnessKind?: string;
  /** A pre-session refusal identity the spawn returns instead of a session. */
  readonly spawnFailure?: string;
  /** A refusal identity the resume returns. */
  readonly resumeFailure?: string;
  /** Whether a successful effect is observed as a live session afterwards. */
  readonly effectMakesAlive?: boolean;
};

export type ScriptedSession = {
  readonly spawns: readonly SpawnCall[];
  readonly resumes: readonly ResumeCall[];
  readonly joins: number;
  facts: () => LoopSessionFacts;
  port: {
    readonly read: () => LoopSessionFacts;
    readonly spawn: (input: {
      readonly title: string;
      readonly prompt: string;
    }) => Promise<LoopSessionEffect>;
    readonly resume: (input: {
      readonly sessionId: string;
      readonly prompt: string;
    }) => Promise<LoopSessionEffect>;
    readonly join: () => Promise<LoopSessionEffect>;
  };
  setFacts: (overrides: Partial<LoopSessionFacts>) => void;
  /** The spawn fact set, mirrored so a test can assert the recorded identity. */
  lastSpawnFacts: () => {
    readonly sessionId: string;
    readonly pid: number | null;
    readonly processStartTimeMs: number | null;
    readonly title: string | null;
    readonly harnessKind: string;
  } | null;
};

let sessionCounter = 0;

export const createScriptedSession = (options: ScriptedSessionOptions = {}): ScriptedSession => {
  const spawns: SpawnCall[] = [];
  const resumes: ResumeCall[] = [];
  let joins = 0;
  let sessionId = options.facts?.sessionId ?? null;
  const harnessKind = options.harnessKind ?? "opencode";
  let facts: LoopSessionFacts = {
    sessionId: sessionId ?? "session-0",
    liveness: "absent",
    harnessKind,
    pid: options.facts?.pid ?? 4242,
    processStartTimeMs: options.facts?.processStartTimeMs ?? 2_000,
    title: options.facts?.title ?? null,
    ...options.facts,
  };
  let lastSpawn: {
    readonly sessionId: string;
    readonly pid: number | null;
    readonly processStartTimeMs: number | null;
    readonly title: string | null;
    readonly harnessKind: string;
  } | null = null;

  const live = (): LoopSessionFacts => facts;

  return {
    spawns,
    resumes,
    get joins() {
      return joins;
    },
    facts: live,
    lastSpawnFacts: () => lastSpawn,
    setFacts: (overrides) => {
      facts = { ...facts, ...overrides };
    },
    port: {
      read: live,
      spawn: async ({ title, prompt }) => {
        spawns.push({ title, prompt });
        if (options.spawnFailure !== undefined) {
          return { ok: false, code: options.spawnFailure };
        }
        sessionCounter += 1;
        sessionId = `session-${String(sessionCounter)}`;
        const pid = options.spawnPid === undefined ? 4242 : options.spawnPid;
        const startTime = options.spawnStartTimeMs === undefined ? 2_000 : options.spawnStartTimeMs;
        lastSpawn = {
          sessionId,
          pid,
          processStartTimeMs: startTime,
          title,
          harnessKind,
        };
        if (options.effectMakesAlive !== false) {
          facts = {
            sessionId,
            liveness: "alive",
            harnessKind,
            pid,
            processStartTimeMs: startTime,
            title,
          };
        }
        return {
          ok: true,
          sessionId,
          harnessKind,
          pid,
          processStartTimeMs: startTime,
          title,
          fresh: true,
        };
      },
      resume: async ({ sessionId: target, prompt }) => {
        resumes.push({ sessionId: target, prompt });
        if (options.resumeFailure !== undefined) {
          return { ok: false, code: options.resumeFailure };
        }
        facts = { ...facts, sessionId: target, liveness: "alive" };
        return {
          ok: true,
          sessionId: target,
          harnessKind,
          pid: facts.pid,
          processStartTimeMs: facts.processStartTimeMs,
          title: null,
          fresh: false,
        };
      },
      join: async () => {
        joins += 1;
        return {
          ok: true,
          sessionId: facts.sessionId ?? "",
          harnessKind,
          pid: facts.pid,
          processStartTimeMs: facts.processStartTimeMs,
          title: facts.title,
          fresh: false,
        };
      },
    },
  };
};
