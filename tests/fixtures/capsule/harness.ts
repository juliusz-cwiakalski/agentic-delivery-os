/**
 * The shared capsule harness (test-plan §4.1): temp change trees, a memory
 * filesystem for deterministic failure injection, and the production runtime
 * wired with the pure domain rules.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CapsuleEvent,
  CapsuleEventKind,
  CapsuleFileSystemFacts,
  CapsuleLockScheduler,
  CapsulePayload,
  CapsuleRules,
  CapsuleWriter,
} from "../../../packages/core/src/contracts/index";
import {
  capsuleDigest,
  deriveCapsuleEventKey,
  parseCapsuleEvents,
  payloadFieldViolations,
  serializeCapsuleEvent,
} from "../../../packages/core/src/domain/capsule";
import {
  createCapsuleFileRuntime,
  type CapsuleRuntimeOptions,
  nodeCapsuleFileSystemFacts,
} from "../../../packages/adapters/src/file/capsule";

export const CAPSULE_NOW = "2026-11-07T10:00:00Z";
export const CAPSULE_REF = "GH-240";
export const CAPSULE_MONTH = "2026-11";
export const CAPSULE_FOLDER = "2026-11-07--GH-240--capsule-closeout";

/** The pure domain rules as the file runtime's injected seam. */
export const capsuleRules: CapsuleRules = {
  parse: parseCapsuleEvents,
  serialize: serializeCapsuleEvent,
  payloadFieldViolations,
  deriveEventKey: deriveCapsuleEventKey,
};

export type MemoryFs = {
  readonly fs: CapsuleFileSystemFacts;
  readonly files: Map<string, string>;
  readonly directories: Set<string>;
};

/** A deterministic in-memory filesystem with one-shot append failure injection. */
export const makeMemoryFs = (options: {
  readonly files?: Readonly<Record<string, string>>;
  readonly directories?: readonly string[];
  readonly failAppendOnce?: boolean;
}): MemoryFs => {
  const files = new Map<string, string>(Object.entries(options.files ?? {}));
  const directories = new Set<string>(options.directories ?? []);
  let failAppend = options.failAppendOnce === true;
  const fs: CapsuleFileSystemFacts = {
    exists: (path) => files.has(path) || directories.has(path),
    readText: (path) => {
      const value = files.get(path);
      if (value === undefined) throw new Error(`ENOENT ${path}`);
      return value;
    },
    appendFile: (path, text) => {
      if (failAppend) {
        failAppend = false;
        throw new Error("injected append failure");
      }
      files.set(path, `${files.get(path) ?? ""}${text}`);
    },
    writeFile: (path, text) => {
      files.set(path, text);
    },
    ensureDirectory: (path) => {
      directories.add(path);
    },
    listDirectory: (path) => {
      const prefix = path.endsWith("/") ? path : `${path}/`;
      const names = new Set<string>();
      for (const key of [...files.keys(), ...directories]) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const head = rest.split("/")[0];
        if (head !== undefined && head.length > 0) names.add(head);
      }
      return [...names].sort();
    },
    statSize: (path) => Buffer.byteLength(files.get(path) ?? "", "utf8"),
    removeFile: (path) => {
      files.delete(path);
    },
    createExclusive: (path) => {
      if (files.has(path) || directories.has(path)) return false;
      files.set(path, "lock\n");
      return true;
    },
  };
  return { fs, files, directories };
};

/** The canonical temp change tree used by real-filesystem cases. */
export type TempChangeTree = {
  readonly root: string;
  readonly changes: string;
  readonly folder: string;
  readonly cleanup: () => void;
};

export const makeChangeTree = (
  options: {
    readonly ref?: string;
    readonly month?: string;
    readonly name?: string;
    readonly files?: Readonly<Record<string, string>>;
  } = {},
): TempChangeTree => {
  const root = mkdtempSync(join(tmpdir(), "gh240-capsule-"));
  const changes = join(root, "doc", "changes");
  const month = options.month ?? CAPSULE_MONTH;
  const name =
    options.name ?? `${CAPSULE_MONTH}-07--${options.ref ?? CAPSULE_REF}--capsule-closeout`;
  const folder = join(changes, month, name);
  mkdirSync(folder, { recursive: true });
  for (const [relative, content] of Object.entries(options.files ?? {})) {
    const target = join(folder, relative);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, content);
  }
  return {
    root,
    changes,
    folder: `${changes}/${month}/${name}`,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
};

/** The node-backed runtime over a real change tree. */
export const makeNodeRuntime = (
  tree: TempChangeTree,
  overrides: Partial<CapsuleRuntimeOptions> = {},
) =>
  createCapsuleFileRuntime({
    changesDirectory: tree.changes,
    fs: nodeCapsuleFileSystemFacts(),
    nowIso: () => CAPSULE_NOW,
    rules: capsuleRules,
    ...overrides,
  });

/** The memory-backed runtime over an explicit memory filesystem. */
export const makeMemoryRuntime = (
  memory: MemoryFs,
  changesDirectory: string,
  overrides: {
    readonly lock?: CapsuleLockScheduler;
    readonly nowIso?: () => string;
  } = {},
) =>
  createCapsuleFileRuntime({
    changesDirectory,
    fs: memory.fs,
    nowIso: overrides.nowIso ?? (() => CAPSULE_NOW),
    rules: capsuleRules,
    ...(overrides.lock === undefined ? {} : { lock: overrides.lock }),
  });

/** Build one valid in-memory line for a kind/writer/sequence. */
export const makeEvent = (
  sequence: number,
  kind: CapsuleEventKind,
  writer: CapsuleWriter,
  payload: CapsulePayload,
  overrides: Partial<CapsuleEvent> = {},
): CapsuleEvent => ({
  schemaId: "delivery.capsule.event.v1",
  sequence,
  eventKey: `key-${sequence}-${kind}`,
  workItemRef: CAPSULE_REF,
  runId: "run-0001",
  kind,
  writer,
  occurredAt: CAPSULE_NOW,
  payload,
  ...overrides,
});

/** Serialize a list of events as the `events.jsonl` file text. */
export const eventsText = (events: readonly CapsuleEvent[]): string =>
  events.map((event) => serializeCapsuleEvent(event)).join("");

/** Read and validate a real capsule file. */
export const readEvents = (tree: TempChangeTree) => {
  const file = `${tree.folder}/events.jsonl`;
  try {
    return parseCapsuleEvents(readFileSync(file, "utf8"));
  } catch {
    return { ok: true as const, events: [], bytes: 0 };
  }
};

/** The SHA-256 hex of a file via the runtime's own digest helper for payloads. */
export const digestOf = (events: readonly CapsuleEvent[]): string => capsuleDigest(events);

/** A bounded event payload per kind used by the lifecycle-order writer. */
export const payloadFor = (kind: CapsuleEventKind): CapsulePayload => {
  switch (kind) {
    case "capsule.opened":
      return { contractVersion: "delivery.capsule.v1", workItemRef: CAPSULE_REF };
    case "phase.transition":
      return { phaseId: "1", operation: "complete", outcome: "completed" };
    case "commit.landed":
      return { commitSha: "a".repeat(40) };
    case "gate.outcome":
      return {
        gateSet: "default",
        headSha: "a".repeat(40),
        gates: [{ gateId: "unit", verdict: "pass" }],
      };
    case "review.verdict":
      return { iteration: 1, verdict: "PASS" };
    case "closeout.step":
      return { stepId: "capsule", outcome: "applied" };
    case "capsule.promotion":
      return {
        id: "lesson-2026-001-example",
        class: "lesson",
        decision: "promoted",
        mode: "home-write",
        home: ".ai/memory/lessons/lesson-2026-001-example.md",
      };
    case "capsule.retro-coverage":
      return { level: "change", state: "pending" };
    case "capsule.compaction-checkpoint":
      return {
        sessions: ["session-1"],
        sessionCount: 1,
        workingStateFlushed: true,
        eventLogFlushed: true,
        unresolvedQuestions: 0,
        lastVerifiedCommit: "a".repeat(40),
        gap: "harness-compaction-unavailable",
      };
    case "capsule.backfill-gap":
      return { state: "pre-contract" };
    case "capsule.closed":
      return { decisionCounts: { promoted: 1, rejected: 0 }, eventCount: 10, digest: "d" };
  }
};

/** The writer that owns each kind (Appendix C / DEC-2). */
export const writerFor = (kind: CapsuleEventKind): CapsuleWriter => {
  switch (kind) {
    case "phase.transition":
      return "phase";
    case "commit.landed":
      return "commit";
    case "gate.outcome":
      return "verify";
    default:
      return "closeout";
  }
};
