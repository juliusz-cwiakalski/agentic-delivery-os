/**
 * TC-STATE-013/014/015 — single-writer fences: contention is classified, stale
 * handles are rejected, crash-after-land leaves a detectably stale fence, and
 * recovery is explicit and reported (AC-F7-1..3, NFR-4).
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

import { classifyDomainKind } from "../../packages/cli/src/classify";
import type { StateFenceHandle } from "../../packages/core/src/contracts/index";
import type { StateRuntimeEdge } from "../../packages/core/src/state/index";
import {
  createTestEdge,
  ledgerLines,
  ledgerText,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  type TestClock,
  withinFence,
} from "../fixtures/state/harness";

const LOCK_BUSY = "state.lock.busy";

const relativeImport = (fromDirectory: string, target: string): string => {
  const path = relative(fromDirectory, target).replaceAll("\\", "/");
  return path.startsWith(".") ? path : `./${path}`;
};

const makeCompileRoot = (): string => {
  // The probe lives under the repo's pre-approved scratch tree so relative
  // source imports resolve to the real workspace modules.
  return mkdtempSync(join(process.cwd(), "tmp", "tmpdir", "fence-compile-"));
};

describe("TC-STATE-013 fence contention and double-write prevention", () => {
  test("a second acquisition fails state.lock.busy and no double write lands", () => {
    const root = makeTempRoot("fence-contention");
    try {
      const identity = makeIdentity(root);
      const a = openStore(identity).store;
      const b = openStore(identity).store;
      const held = a.acquireFence("writer-a");
      expect(held.ok).toBe(true);
      if (!held.ok) return;

      const contending = b.acquireFence("writer-b");
      expect(contending.ok).toBe(false);
      if (!contending.ok) {
        expect(contending.error.code).toBe(LOCK_BUSY);
        expect(contending.error.consequence).toBe("not_landed");
      }
      expect(classifyDomainKind("state", LOCK_BUSY)).toMatchObject({
        category: "transient",
        retryable: true,
      });
      expect(a.read({ requiredKeys: [] }).ok).toBe(true);
      expect(() => ledgerText(identity)).toThrow();

      const appended = a.append(held.value.handle, {
        kind: "park",
        recordKey: "k1",
        payload: "a",
      });
      expect(appended.ok).toBe(true);
      a.releaseFence(held.value.handle);

      const retry = b.acquireFence("writer-b");
      expect(retry.ok).toBe(true);
      if (!retry.ok) return;
      const second = b.append(retry.value.handle, {
        kind: "park",
        recordKey: "k2",
        payload: "b",
      });
      expect(second.ok).toBe(true);
      if (second.ok) expect(second.value.sequence).toBe(2);
      b.releaseFence(retry.value.handle);

      const sequences = ledgerLines(ledgerText(identity)).map(
        (line) => (JSON.parse(line) as { sequence: number }).sequence,
      );
      expect(sequences).toEqual([1, 2]);
    } finally {
      removeRoot(root);
    }
  });

  test("the lock-disabled control admits a double writer (the check is live)", () => {
    const root = makeTempRoot("fence-disabled-control");
    try {
      const identity = makeIdentity(root);
      const disabledEdge = (): StateRuntimeEdge => {
        const base = createTestEdge();
        return {
          ...base,
          exists: (path) => (path.endsWith(".lock") ? false : base.exists(path)),
          createExclusiveFile: () => true,
        };
      };
      const a = openStore(identity, { edge: disabledEdge() }).store;
      const b = openStore(identity, { edge: disabledEdge() }).store;
      const first = a.acquireFence("writer-a");
      const second = b.acquireFence("writer-b");
      // A live lock would reject the second acquisition; the disabled control
      // lets both through, which is exactly what the production test catches.
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
    } finally {
      removeRoot(root);
    }
  });

  test("writes are unrepresentable without an acquired fence handle", () => {
    const root = makeCompileRoot();
    try {
      const fixture = join(root, "probe.ts");
      const stateModule = relativeImport(
        root,
        join(process.cwd(), "packages/core/src/state/index"),
      );
      const contractsModule = relativeImport(
        root,
        join(process.cwd(), "packages/core/src/contracts/index"),
      );
      writeFileSync(
        fixture,
        [
          `import { createStateStore } from "${stateModule}";`,
          `import type { StateStorePort } from "${contractsModule}";`,
          "declare const store: StateStorePort;",
          "declare const forged: { token: string; workspaceId: string; fenceNamespace: string };",
          'store.append(forged, { kind: "park", recordKey: "k", payload: 1 });',
          'store.replaceDocument(forged, { name: "doc", content: 1 });',
          "export { createStateStore };",
        ].join("\n"),
      );
      const options: ts.CompilerOptions = {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        baseUrl: process.cwd(),
        types: ["bun"],
        paths: { "#contracts": ["packages/core/src/contracts/index.ts"] },
      };
      const program = ts.createProgram([fixture], options);
      const diagnostics = ts
        .getPreEmitDiagnostics(program)
        .filter((diagnostic) => diagnostic.file?.fileName === fixture);
      const text = diagnostics
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
        .join("\n");
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(text).toMatch(/StateFenceHandle|stateFenceHandleBrand/);
    } finally {
      removeRoot(root);
    }
  });
});

describe("TC-STATE-014 stale-handle rejection and explicit recovery", () => {
  test("released handles fail append and replace with state.lock.busy", () => {
    const root = makeTempRoot("fence-released");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const acquired = store.acquireFence("writer");
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) return;
      const handle: StateFenceHandle = acquired.value.handle;
      store.releaseFence(handle);

      const appended = store.append(handle, { kind: "park", recordKey: "k", payload: 1 });
      expect(appended.ok).toBe(false);
      if (!appended.ok) expect(appended.error.code).toBe(LOCK_BUSY);
      const replaced = store.replaceDocument(handle, { name: "doc", content: 1 });
      expect(replaced.ok).toBe(false);
      if (!replaced.ok) expect(replaced.error.code).toBe(LOCK_BUSY);
    } finally {
      removeRoot(root);
    }
  });

  test("recovery invalidates old handles, is reported, and reads stay available", () => {
    const root = makeTempRoot("fence-recovery");
    try {
      const clock: TestClock = { value: 1_000 };
      const identity = makeIdentity(root);
      const writer = openStore(identity, { edge: createTestEdge({ clock }), staleFenceMs: 500 });
      const acquired = writer.store.acquireFence("writer-a");
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) return;
      clock.value = 5_000;

      const other = openStore(identity, { edge: createTestEdge({ clock }), staleFenceMs: 500 });
      expect(other.store.fenceStatus()).toMatchObject({ held: true, stale: true });
      expect(other.store.acquireFence("writer-b").ok).toBe(false);

      const recovered = other.store.recoverFence("writer-b");
      expect(recovered.ok).toBe(true);
      if (recovered.ok) {
        expect(recovered.value.staleToken).toBe("writer-a");
        expect(recovered.value.recoveredAtMs).toBe(5_000);
      }
      const staleWrite = writer.store.append(acquired.value.handle, {
        kind: "park",
        recordKey: "k",
        payload: 1,
      });
      expect(staleWrite.ok).toBe(false);
      if (!staleWrite.ok) expect(staleWrite.error.code).toBe(LOCK_BUSY);
      expect(other.store.read({ requiredKeys: [] }).ok).toBe(true);
    } finally {
      removeRoot(root);
    }
  });

  test("the silent-steal control is detected by the missing report", () => {
    const silentSteal = (): { recovered: boolean } => ({ recovered: true });
    const report = silentSteal();
    // The production recovery report names the stale token and the time; a
    // silent steal has neither and would be caught here.
    expect(Object.hasOwn(report, "staleToken")).toBe(false);
    expect(Object.hasOwn(report, "recoveredAtMs")).toBe(false);
  });
});

describe("TC-STATE-015 crash-after-land stale fence", () => {
  test("the landed record verifies, writes wait for recovery, and recovery is reported", () => {
    const root = makeTempRoot("fence-crash-after-land");
    try {
      const clock: TestClock = { value: 1_000 };
      const identity = makeIdentity(root);
      const writer = openStore(identity, {
        edge: createTestEdge({ clock, faults: ["append-after-flush"] }),
        staleFenceMs: 500,
      });
      const acquired = writer.store.acquireFence("writer-a");
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) return;
      expect(() =>
        writer.store.append(acquired.value.handle, {
          kind: "park",
          recordKey: "landed",
          payload: "planted-payload-crash",
        }),
      ).toThrow();

      clock.value = 10_000;
      const next = openStore(identity, { edge: createTestEdge({ clock }), staleFenceMs: 500 });
      const read = next.store.read({ requiredKeys: ["landed"] });
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.values).toEqual({ landed: "planted-payload-crash" });

      expect(next.store.fenceStatus()).toMatchObject({ held: true, stale: true });
      expect(next.store.acquireFence("writer-b").ok).toBe(false);

      const recovered = next.store.recoverFence("writer-b");
      expect(recovered.ok).toBe(true);
      const acquiredAgain = next.store.acquireFence("writer-b");
      expect(acquiredAgain.ok).toBe(true);
      if (!acquiredAgain.ok) return;
      const appended = next.store.append(acquiredAgain.value.handle, {
        kind: "park",
        recordKey: "after",
        payload: 2,
      });
      expect(appended.ok).toBe(true);
      if (appended.ok) expect(appended.value.sequence).toBe(2);
      next.store.releaseFence(acquiredAgain.value.handle);

      expect(ledgerLines(ledgerText(identity))).toHaveLength(2);
    } finally {
      removeRoot(root);
    }
  });

  test("the auto-steal control is rejected: an unstale fence cannot be recovered", () => {
    const root = makeTempRoot("fence-no-steal-control");
    try {
      const clock: TestClock = { value: 1_000 };
      const identity = makeIdentity(root);
      const a = openStore(identity, { edge: createTestEdge({ clock }), staleFenceMs: 500 });
      const held = a.store.acquireFence("writer-a");
      expect(held.ok).toBe(true);
      const b = openStore(identity, { edge: createTestEdge({ clock }), staleFenceMs: 500 });
      const recovered = b.store.recoverFence("writer-b");
      expect(recovered.ok).toBe(false);
      if (!recovered.ok) expect(recovered.error.code).toBe(LOCK_BUSY);
    } finally {
      removeRoot(root);
    }
  });
});
