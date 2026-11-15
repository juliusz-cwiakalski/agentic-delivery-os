/**
 * The ceremony state fixture (GH-296 §4.1.8): one temp store per case, seeded
 * through the production append path, with deterministic literal record
 * builders. No test writes the live tree.
 */
import {
  CEREMONY_RUN_PAYLOAD_SCHEMA,
  CEREMONY_STEP_PAYLOAD_SCHEMA,
  type CeremonyRunRecord,
  type CeremonyStepRecord,
  type CeremonyWindow,
} from "../../../packages/core/src/contracts/index";
import { appendCeremonyRun, appendCeremonyStep } from "../../../packages/core/src/state/index";
import {
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  withinFence,
  type TestEdge,
} from "../state/harness";
import type { StateStorePort } from "../../../packages/core/src/contracts/index";

export const NOW_MS = Date.UTC(2026, 10, 16, 9, 0, 0);
export const WINDOW: CeremonyWindow = {
  start: "2026-11-16T00:00:00.000Z",
  end: "2026-11-16T23:59:59.999Z",
};

export type CeremonyStateFixture = {
  readonly root: string;
  readonly store: StateStorePort;
  readonly edge: TestEdge;
  dispose(): void;
};

export const makeCeremonyState = (label: string): CeremonyStateFixture => {
  const root = makeTempRoot(`ceremony-${label}`);
  const identity = makeIdentity(root);
  const opened = openStore(identity);
  return {
    root,
    store: opened.store,
    edge: opened.edge,
    dispose: () => removeRoot(root),
  };
};

export const runRecord = (overrides: Partial<CeremonyRunRecord> = {}): CeremonyRunRecord => ({
  schemaId: CEREMONY_RUN_PAYLOAD_SCHEMA,
  ceremonyId: "morning-brief",
  runId: "run-fixture-0001",
  origin: "built-in",
  declarationDigest: "0123456789abcdef",
  trigger: {
    kind: "explicit",
    resolution: "declaration",
    declared: "schedule:daily",
    declaredWindow: WINDOW,
    actualWindow: WINDOW,
  },
  scopeKey: { value: "github.com/example/repo", derivation: "repository" },
  tier: { effectiveTier: "full", phaseSetSize: 11, escalations: [] },
  startedAtMs: NOW_MS,
  phaseCount: 2,
  ...overrides,
});

export const stepRecord = (overrides: Partial<CeremonyStepRecord> = {}): CeremonyStepRecord => ({
  schemaId: CEREMONY_STEP_PAYLOAD_SCHEMA,
  runId: "run-fixture-0001",
  index: 1,
  phaseIndex: 0,
  kind: "collect",
  outcome: "verified",
  startedAtMs: NOW_MS,
  endedAtMs: NOW_MS + 25,
  durationMs: 25,
  slot: "ceremony-artifact",
  artifactRef: "ceremony-artifact:run-fixture-0001.json",
  verification: "verified",
  ...overrides,
});

/** Seed one run plus its step set through the production append path. */
export const seedRun = (
  fixture: CeremonyStateFixture,
  steps: readonly CeremonyStepRecord[],
  run: CeremonyRunRecord = runRecord(),
): void => {
  withinFence(fixture.store, "ceremony-seed", (handle) => {
    const appended = appendCeremonyRun(fixture.store, handle, run);
    if (!appended.ok) throw new Error(`run append failed: ${appended.error.code}`);
    for (const step of steps) {
      const outcome = appendCeremonyStep(fixture.store, handle, step);
      if (!outcome.ok) throw new Error(`step append failed: ${outcome.error.code}`);
    }
  });
};
