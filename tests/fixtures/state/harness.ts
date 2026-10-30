/**
 * Shared harness for the GH-174 state suites.
 *
 * Builds temp store roots, an injected test edge with deterministic named
 * faults and a mutable clock, and the normalization used by the conformance
 * suite. No test ever writes the live tree or the real user state directory.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import {
  STATE_SCHEMA_VERSION,
  type StateDriverKind,
  type StateFenceHandle,
  type StateStoreIdentity,
  type StateStorePort,
} from "../../../packages/core/src/contracts/index";
import {
  createNodeStateEdge,
  createStateStore,
  type StateEdgeFaultPoint,
  type StateRuntimeEdge,
} from "../../../packages/core/src/state/index";

export type TestFault = { readonly point: StateEdgeFaultPoint };

export type TestEdge = StateRuntimeEdge & {
  readonly raised: StateEdgeFaultPoint[];
  arm(points: readonly StateEdgeFaultPoint[]): void;
  disarm(): void;
};

export type TestClock = { value: number };

export const createTestEdge = (
  options: { readonly faults?: readonly StateEdgeFaultPoint[]; readonly clock?: TestClock } = {},
): TestEdge => {
  const base = createNodeStateEdge();
  let armed = new Set<StateEdgeFaultPoint>(options.faults ?? []);
  const raised: StateEdgeFaultPoint[] = [];
  return {
    ...base,
    now: () => (options.clock === undefined ? base.now() : options.clock.value),
    raiseFault: (point) => {
      raised.push(point);
      if (armed.has(point)) throw { point } satisfies TestFault;
    },
    raised,
    arm: (points) => {
      armed = new Set(points);
    },
    disarm: () => {
      armed = new Set();
    },
  };
};

export const makeTempRoot = (label = "state"): string =>
  mkdtempSync(join(tmpdir(), `gh174-${label}-`));

export const removeRoot = (root: string): void => rmSync(root, { recursive: true, force: true });

export const makeIdentity = (
  stateDirectory: string,
  overrides: Partial<StateStoreIdentity> = {},
): StateStoreIdentity => ({
  level: "local",
  workspaceId: "workspace-a",
  fenceNamespace: "fence-a",
  schemaVersion: STATE_SCHEMA_VERSION,
  stateDirectory,
  ...overrides,
});

export const openStore = (
  identity: StateStoreIdentity,
  options: { driver?: StateDriverKind; edge?: TestEdge; staleFenceMs?: number } = {},
): { store: StateStorePort; edge: TestEdge } => {
  const edge = options.edge ?? createTestEdge();
  const store = createStateStore(identity, {
    driver: options.driver ?? "jsonl",
    edge,
    ...(options.staleFenceMs !== undefined ? { staleFenceMs: options.staleFenceMs } : {}),
  });
  return { store, edge };
};

/** Deterministic FNV-1a 64-bit used as an independent checksum oracle. */
export const independentChecksum = (payload: unknown): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let hash = 14695981039346656037n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * 1099511628211n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
};

export const ledgerPath = (identity: StateStoreIdentity): string =>
  `${identity.stateDirectory}/ledger.${encodeURIComponent(identity.workspaceId)}.jsonl`;

export const ledgerText = (identity: StateStoreIdentity): string =>
  readFileSync(ledgerPath(identity), "utf8");

export const ledgerLines = (text: string): string[] =>
  text.split("\n").filter((line) => line !== "");

export const digestPaths = (paths: readonly string[]): string => {
  const hash = createHash("sha256");
  for (const path of paths) {
    // Only the file name and bytes participate, so per-driver temp roots do
    // not make identical fixtures look different.
    hash.update(basename(path));
    hash.update(existsSync(path) ? readFileSync(path) : Buffer.from("absent"));
  }
  return hash.digest("hex");
};

export const listStoreFiles = (directory: string): string[] =>
  existsSync(directory)
    ? readdirSync(directory)
        .filter((name) => !name.endsWith(".sqlite") && !name.endsWith(".lock"))
        .sort()
    : [];

/** Opens a fence, runs the body, and releases the fence. */
export const withinFence = (
  store: StateStorePort,
  token: string,
  body: (handle: StateFenceHandle) => void,
): void => {
  const acquired = store.acquireFence(token);
  if (!acquired.ok) throw new Error(`acquire failed: ${acquired.error.code}`);
  try {
    body(acquired.value.handle);
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};
