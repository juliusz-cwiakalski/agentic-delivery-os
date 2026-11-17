/**
 * In-process supervision battery harness (GH-295 test plan §6, NFR-7).
 *
 * One real temporary repository, one delivered state store inside it, an
 * injected clock, and a recording read port. The same battery function the CLI
 * projects is exercised here; no case reads the wall clock, the environment, or
 * the process table.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  createStateSupervisionReadPort,
  runSupervisionBattery,
  type SupervisionBatteryResult,
  type SupervisionReadPort,
} from "../../../packages/core/src/app/index";
import type { StateStorePort } from "../../../packages/core/src/contracts/index";
import { makeIdentity, openStore } from "../state/harness";
import type { SupervisionSeedTarget } from "./records";
import { isoAt } from "./records";
import { createSupervisionRepository, type SupervisionTempRepository } from "./temp-git";

export const HARNESS_NOW_ISO = "2026-11-17T00:00:00.000Z";
export const HARNESS_REPOSITORY = "github.com/example/supervision-repo";

export type SupervisionHarness = {
  readonly directory: string;
  readonly repository: string;
  readonly repositoryFixture: SupervisionTempRepository;
  readonly store: StateStorePort;
  readonly nowMs: number;
  readonly nowIso: string;
  readonly seed: SupervisionSeedTarget;
  /** Run one battery pass and return its result; the read counter resets. */
  readonly battery: (options?: {
    readonly repository?: string;
    readonly nowMs?: number;
  }) => SupervisionBatteryResult;
  /** The port read passes observed by the most recent battery run. */
  readonly reads: { count: number };
  readonly remove: () => void;
};

export type SupervisionHarnessOptions = {
  readonly label?: string;
  readonly nowMs?: number;
  readonly repository?: string;
};

export const createSupervisionHarness = (
  options: SupervisionHarnessOptions = {},
): SupervisionHarness => {
  const repositoryFixture = createSupervisionRepository(options.label ?? "supervise");
  const directory = repositoryFixture.directory;
  const stateDirectory = join(directory, ".supervision-state");
  mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
  const { store } = openStore(makeIdentity(stateDirectory));
  const nowMs = options.nowMs ?? Date.parse(HARNESS_NOW_ISO);
  const nowIso = new Date(nowMs).toISOString();
  const repository = options.repository ?? HARNESS_REPOSITORY;
  let fenceSequence = 0;
  const fence = (label: string): string => {
    fenceSequence += 1;
    return `${label}-${fenceSequence}`;
  };
  const seed: SupervisionSeedTarget = { store, nowMs, nowIso, repository, root: directory, fence };

  const reads = { count: 0 };
  return {
    directory,
    repository,
    repositoryFixture,
    store,
    nowMs,
    nowIso,
    seed,
    reads,
    battery: (runOptions = {}) => {
      const runNowMs = runOptions.nowMs ?? nowMs;
      const inner = createStateSupervisionReadPort(store);
      const port: SupervisionReadPort = {
        read: (request) => {
          reads.count += 1;
          return inner.read(request);
        },
      };
      return runSupervisionBattery({
        repository: runOptions.repository ?? repository,
        nowMs: runNowMs,
        nowIso: new Date(runNowMs).toISOString(),
        read: port,
      });
    },
    remove: () => repositoryFixture.remove(),
  };
};

export { isoAt };
