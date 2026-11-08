/**
 * TC-HAND-007 (phase-3 identity slice) — resolution order, normalized remote,
 * persisted first-use marker reuse, rename/restart invariance, and the absence
 * of a checkout-path digest. No summary or handover command is invoked here.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DISPATCH_IDENTITY_SCHEMA,
  isRepositoryIdentity,
  normalizeDispatchRepositoryKey,
  normalizeRepositoryRemote,
  parseIdentityMarker,
  resolveDispatchIdentity,
  serializeIdentityMarker,
} from "../../packages/core/src/domain/dispatch-identity";
import {
  ensureDispatchIdentityMarkerText,
  readDispatchIdentityMarkerText,
} from "../../packages/adapters/src/file/dispatch-identity";
import { appendDispatchAttempt } from "../../packages/core/src/app/dispatch-ledger";
import { makeIdentity, openStore } from "../fixtures/state/harness";
import { makeAttemptFor } from "../fixtures/dispatch/ledger";

const resolveWithStore = (
  store: ReturnType<typeof openStore>["store"],
  input: { readonly schedulerKey?: string; readonly remoteUrl?: string },
) => {
  const marker = readDispatchIdentityMarkerText(store);
  const resolution = resolveDispatchIdentity({
    ...(input.schedulerKey === undefined ? {} : { schedulerKey: input.schedulerKey }),
    ...(input.remoteUrl === undefined ? {} : { remoteUrl: input.remoteUrl }),
    ...(marker === undefined ? {} : { persistedMarker: marker }),
  });
  if (resolution.ok && marker === undefined) {
    ensureDispatchIdentityMarkerText(store, serializeIdentityMarker(resolution.repository));
  }
  return resolution;
};

describe("TC-HAND-007 identity normalization", () => {
  test("a scheduler key normalizes to host/owner/name", () => {
    expect(normalizeDispatchRepositoryKey("GitHub.com/Owner/Repo.git")).toBe(
      "github.com/Owner/Repo",
    );
    expect(isRepositoryIdentity("github.com/Owner/Repo")).toBe(true);
  });

  test("scp, ssh, and https remotes normalize to the same identity", () => {
    for (const remote of [
      "git@github.com:owner/repo.git",
      "ssh://git@github.com/owner/repo.git",
      "https://github.com/owner/repo.git",
      "https://token@github.com/owner/repo",
    ]) {
      expect(normalizeRepositoryRemote(remote), remote).toBe("github.com/owner/repo");
    }
  });

  test("a checkout path is never an identity", () => {
    expect(normalizeRepositoryRemote("/home/dev/checkout/repo")).toBeUndefined();
    expect(normalizeDispatchRepositoryKey("/home/dev/checkout/repo")).toBeUndefined();
    const resolution = resolveDispatchIdentity({});
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) expect(resolution.reason).toBe("unresolvable");
  });
});

describe("TC-HAND-007 resolution order and persisted binding", () => {
  test("the scheduler key wins over the remote when no binding is persisted", () => {
    const resolution = resolveDispatchIdentity({
      schedulerKey: "github.com/owner/scheduler",
      remoteUrl: "git@github.com:owner/remote.git",
    });
    expect(resolution).toEqual({
      ok: true,
      repository: "github.com/owner/scheduler",
      source: "scheduler",
    });
  });

  test("a persisted binding governs a later disagreement", () => {
    const resolution = resolveDispatchIdentity({
      schedulerKey: "github.com/owner/scheduler",
      remoteUrl: "git@github.com:owner/remote.git",
      persistedMarker: serializeIdentityMarker("github.com/owner/marker"),
    });
    expect(resolution).toEqual({
      ok: true,
      repository: "github.com/owner/marker",
      source: "marker",
    });
  });

  test("the normalized remote is the second step", () => {
    const resolution = resolveDispatchIdentity({
      remoteUrl: "git@github.com:owner/remote.git",
    });
    expect(resolution).toEqual({
      ok: true,
      repository: "github.com/owner/remote",
      source: "remote",
    });
  });

  test("the persisted marker is reused across a restart and never re-keyed", () => {
    const root = mkdtempSync(join(tmpdir(), "gh239-identity-"));
    try {
      const first = openStore(makeIdentity(root, { workspaceId: "workspace-identity" }));
      expect(
        resolveWithStore(first.store, { remoteUrl: "git@github.com:owner/repo.git" }),
      ).toEqual({ ok: true, repository: "github.com/owner/repo", source: "remote" });
      const marker = readDispatchIdentityMarkerText(first.store);
      expect(marker).toBeDefined();
      expect(marker !== undefined && parseIdentityMarker(marker)).toBe("github.com/owner/repo");

      // Restart with a changed remote and no scheduler key: the persisted
      // binding governs and the history is not re-keyed.
      const second = openStore(makeIdentity(root, { workspaceId: "workspace-identity" }));
      expect(
        resolveWithStore(second.store, { remoteUrl: "git@github.com:owner/renamed.git" }),
      ).toEqual({ ok: true, repository: "github.com/owner/repo", source: "marker" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a marker created through the store artifact is reused after a rename", () => {
    const root = mkdtempSync(join(tmpdir(), "gh239-identity-marker-"));
    try {
      const store = openStore(makeIdentity(root, { workspaceId: "workspace-marker" })).store;
      const created = ensureDispatchIdentityMarkerText(
        store,
        serializeIdentityMarker("github.com/owner/marker"),
      );
      expect(created).toBeDefined();
      const resolution = resolveWithStore(store, {});
      expect(resolution).toEqual({
        ok: true,
        repository: "github.com/owner/marker",
        source: "marker",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the marker is never silently regenerated while guarded records exist", () => {
    const root = mkdtempSync(join(tmpdir(), "gh239-identity-guard-"));
    try {
      const { store } = openStore(makeIdentity(root, { workspaceId: "workspace-guard" }));
      expect(
        ensureDispatchIdentityMarkerText(store, serializeIdentityMarker("github.com/owner/first")),
      ).toBeDefined();
      const read = readDispatchIdentityMarkerText(store);
      expect(read !== undefined && parseIdentityMarker(read)).toBe("github.com/owner/first");
      appendDispatchAttempt(store, "fence", makeAttemptFor("pr-open", { repository: "github.com/owner/first" }));
      // A guarded record exists; the artifact must not be regenerated, and the
      // persisted binding still governs.
      const recreated = ensureDispatchIdentityMarkerText(
        store,
        serializeIdentityMarker("github.com/owner/second"),
      );
      expect(recreated !== undefined && parseIdentityMarker(recreated)).toBe("github.com/owner/first");
      const resolution = resolveWithStore(store, { schedulerKey: "github.com/owner/second" });
      expect(resolution).toEqual({
        ok: true,
        repository: "github.com/owner/first",
        source: "marker",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the marker payload names its schema and never a checkout path digest", () => {
    const marker = serializeIdentityMarker("github.com/owner/repo");
    const parsed: unknown = JSON.parse(marker);
    expect(parsed).toMatchObject({
      schema: DISPATCH_IDENTITY_SCHEMA,
      repository: "github.com/owner/repo",
    });
    expect(marker.includes("/tmp/")).toBe(false);
    expect(marker.includes("/home/")).toBe(false);
  });
});
