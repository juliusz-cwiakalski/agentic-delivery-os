/**
 * The append-only capsule file runtime (GH-240 F-1, DEC-3, NFR-2/5/11).
 *
 * One reader, one appender, one terminal close. Every operation validates the
 * whole file first and writes nothing when the file is damaged. There is no
 * truncate, repair, reorder, or compaction API by design.
 */
import { parse as parseYaml } from "yaml";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import {
  CAPSULE_CANDIDATES_DIRECTORY,
  CAPSULE_CONTRACT_VERSION,
  CAPSULE_EVENTS_FILE,
  CAPSULE_LOCK_MAX_ATTEMPTS,
  CAPSULE_LOCK_RETRY_MS,
  CAPSULE_WRITERS,
  CAPSULE_EVENT_KINDS,
  CAPSULE_MAX_BYTES,
  CAPSULE_MAX_CANDIDATE_BYTES,
  CAPSULE_MAX_CANDIDATES,
  CAPSULE_MAX_EVENTS,
  CAPSULE_MAX_EVENT_PAYLOAD_BYTES,
  CAPSULE_SCHEMA_ID,
  type CapsuleAppendRequest,
  type CapsuleAppendResult,
  type CapsuleCandidateDocumentRead,
  type CapsuleCandidateDocumentsReadResult,
  type CapsuleCandidateFile,
  type CapsuleCandidatesReadResult,
  type CapsuleEvent,
  type CapsuleFileRuntime,
  type CapsuleFileSystemFacts,
  type CapsuleLocation,
  type CapsuleLockScheduler,
  type CapsulePayload,
  type CapsuleReadResult,
  type CapsuleReviewArtifact,
  type CapsuleReviewArtifactsReadResult,
  type CapsuleRules,
  type CapsuleWriter,
} from "@delivery-os/core/contracts";
import { type ChangeFolderFileSystem, resolveChangeFolder } from "./change-folder.js";

/** The runtime construction options (every dynamic fact is injected). */
export type CapsuleRuntimeOptions = {
  readonly changesDirectory: string;
  readonly fs: CapsuleFileSystemFacts;
  readonly nowIso: () => string;
  readonly lock?: CapsuleLockScheduler;
  readonly rules: CapsuleRules;
};

const DEFAULT_LOCK: CapsuleLockScheduler = {
  sleep: () => undefined,
  maxAttempts: CAPSULE_LOCK_MAX_ATTEMPTS,
  retryMs: CAPSULE_LOCK_RETRY_MS,
};

const utf8Bytes = (text: string): number => new TextEncoder().encode(text).length;

const isKind = (value: string): boolean =>
  (CAPSULE_EVENT_KINDS as readonly string[]).includes(value);
const isWriter = (value: string): boolean => (CAPSULE_WRITERS as readonly string[]).includes(value);

const refusal = (
  code: Extract<CapsuleAppendResult, { readonly ok: false }>["code"],
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

const capBreach = (input: {
  readonly eventCount: number;
  readonly bytes: number;
  readonly lineBytes: number;
}): "capsule.event-cap" | "capsule.byte-cap" | undefined => {
  if (input.eventCount + 1 > CAPSULE_MAX_EVENTS) return "capsule.event-cap";
  if (input.bytes + input.lineBytes > CAPSULE_MAX_BYTES) return "capsule.byte-cap";
  return undefined;
};

const eventsPath = (location: CapsuleLocation): string =>
  location.ok ? `${location.folder}/${CAPSULE_EVENTS_FILE}` : "";

const candidatesPath = (location: CapsuleLocation): string =>
  location.ok ? `${location.folder}/${CAPSULE_CANDIDATES_DIRECTORY}` : "";

/** The node-backed filesystem seam used by the production edge. */
export const nodeCapsuleFileSystemFacts = (): CapsuleFileSystemFacts => ({
  exists: (path) => existsSync(path),
  readText: (path) => readFileSync(path, "utf8"),
  appendFile: (path, text) => appendFileSync(path, text),
  writeFile: (path, text) => writeFileSync(path, text),
  ensureDirectory: (path) => mkdirSync(path, { recursive: true }),
  listDirectory: (path) => {
    try {
      return readdirSync(path);
    } catch {
      return [];
    }
  },
  statSize: (path) => statSync(path).size,
  removeFile: (path) => rmSync(path, { force: true }),
  createExclusive: (path) => {
    try {
      writeFileSync(path, "lock\n", { flag: "wx" });
      return true;
    } catch {
      return false;
    }
  },
});

/**
 * Build the capsule file runtime over injected filesystem, clock, and lock.
 *
 * `resolve` is read-only. `append` acquires the per-capsule lock, re-reads and
 * validates the whole file, refuses on damage with zero bytes written, no-ops a
 * duplicate key, enforces the declared caps, and releases the lock on every
 * path. `close` appends exactly one terminal event.
 */
export const createCapsuleFileRuntime = (options: CapsuleRuntimeOptions): CapsuleFileRuntime => {
  const { fs, rules } = options;
  const scheduler = options.lock ?? DEFAULT_LOCK;
  const folderFs: ChangeFolderFileSystem = fs;

  const resolve = (changeRef: string): CapsuleLocation =>
    resolveChangeFolder({ changeRef, changesDirectory: options.changesDirectory, fs: folderFs });

  const read = (changeRef: string): CapsuleReadResult => {
    const location = resolve(changeRef);
    if (!location.ok) {
      return { ok: false, code: location.code, detail: location.detail };
    }
    const file = eventsPath(location);
    if (!fs.exists(file)) return { ok: true, events: [], bytes: 0 };
    let text: string;
    try {
      text = fs.readText(file);
    } catch {
      return {
        ok: false,
        code: "capsule.malformed-line",
        detail: "the capsule file could not be read",
      };
    }
    return rules.parse(text);
  };

  const lockPath = (location: CapsuleLocation): string => `${eventsPath(location)}.lock`;

  const acquire = (location: CapsuleLocation): (() => void) | undefined => {
    for (let attempt = 0; attempt < scheduler.maxAttempts; attempt += 1) {
      let acquired = false;
      if (fs.createExclusive !== undefined) {
        acquired = fs.createExclusive(lockPath(location));
      } else if (!fs.exists(lockPath(location))) {
        fs.writeFile(lockPath(location), "lock\n");
        acquired = true;
      }
      if (acquired) {
        return () => {
          if (fs.removeFile !== undefined) fs.removeFile(lockPath(location));
          else fs.writeFile(lockPath(location), "");
        };
      }
      if (attempt + 1 < scheduler.maxAttempts) scheduler.sleep(scheduler.retryMs);
    }
    return undefined;
  };

  const buildEvent = (
    sequence: number,
    kind: CapsuleEvent["kind"],
    writer: CapsuleWriter,
    eventKey: string,
    payload: CapsulePayload,
    request: CapsuleAppendRequest,
  ): CapsuleEvent => ({
    schemaId: CAPSULE_SCHEMA_ID,
    sequence,
    eventKey,
    workItemRef: request.changeRef,
    runId: request.runId,
    kind,
    writer,
    occurredAt: request.occurredAt ?? options.nowIso(),
    payload,
  });

  const appendInternal = (request: CapsuleAppendRequest): CapsuleAppendResult => {
    const location = resolve(request.changeRef);
    if (!location.ok) return refusal(location.code, location.detail);
    if (!fs.exists(location.folder)) {
      return refusal("capsule.folder-absent", `${location.folder} does not exist`);
    }
    if (!isKind(request.kind)) {
      return refusal("capsule.invalid-vocabulary", `unknown kind ${String(request.kind)}`);
    }
    if (!isWriter(request.writer)) {
      return refusal("capsule.invalid-vocabulary", `unknown writer ${String(request.writer)}`);
    }
    const violations = rules.payloadFieldViolations(request.kind, request.payload);
    if (violations.length > 0) {
      return refusal("capsule.invalid-vocabulary", violations.join("; "));
    }
    if (utf8Bytes(JSON.stringify(request.payload)) > CAPSULE_MAX_EVENT_PAYLOAD_BYTES) {
      return refusal(
        "capsule.payload-cap",
        `the payload exceeds ${CAPSULE_MAX_EVENT_PAYLOAD_BYTES} bytes`,
        { cap: CAPSULE_MAX_EVENT_PAYLOAD_BYTES, refused: 1 },
      );
    }
    const file = eventsPath(location);
    if (request.requireExisting === true && !fs.exists(file)) {
      return refusal("capsule.folder-absent", "the capsule file does not exist");
    }
    const release = acquire(location);
    if (release === undefined) {
      return refusal("state.lock.busy", "the capsule lock is held by another writer", {
        retryable: true,
      });
    }
    try {
      const previous: CapsuleReadResult = fs.exists(file)
        ? rules.parse(fs.readText(file))
        : { ok: true, events: [], bytes: 0 };
      if (!previous.ok) return refusal(previous.code, previous.detail);
      if (!fs.exists(candidatesPath(location))) fs.ensureDirectory(candidatesPath(location));
      const events: CapsuleEvent[] = [...previous.events];
      for (const existing of events) {
        if (existing.kind === "capsule.closed") {
          return refusal("capsule.post-close", "the capsule is already closed");
        }
        if (existing.eventKey === request.eventKey) {
          return {
            ok: true,
            appended: false,
            sequence: existing.sequence,
            eventKey: request.eventKey,
            reason: "duplicate",
          };
        }
      }
      let bytes = previous.bytes;
      const lines: string[] = [];
      if (events.length === 0 && request.kind !== "capsule.opened") {
        const opened = buildEvent(
          events.length + 1,
          "capsule.opened",
          request.writer,
          rules.deriveEventKey(["capsule.opened", request.changeRef]),
          { contractVersion: CAPSULE_CONTRACT_VERSION, workItemRef: request.changeRef },
          request,
        );
        const line = rules.serialize(opened);
        const breach = capBreach({
          eventCount: events.length,
          bytes,
          lineBytes: utf8Bytes(line),
        });
        if (breach !== undefined) {
          return refusal(breach, "the capsule cap would be breached", {
            cap: breach === "capsule.event-cap" ? CAPSULE_MAX_EVENTS : CAPSULE_MAX_BYTES,
            refused: 1,
          });
        }
        lines.push(line);
        events.push(opened);
        bytes += utf8Bytes(line);
      }
      const event = buildEvent(
        events.length + 1,
        request.kind,
        request.writer,
        request.eventKey,
        request.payload,
        request,
      );
      const line = rules.serialize(event);
      const breach = capBreach({
        eventCount: events.length,
        bytes,
        lineBytes: utf8Bytes(line),
      });
      if (breach !== undefined) {
        return refusal(breach, "the capsule cap would be breached", {
          cap: breach === "capsule.event-cap" ? CAPSULE_MAX_EVENTS : CAPSULE_MAX_BYTES,
          refused: 1,
        });
      }
      try {
        fs.appendFile(file, `${lines.join("")}${line}`);
      } catch {
        return refusal("capsule.write-failed", "the capsule append did not land");
      }
      return { ok: true, appended: true, sequence: event.sequence, eventKey: event.eventKey };
    } finally {
      release();
    }
  };

  const close = (
    request: Omit<CapsuleAppendRequest, "kind"> & { readonly payload: CapsulePayload },
  ): CapsuleAppendResult => {
    const location = resolve(request.changeRef);
    if (!location.ok) return refusal(location.code, location.detail);
    const file = eventsPath(location);
    if (fs.exists(file)) {
      const previous = rules.parse(fs.readText(file));
      if (!previous.ok) return refusal(previous.code, previous.detail);
      const closed = previous.events.find((event) => event.kind === "capsule.closed");
      if (closed !== undefined) {
        return {
          ok: true,
          appended: false,
          sequence: closed.sequence,
          eventKey: closed.eventKey,
          reason: "already-closed",
        };
      }
    }
    return appendInternal({ ...request, kind: "capsule.closed" });
  };

  const ensureCandidates = (changeRef: string): CapsuleLocation => {
    const location = resolve(changeRef);
    if (!location.ok) return location;
    if (!fs.exists(candidatesPath(location))) fs.ensureDirectory(candidatesPath(location));
    return location;
  };

  const readCandidates = (changeRef: string): CapsuleCandidatesReadResult => {
    const location = resolve(changeRef);
    if (!location.ok) return { ok: false, code: location.code, detail: location.detail };
    const directory = candidatesPath(location);
    if (!fs.exists(directory)) return { ok: true, candidates: [] };
    const files: CapsuleCandidateFile[] = [];
    for (const name of [...fs.listDirectory(directory)].sort()) {
      if (!name.endsWith(".yaml")) continue;
      files.push({ name, bytes: fs.statSize(`${directory}/${name}`) });
    }
    if (files.length > CAPSULE_MAX_CANDIDATES) {
      return {
        ok: false,
        code: "capsule.candidate-cap",
        detail: `${files.length} candidates exceed ${CAPSULE_MAX_CANDIDATES}`,
        cap: CAPSULE_MAX_CANDIDATES,
        refused: files.length - CAPSULE_MAX_CANDIDATES,
      };
    }
    const oversized = files.find((file) => file.bytes > CAPSULE_MAX_CANDIDATE_BYTES);
    if (oversized !== undefined) {
      return {
        ok: false,
        code: "capsule.candidate-invalid",
        detail: `${oversized.name} exceeds ${CAPSULE_MAX_CANDIDATE_BYTES} bytes`,
        cap: CAPSULE_MAX_CANDIDATE_BYTES,
        refused: 1,
      };
    }
    return { ok: true, candidates: files };
  };

  const listReviewArtifacts = (changeRef: string): CapsuleReviewArtifactsReadResult => {
    const location = resolve(changeRef);
    if (!location.ok) return { ok: false, code: location.code, detail: location.detail };
    const directory = `${location.folder}/code-review`;
    if (!fs.exists(directory)) return { ok: true, artifacts: [] };
    const artifacts: CapsuleReviewArtifact[] = [];
    for (const name of [...fs.listDirectory(directory)].sort()) {
      if (!/^review-iter-.*\.yaml$/.test(name)) continue;
      try {
        artifacts.push({ name, text: fs.readText(`${directory}/${name}`), readable: true });
      } catch {
        artifacts.push({ name, text: "", readable: false });
      }
    }
    return { ok: true, artifacts };
  };

  const readCandidateDocuments = (changeRef: string): CapsuleCandidateDocumentsReadResult => {
    const location = resolve(changeRef);
    if (!location.ok) return { ok: false, code: location.code, detail: location.detail };
    const directory = candidatesPath(location);
    if (!fs.exists(directory)) return { ok: true, documents: [] };
    const documents: CapsuleCandidateDocumentRead[] = [];
    for (const name of [...fs.listDirectory(directory)].sort()) {
      if (!name.endsWith(".yaml")) {
        documents.push({
          file: name,
          value: null,
          parseError: "candidate file must be named <id>.yaml",
        });
        continue;
      }
      try {
        const text = fs.readText(`${directory}/${name}`);
        documents.push({ file: name, value: parseYaml(text) });
      } catch {
        documents.push({ file: name, value: null, parseError: "candidate is not parseable" });
      }
    }
    return { ok: true, documents };
  };

  return {
    resolve,
    read,
    append: appendInternal,
    close,
    ensureCandidates,
    readCandidates,
    listReviewArtifacts,
    readCandidateDocuments,
  };
};
