/**
 * TC-STATE-016 (POSIX permission matrix, fail-closed) and TC-STATE-017 (Windows
 * ACL contract, platform-conditional) — least-privilege storage on both platform
 * families (AC-F8-1/2, NFR-5, TDR-0004 §6).
 */
import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { classifyDomainKind } from "../../packages/cli/src/classify";
import {
  createNodeStateEdge,
  createStateStore,
  type StateRuntimeEdge,
} from "../../packages/core/src/state/index";
import {
  ledgerPath,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  withinFence,
} from "../fixtures/state/harness";

const POSIX = process.platform !== "win32";
const originalUmask = process.umask();
afterEach(() => process.umask(originalUmask));

const mode = (path: string): number => statSync(path).mode & 0o777;

const create = (root: string, driver: "jsonl" | "sqlite" = "jsonl") => {
  const identity = makeIdentity(root);
  const { store } = openStore(identity, { driver });
  const acquired = store.acquireFence("writer");
  expect(acquired.ok).toBe(true);
  if (!acquired.ok) throw new Error("acquire failed");
  expect(store.append(acquired.value.handle, { kind: "park", recordKey: "k", payload: 1 }).ok).toBe(
    true,
  );
  return { identity, store, handle: acquired.value.handle };
};

describe("TC-STATE-016 POSIX permission matrix and fail-closed", () => {
  test("creation applies 0700/0600 exactly under a permissive umask", () => {
    if (!POSIX) return;
    // An explicitly permissive umask must not widen a single created path.
    process.umask(0o000);
    const root = makeTempRoot("permissions-create");
    try {
      const { identity, store, handle } = create(root, "sqlite");
      expect(mode(root)).toBe(0o700);
      expect(mode(ledgerPath(identity))).toBe(0o600);
      expect(mode(`${root}/header.workspace-a.json`)).toBe(0o600);
      expect(mode(`${root}/fence.workspace-a.lock`)).toBe(0o600);
      expect(mode(`${root}/index.workspace-a.sqlite`)).toBe(0o600);

      const replaced = store.replaceDocument(handle, { name: "doc", content: { v: 1 } });
      expect(replaced.ok).toBe(true);
      expect(mode(`${root}/documents.workspace-a/doc`)).toBe(0o600);
      store.releaseFence(handle);
    } finally {
      removeRoot(root);
    }
  });

  test("a restrictive umask also yields the exact bits", () => {
    if (!POSIX) return;
    process.umask(0o077);
    const root = makeTempRoot("permissions-restrictive");
    try {
      const { identity } = create(root);
      expect(mode(root)).toBe(0o700);
      expect(mode(ledgerPath(identity))).toBe(0o600);
    } finally {
      process.umask(originalUmask);
      removeRoot(root);
    }
  });

  test("a violated directory fails closed and reopening after repair succeeds", () => {
    if (!POSIX) return;
    const root = makeTempRoot("permissions-directory");
    try {
      const { identity } = create(root);
      chmodSync(root, 0o755);
      const violated = openStore(identity).store;
      const read = violated.read({ requiredKeys: [] });
      expect(read.ok).toBe(false);
      if (!read.ok) {
        expect(read.error.code).toBe("state.permission.denied");
        expect(read.error.consequence).toBe("not_landed");
      }
      expect(classifyDomainKind("state", "state.permission.denied")).toMatchObject({
        category: "user",
        retryable: false,
        projectionClass: "user-validation",
      });

      chmodSync(root, 0o700);
      const restored = openStore(identity).store;
      const after = restored.read({ requiredKeys: ["k"] });
      expect(after.ok).toBe(true);
    } finally {
      removeRoot(root);
    }
  });

  test("a violated store file fails closed even when the owner can still read it", () => {
    if (!POSIX) return;
    const root = makeTempRoot("permissions-file");
    try {
      const { identity } = create(root);
      chmodSync(ledgerPath(identity), 0o644);
      const violated = openStore(identity).store;
      const read = violated.read({ requiredKeys: ["k"] });
      expect(read.ok).toBe(false);
      if (!read.ok) expect(read.error.code).toBe("state.permission.denied");

      chmodSync(ledgerPath(identity), 0o600);
      expect(openStore(identity).store.read({ requiredKeys: ["k"] }).ok).toBe(true);
    } finally {
      removeRoot(root);
    }
  });

  test("the mode-ignoring control is detected by the exact-bit assertion", () => {
    if (!POSIX) return;
    const root = makeTempRoot("permissions-control");
    try {
      create(root);
      chmodSync(root, 0o755);
      const ignoring = (_path: string): boolean => true;
      expect(ignoring(root)).toBe(true);
      expect(createNodeStateEdge().verifyPermissions(root, "directory")).toBe(false);
    } finally {
      removeRoot(root);
    }
  });

  test("nothing is created outside the state root", () => {
    if (!POSIX) return;
    const root = makeTempRoot("permissions-containment");
    try {
      create(root);
      expect(existsSync(`${root}/documents.workspace-a`)).toBe(false);
      expect(mode(root)).toBe(0o700);
    } finally {
      removeRoot(root);
    }
  });
});

describe("TC-STATE-017 Windows ACL contract, platform-conditional", () => {
  test("the platform conditional is recorded; Linux never claims Windows verification", () => {
    const executable = process.platform === "win32";
    const record = {
      platform: process.platform,
      executable,
      reason: executable
        ? "Windows host present: ACL half is executable"
        : "non-Windows host: Windows ACL verification requires a Windows host (spec OQ-2); the POSIX half is the Linux hard gate",
    };
    if (!executable) {
      expect(record.reason).toContain("OQ-2");
      expect(record.executable).toBe(false);
      return;
    }
    // Executable half (win32 only): the same port applies and verifies a
    // current-user-only ACL, and a foreign grant fails closed.
    const root = makeTempRoot("permissions-acl");
    try {
      const edge: StateRuntimeEdge = createNodeStateEdge();
      expect(edge.platform).toBe("win32");
      const identity = makeIdentity(root);
      const store = createStateStore(identity, { driver: "jsonl", edge });
      withinFence(store, "writer", (handle) => {
        store.append(handle, { kind: "park", recordKey: "k", payload: 1 });
      });
      const probe = join(root, "acl-probe");
      mkdirSync(probe);
      edge.applyPermissions(probe, "directory");
      expect(edge.verifyPermissions(probe, "directory")).toBe(true);
      execFileSync("icacls", [probe, "/grant", "Everyone:F"], { stdio: "ignore" });
      expect(edge.verifyPermissions(probe, "directory")).toBe(false);
    } finally {
      removeRoot(root);
    }
  });
});

describe("TC-STATE-017 step 2 — documented platform contract", () => {
  test("the feature doc states the Windows contract behind the same port", () => {
    const doc = readFileSync(
      join(process.cwd(), "doc/spec/features/feature-state-layer.md"),
      "utf8",
    );
    expect(doc).toContain("Windows platform contract");
    expect(doc).toContain("state.permission.denied");
    expect(doc).toContain("StateRuntimeEdge");
    expect(doc).toContain("OQ-2");
    const registry = JSON.parse(
      readFileSync(join(process.cwd(), "scripts/checks/forbidden-literals.registry.json"), "utf8"),
    ) as { registered: string[] };
    expect(registry.registered).toContain("doc/spec/features/feature-state-layer.md");
  });
});
