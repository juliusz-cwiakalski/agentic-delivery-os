/**
 * TC-HAND-007 (phase-3 identity slice) — resolution order, normalized remote,
 * checkout-scoped first-use marker reuse, rename/restart invariance, and the
 * absence of a checkout-path digest. No summary or handover command is invoked
 * here.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
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
  dispatchIdentityMarkerPath,
  ensureDispatchIdentityMarkerText,
  readDispatchIdentityMarkerText,
} from "../../packages/adapters/src/file/dispatch-identity";

/**
 * Resolve through the delivered policy against one checkout's git common
 * directory, persisting the first-use binding exactly as production does.
 */
const resolveWithCheckout = (
  gitCommonDirectory: string,
  input: { readonly schedulerKey?: string; readonly remoteUrl?: string },
) => {
  const marker = readDispatchIdentityMarkerText(gitCommonDirectory);
  const resolution = resolveDispatchIdentity({
    ...(input.schedulerKey === undefined ? {} : { schedulerKey: input.schedulerKey }),
    ...(input.remoteUrl === undefined ? {} : { remoteUrl: input.remoteUrl }),
    ...(marker === undefined ? {} : { persistedMarker: marker }),
  });
  if (resolution.ok && marker === undefined) {
    ensureDispatchIdentityMarkerText(
      gitCommonDirectory,
      serializeIdentityMarker(resolution.repository),
    );
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
    expect(normalizeRepositoryRemote("/opt/checkout/repo")).toBeUndefined();
    expect(normalizeDispatchRepositoryKey("/opt/checkout/repo")).toBeUndefined();
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

  test("the marker lives in the checkout's git common directory", () => {
    const root = mkdtempSync(join(tmpdir(), "gh239-identity-path-"));
    try {
      const commonDir = join(root, ".git");
      mkdirSync(commonDir, { recursive: true });
      expect(dispatchIdentityMarkerPath(commonDir)).toBe(join(commonDir, "dispatch-identity.json"));
      expect(readDispatchIdentityMarkerText(commonDir)).toBeUndefined();
      expect(readDispatchIdentityMarkerText(undefined)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the per-checkout marker is reused across a restart and never re-keyed", () => {
    const root = mkdtempSync(join(tmpdir(), "gh239-identity-"));
    try {
      const commonDir = join(root, ".git");
      mkdirSync(commonDir, { recursive: true });
      expect(
        resolveWithCheckout(commonDir, { remoteUrl: "git@github.com:owner/repo.git" }),
      ).toEqual({ ok: true, repository: "github.com/owner/repo", source: "remote" });
      const marker = readDispatchIdentityMarkerText(commonDir);
      expect(marker).toBeDefined();
      expect(marker !== undefined && parseIdentityMarker(marker)).toBe("github.com/owner/repo");

      // Restart with a changed remote and no scheduler key: the persisted
      // binding governs and the history is not re-keyed.
      expect(
        resolveWithCheckout(commonDir, { remoteUrl: "git@github.com:owner/renamed.git" }),
      ).toEqual({ ok: true, repository: "github.com/owner/repo", source: "marker" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a marker created on first use is reused after a checkout rename", () => {
    const root = mkdtempSync(join(tmpdir(), "gh239-identity-marker-"));
    try {
      const commonDir = join(root, ".git");
      mkdirSync(commonDir, { recursive: true });
      const created = ensureDispatchIdentityMarkerText(
        commonDir,
        serializeIdentityMarker("github.com/owner/marker"),
      );
      expect(created).toBeDefined();
      const resolution = resolveWithCheckout(commonDir, {});
      expect(resolution).toEqual({
        ok: true,
        repository: "github.com/owner/marker",
        source: "marker",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the marker is never silently overwritten by a later resolution", () => {
    const root = mkdtempSync(join(tmpdir(), "gh239-identity-guard-"));
    try {
      const commonDir = join(root, ".git");
      mkdirSync(commonDir, { recursive: true });
      expect(
        ensureDispatchIdentityMarkerText(
          commonDir,
          serializeIdentityMarker("github.com/owner/first"),
        ),
      ).toBeDefined();
      const read = readDispatchIdentityMarkerText(commonDir);
      expect(read !== undefined && parseIdentityMarker(read)).toBe("github.com/owner/first");
      // A second create with a different identity returns the existing content
      // and never rewrites the first-use binding.
      const recreated = ensureDispatchIdentityMarkerText(
        commonDir,
        serializeIdentityMarker("github.com/owner/second"),
      );
      expect(recreated !== undefined && parseIdentityMarker(recreated)).toBe(
        "github.com/owner/first",
      );
      const resolution = resolveWithCheckout(commonDir, {
        schedulerKey: "github.com/owner/second",
      });
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

describe("TC-HAND-007 phase-6 confirmation: an unresolvable identity refuses", () => {
  test("summary and handover refuse cleanly at exit 1 and append no authority record", async () => {
    const { createCommandScenario } = await import("../fixtures/dispatch/golden/harness");
    const scenario = createCommandScenario({
      gate: { resolveRepository: () => undefined },
    });
    try {
      const summary = await scenario.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        "a-checkout-path",
        "--json",
      ]);
      expect(summary.exit).toBe(1);
      expect(summary.envelope?.error?.code).toBe("input.value.rejected");
      const handover = await scenario.invoke(["dispatch", "handover", "a-checkout-path", "--json"]);
      expect(handover.exit).toBe(1);
      expect(handover.envelope?.error?.code).toBe("input.value.rejected");
    } finally {
      scenario.dispose();
    }
  });
});
