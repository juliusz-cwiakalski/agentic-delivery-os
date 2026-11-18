/**
 * Capsule producer fixtures for the phase/commit/verify tests (GH-240 F-2).
 *
 * `makeRecordingProducer` captures requests without touching the filesystem;
 * `makeFileProducer` writes through the real append-only runtime over a temp
 * change tree. Both are injected; no command reaches a real surface.
 */
import type {
  CapsuleAppendResult,
  CapsuleFileRuntime,
  CapsuleProducerPort,
  CapsuleProducerRequest,
} from "../../../packages/core/src/contracts/index";
import {
  createCapsuleFileRuntime,
  nodeCapsuleFileSystemFacts,
} from "../../../packages/adapters/src/file/capsule";
import { capsuleRules, CAPSULE_NOW, CAPSULE_REF } from "./harness";

export type ProducerMode = "ok" | "busy" | "throw" | "closed";

export type RecordingProducer = {
  readonly calls: CapsuleProducerRequest[];
  readonly port: CapsuleProducerPort;
  reset(): void;
};

const failure = (mode: "busy" | "closed"): CapsuleAppendResult =>
  mode === "busy"
    ? {
        ok: false,
        code: "state.lock.busy",
        detail: "the capsule lock is held by another writer",
        retryable: true,
      }
    : { ok: false, code: "capsule.post-close", detail: "the capsule is already closed" };

export const makeRecordingProducer = (mode: ProducerMode = "ok"): RecordingProducer => {
  const calls: CapsuleProducerRequest[] = [];
  const port: CapsuleProducerPort = {
    append: (request) => {
      if (mode === "throw") throw new Error("injected capsule append failure");
      if (mode === "busy" || mode === "closed") return failure(mode);
      calls.push(request);
      return {
        ok: true,
        appended: true,
        sequence: calls.length,
        eventKey: request.eventKey,
      };
    },
  };
  return {
    calls,
    port,
    reset: () => {
      calls.length = 0;
    },
  };
};

/** A real file-backed capsule runtime over a temp `doc/changes` tree. */
export const makeCapsuleRuntime = (
  changesDirectory: string,
  options: {
    readonly nowIso?: () => string;
    readonly lock?: Parameters<typeof createCapsuleFileRuntime>[0]["lock"];
  } = {},
): CapsuleFileRuntime =>
  createCapsuleFileRuntime({
    changesDirectory,
    fs: nodeCapsuleFileSystemFacts(),
    nowIso: options.nowIso ?? (() => CAPSULE_NOW),
    rules: capsuleRules,
    ...(options.lock === undefined ? {} : { lock: options.lock }),
  });

/** A real file-backed producer over a temp `doc/changes` tree. */
export const makeFileProducer = (changesDirectory: string): CapsuleProducerPort => {
  const runtime = makeCapsuleRuntime(changesDirectory);
  return {
    append: (request) =>
      runtime.append({
        changeRef: request.changeRef,
        workspaceChangesDirectory: changesDirectory,
        writer: request.writer,
        kind: request.kind,
        eventKey: request.eventKey,
        payload: request.payload,
        runId: request.runId ?? "run-producer-fixture",
        ...(request.occurredAt === undefined ? {} : { occurredAt: request.occurredAt }),
      }),
  };
};

export { CAPSULE_REF };
