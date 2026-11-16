/**
 * The ceremony engine harness (GH-296 §4.1): recording input reads, an in-memory
 * byte-level artifact family, an in-memory memory slot, an in-memory mirror, and
 * a real state store with the production record port. Every fact is injected;
 * no suite opens a socket, spawns a process, or writes the live tree.
 */
import type {
  CeremonyArtifactPort,
  CeremonyArtifactRead,
  CeremonyDeclaration,
  CeremonyInputRead,
  CeremonyInputSource,
  CeremonyMemoryPort,
  CeremonyMirrorInspection,
  CeremonyMirrorPort,
  CeremonyOutputSlot,
  CeremonyRunEnvironment,
  CeremonyWindow,
  StateStorePort,
} from "../../../packages/core/src/contracts/index";
import { createCeremonyRecordPort } from "../../../packages/core/src/state/index";
import { readFixture, type UnknownRecord, withPath } from "./declarations";
import { type CeremonyStateFixture, makeCeremonyState, NOW_MS } from "./state";

export type EngineHarness = {
  readonly fixture: CeremonyStateFixture;
  readonly store: StateStorePort;
  readonly env: CeremonyRunEnvironment;
  readonly clock: { value: number };
  readonly inputCalls: { source: CeremonyInputSource; window: CeremonyWindow }[];
  readonly artifactContents: Map<string, string>;
  readonly artifactWrites: string[];
  readonly memory: Map<string, string>;
  readonly mirrorTargets: Map<string, string[]>;
  readonly mirrorSources: Map<string, string[]>;
  readonly mirrorApplies: { target: string; records: readonly string[] }[];
  scriptInput(source: CeremonyInputSource, read: CeremonyInputRead): void;
  corruptArtifact(ref: string, content: string): void;
  dispose(): void;
};

export type EngineHarnessOptions = {
  readonly repositoryId?: string;
  readonly nowMs?: number;
  readonly runIds?: readonly string[];
  readonly origin?: "built-in" | "project";
  readonly mirror?: boolean;
  readonly mirrorApply?: "write" | "noop";
};

const defaultInput = (): CeremonyInputRead => ({ state: "present", facts: {} });

export const makeEngineHarness = (options: EngineHarnessOptions = {}): EngineHarness => {
  const fixture = makeCeremonyState("engine");
  const clock = { value: options.nowMs ?? NOW_MS };
  const inputScript = new Map<CeremonyInputSource, CeremonyInputRead>();
  const inputCalls: { source: CeremonyInputSource; window: CeremonyWindow }[] = [];
  const artifactContents = new Map<string, string>();
  const artifactWrites: string[] = [];
  const readOverrides = new Map<string, string>();
  const memory = new Map<string, string>();
  const mirrorTargets = new Map<string, string[]>();
  const mirrorSources = new Map<string, string[]>();
  const mirrorApplies: { target: string; records: readonly string[] }[] = [];

  const artifacts: CeremonyArtifactPort = {
    write(input: {
      runId: string;
      slot: CeremonyOutputSlot;
      schema: string;
      content: string;
      stepIndex: number;
    }): {
      ok: true;
      ref: string;
    } {
      const name =
        input.slot === "ceremony-artifact"
          ? `${input.runId}.s${String(input.stepIndex)}.json`
          : `${input.runId}.${input.slot}.${String(artifactContents.size)}.json`;
      const ref = `${input.slot}:${name}`;
      artifactContents.set(ref, input.content);
      artifactWrites.push(`${name}:${input.content}`);
      return { ok: true, ref };
    },
    read(input: { runId: string; slot: CeremonyOutputSlot; ref: string }): CeremonyArtifactRead {
      const override = readOverrides.get(input.ref);
      if (override !== undefined) return { ok: true, content: override };
      const content = artifactContents.get(input.ref);
      return content === undefined
        ? { ok: false, detail: "artifact absent" }
        : { ok: true, content };
    },
  };

  const memoryPort: CeremonyMemoryPort = {
    readNote(scopeKey) {
      const body = memory.get(scopeKey);
      return body === undefined ? { state: "absent" } : { state: "present", body };
    },
    writeNote(input) {
      const existing = memory.get(input.scopeKey);
      memory.set(
        input.scopeKey,
        input.append && existing !== undefined ? `${existing}\n${input.body}` : input.body,
      );
      return { ok: true };
    },
  };

  const mirrorPort: CeremonyMirrorPort = {
    inspect(target: string): CeremonyMirrorInspection {
      if (options.mirror === false) return { state: "absent", mirrorSet: [], sourceSet: [] };
      return {
        state: "clean",
        mirrorSet: [...(mirrorTargets.get(target) ?? [])].sort(),
        sourceSet: [...(mirrorSources.get(target) ?? [])].sort(),
      };
    },
    apply(target, records) {
      mirrorApplies.push({ target, records: [...records] });
      if (options.mirrorApply !== "noop") mirrorTargets.set(target, [...records]);
      return { ok: true };
    },
  };

  let runIndex = 0;
  const runIds = options.runIds ?? ["run-1", "run-2", "run-3", "run-4", "run-5"];
  const env: CeremonyRunEnvironment = {
    clock: {
      nowMs: () => {
        const value = clock.value;
        clock.value += 10;
        return value;
      },
    },
    ids: {
      nextRunId: () => {
        const id = runIds[runIndex] ?? `run-${String(runIndex + 1)}`;
        runIndex += 1;
        return id;
      },
    },
    input: (source, window) => {
      inputCalls.push({ source, window });
      return inputScript.get(source) ?? defaultInput();
    },
    artifacts,
    records: createCeremonyRecordPort(fixture.store, "ceremony-engine"),
    memory: memoryPort,
    mirror: mirrorPort,
    repositoryId: options.repositoryId ?? "github.com/example/repo",
    ...(options.origin === undefined ? {} : { origin: options.origin }),
  };

  return {
    fixture,
    store: fixture.store,
    env,
    clock,
    inputCalls,
    artifactContents,
    artifactWrites,
    memory,
    mirrorTargets,
    mirrorSources,
    mirrorApplies,
    scriptInput: (source, read) => {
      inputScript.set(source, read);
    },
    corruptArtifact: (ref, content) => {
      readOverrides.set(ref, content);
    },
    dispose: () => fixture.dispose(),
  };
};

/** The base valid declaration fixture at its declared shape. */
export const baseDeclaration = (): CeremonyDeclaration =>
  readFixture("valid-repository.json") as unknown as CeremonyDeclaration;

export const declarationWith = (
  patch: (base: UnknownRecord) => UnknownRecord,
): CeremonyDeclaration =>
  patch(readFixture("valid-repository.json")) as unknown as CeremonyDeclaration;

export const declarationPath = (path: string, value: unknown): CeremonyDeclaration =>
  withPath(readFixture("valid-repository.json"), path, value) as unknown as CeremonyDeclaration;

/** A three-step, two-phase generic declaration for execution/resume cases. */
export const threeStepDeclaration = (): CeremonyDeclaration =>
  withPath(readFixture("valid-repository.json"), "agenda", [
    {
      id: "gather",
      steps: [
        {
          kind: "collect",
          inputs: ["audit-ledger"],
          outputs: [{ slot: "ceremony-artifact", schema: "delivery.ceremony.gather.v1" }],
          verify: "artifact-conforms",
        },
      ],
    },
    {
      id: "record",
      steps: [
        {
          kind: "fold",
          inputs: ["queue-state"],
          outputs: [{ slot: "state-record", schema: "delivery.ceremony.fold.v1" }],
          verify: "artifact-conforms",
        },
        {
          kind: "record",
          outputs: [{ slot: "state-record", schema: "delivery.ceremony.record.v1" }],
          verify: "artifact-conforms",
        },
      ],
    },
  ]) as unknown as CeremonyDeclaration;
