/**
 * TC-STATE-001 (injected identity, zero derivation) and TC-STATE-003 (levels and
 * unsupported rejection) — every name comes from parameters and no local
 * fallback exists.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ERROR_TABLE,
  type ErrorTableEntry,
  STATE_LEVELS,
  type StateStoreIdentity,
} from "../../packages/core/src/contracts/index";
import {
  createStateStore,
  type StateEdgeFaultPoint,
  type StateRuntimeEdge,
} from "../../packages/core/src/state/index";
import {
  createTestEdge,
  ledgerPath,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  withinFence,
} from "../fixtures/state/harness";

const STATE_ENTRY = (code: string): ErrorTableEntry =>
  (ERROR_TABLE as readonly ErrorTableEntry[]).find(
    (entry) => entry.code === code,
  ) as ErrorTableEntry;

const recordingEdge = (recorded: StateEdgeFaultPoint[] = []): StateRuntimeEdge => ({
  ...createTestEdge(),
  raiseFault: (point) => {
    recorded.push(point);
  },
});

describe("TC-STATE-001 injected identity and zero derivation", () => {
  test("identical inputs yield identical identity and identical reads", () => {
    const root = makeTempRoot("contract-determinism");
    try {
      const identity = makeIdentity(root);
      const first = openStore(identity).store;
      const second = openStore(identity).store;
      expect(first.identity).toEqual(second.identity);
      expect(first.identity).toEqual(identity);
      withinFence(first, "writer", (handle) => {
        first.append(handle, { kind: "park", recordKey: "k", payload: 7 });
      });
      const a = first.read({ requiredKeys: ["k"] });
      const b = second.read({ requiredKeys: ["k"] });
      expect(a).toEqual(b);
    } finally {
      removeRoot(root);
    }
  });

  test("differing inputs yield differing identity and paths", () => {
    const root = makeTempRoot("contract-difference");
    try {
      const base = makeIdentity(root);
      const variants = [
        makeIdentity(root, { workspaceId: "workspace-b" }),
        makeIdentity(root, { fenceNamespace: "fence-b" }),
        makeIdentity(`${root}-other`),
      ];
      for (const variant of variants) expect(variant).not.toEqual(base);
      // The workspace identifier scopes the durable path; the fence namespace
      // scopes locks only and must not leak into record paths.
      expect(ledgerPath(makeIdentity(root, { workspaceId: "workspace-b" }))).not.toBe(
        ledgerPath(base),
      );
      expect(ledgerPath(makeIdentity(`${root}-other`))).not.toBe(ledgerPath(base));
      expect(ledgerPath(makeIdentity(root, { fenceNamespace: "fence-b" }))).toBe(ledgerPath(base));
    } finally {
      removeRoot(root);
    }
  });

  test("no ambient clock, environment, randomness or branding name is read", () => {
    const root = makeTempRoot("contract-purity");
    try {
      const identity = makeIdentity(root);
      const edge: StateRuntimeEdge = {
        ...recordingEdge(),
        now: () => {
          throw new Error("ambient clock read");
        },
      };
      const store = createStateStore(identity, { driver: "jsonl", edge });
      const read = store.read({ requiredKeys: [] });
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.evidence.verifiedEmpty).toBe(true);
    } finally {
      removeRoot(root);
    }
  });

  test("the state vocabulary and ledger read no ambient globals", () => {
    const root = process.cwd();
    const sources = [
      "packages/core/src/contracts/state.ts",
      "packages/core/src/state/ledger.ts",
      "packages/core/src/state/index.ts",
      "packages/core/src/state/edge.ts",
      "packages/core/src/state/driver/strategy.ts",
    ];
    for (const relative of sources) {
      const text = readFileSync(join(root, relative), "utf8");
      for (const marker of [
        "process.env",
        "process.platform",
        "Date.now",
        "Math.random",
        "stateDirectoryName",
        "#branding",
        "#config",
      ]) {
        expect(text, `${relative} must not contain ${marker}`).not.toContain(marker);
      }
    }
  });

  test("the identity type carries every required field with no default parameter", () => {
    const text = readFileSync(join(process.cwd(), "packages/core/src/contracts/state.ts"), "utf8");
    for (const field of [
      "level",
      "workspaceId",
      "fenceNamespace",
      "schemaVersion",
      "stateDirectory",
    ]) {
      expect(text).toContain(`readonly ${field}:`);
    }
    expect(
      readFileSync(join(process.cwd(), "packages/core/src/state/index.ts"), "utf8"),
    ).not.toContain("identity: StateStoreIdentity =");
  });
});

describe("TC-STATE-003 levels and unsupported rejection", () => {
  test("all planned levels are declared while only local opens", () => {
    expect([...STATE_LEVELS]).toEqual(["local", "project", "global"]);
    const root = makeTempRoot("contract-levels");
    try {
      const local = openStore(makeIdentity(root)).store;
      withinFence(local, "writer", (handle) => {
        expect(local.append(handle, { kind: "park", recordKey: "k", payload: 1 }).ok).toBe(true);
      });
      expect(local.read({ requiredKeys: ["k"] }).ok).toBe(true);
    } finally {
      removeRoot(root);
    }
  });

  test("project and global fail level.unsupported with zero filesystem effects", () => {
    const root = makeTempRoot("contract-levels-unsupported");
    try {
      for (const level of ["project", "global"] as const) {
        const directory = join(root, level);
        const identity = makeIdentity(directory, { level });
        const recorded: StateEdgeFaultPoint[] = [];
        const created: string[] = [];
        const edge: StateRuntimeEdge = {
          ...recordingEdge(recorded),
          ensureDirectory: (path) => created.push(path),
          writeFile: (path) => created.push(path),
          createExclusiveFile: (path) => {
            created.push(path);
            return true;
          },
          indexWrite: (path) => created.push(path),
        };
        const store = createStateStore(identity, { driver: "jsonl", edge });
        const read = store.read({ requiredKeys: ["k"] });
        expect(read.ok).toBe(false);
        if (!read.ok) {
          expect(read.error.code).toBe("state.level.unsupported");
          expect(read.error.consequence).toBe("not_landed");
        }
        // Every public operation inherits the open verdict; integrity checking
        // must not bypass the unsupported level and report a verified store.
        const integrity = store.checkIntegrity();
        expect(integrity.ok).toBe(false);
        if (!integrity.ok) expect(integrity.error.code).toBe("state.level.unsupported");
        const entry = STATE_ENTRY("state.level.unsupported");
        expect(entry).toMatchObject({
          category: "user",
          retryable: false,
          projectionClass: "user-validation",
          consequence: "not_landed",
        });
        expect(created).toEqual([]);
        expect(existsSync(directory)).toBe(false);
      }
    } finally {
      removeRoot(root);
    }
  });

  test("a local-substitution control would be observable as side effects", () => {
    const root = makeTempRoot("contract-levels-control");
    try {
      const identity = makeIdentity(root, { level: "project" });
      const substituteLocal = (candidate: StateStoreIdentity) =>
        createStateStore(
          { ...candidate, level: "local" },
          { driver: "jsonl", edge: createTestEdge() },
        );
      const control = substituteLocal(identity);
      const fence = control.acquireFence("control-writer");
      expect(fence.ok).toBe(true);
      if (fence.ok) control.releaseFence(fence.value.handle);
      // The control created the directory; the production store above must not.
      expect(existsSync(root)).toBe(true);
    } finally {
      removeRoot(root);
    }
  });
});
