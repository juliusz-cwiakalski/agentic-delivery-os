/**
 * GH-346 TC-BIN-063 / 064 / 065 — the build identity and the version contract.
 *
 * The token matrix is produced through the build entry with injected git facts
 * (the same reader production spawns), so the four Appendix-A situations are
 * deterministic in a dirty worktree. The two-build comparison and the alias
 * normalisation use the same entry and the delivered entrypoint seam.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { captureBuildIdentity, compileArtifact } from "../../scripts/build-binary";

const ROOT = process.cwd();
const scratch = mkdtempSync(join(ROOT, "tmp/tmpdir/gh346-artifact-identity-"));
const COMMIT = "4bc7b61a2c3d4e5f60718293a4b5c6d7e8f90123";

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

const sink = (): { value: string; write: (chunk: string) => void } => {
  const state = {
    value: "",
    write: (chunk: string): void => {
      state.value += chunk;
    },
  };
  return state;
};

const renderVersion = async (options: {
  readonly declared: string;
  readonly argv?: readonly string[];
  readonly buildIdentity?: {
    readonly version: string;
    readonly commit: string;
    readonly builtAt: string;
    readonly dirty: boolean;
    readonly channel: string;
  };
}): Promise<{ readonly exit: number; readonly stdout: string; readonly stderr: string }> => {
  const stdout = sink();
  const stderr = sink();
  const exit = await runEntrypoint(options.argv ?? ["--version"], {
    streams: { stdout, stderr },
    environment: {},
    declaredWorkingName: options.declared,
    composeProgram: () => {
      throw new Error("the version read must not compose");
    },
    ...(options.buildIdentity === undefined ? {} : { buildIdentity: options.buildIdentity }),
  });
  return { exit, stdout: stdout.value, stderr: stderr.value };
};

describe("TC-BIN-064 the four identity situations render the declared tokens", () => {
  test("clean, dirty, no-git metadata, and non-compiled each report Appendix A", async () => {
    const clean = compileArtifact({
      root: ROOT,
      outDirectory: join(scratch, "clean"),
      git: (arguments_) => (arguments_.includes("status") ? "" : COMMIT),
      now: () => new Date("2026-11-18T12:00:00Z"),
    });
    expect(clean.identity.commit).toBe(COMMIT);
    expect(clean.identity.dirty).toBe(false);
    const cleanVersion = await renderVersion({
      declared: "jaiship",
      buildIdentity: clean.identity,
    });
    expect(cleanVersion.exit).toBe(0);
    expect(cleanVersion.stderr).toBe("");
    expect(cleanVersion.stdout).toBe(
      `jaiship ${clean.identity.version} (build ${COMMIT.slice(0, 7)})\n`,
    );
    expect(cleanVersion.stdout.trim().split("\n")).toHaveLength(1);
    expect(cleanVersion.stdout).not.toContain(clean.identity.builtAt);

    const dirty = compileArtifact({
      root: ROOT,
      outDirectory: join(scratch, "dirty"),
      git: (arguments_) => (arguments_.includes("status") ? " M tracked.ts" : COMMIT),
    });
    expect(dirty.identity.dirty).toBe(true);
    const dirtyVersion = await renderVersion({
      declared: "jaiship",
      buildIdentity: dirty.identity,
    });
    expect(dirtyVersion.stdout).toBe(
      `jaiship ${dirty.identity.version} (build ${COMMIT.slice(0, 7)}-dirty)\n`,
    );

    const noGit = compileArtifact({
      root: ROOT,
      outDirectory: join(scratch, "no-git"),
      git: () => undefined,
    });
    expect(noGit.identity.commit).toBe("unknown");
    expect(noGit.identity.dirty).toBe(false);
    const noGitVersion = await renderVersion({
      declared: "jaiship",
      buildIdentity: noGit.identity,
    });
    expect(noGitVersion.stdout).toBe(`jaiship ${noGit.identity.version} (build unknown)\n`);

    const nonCompiled = await renderVersion({ declared: "jaiship" });
    expect(nonCompiled.stdout).toBe("jaiship 0.0.0 (build dev)\n");
    expect(nonCompiled.exit).toBe(0);
    for (const line of [cleanVersion, dirtyVersion, noGitVersion, nonCompiled]) {
      expect(line.stdout).not.toContain("builtAt");
    }
  });
});

describe("TC-BIN-063 two builds: same identity, different bytes, declared limits", () => {
  test("the version line is identical, the bytes differ, and the limits are reported", () => {
    const first = compileArtifact({
      root: ROOT,
      outDirectory: join(scratch, "first"),
      git: (arguments_) => (arguments_.includes("status") ? "" : COMMIT),
      now: () => new Date("2026-11-18T12:00:00Z"),
    });
    const second = compileArtifact({
      root: ROOT,
      outDirectory: join(scratch, "second"),
      git: (arguments_) => (arguments_.includes("status") ? "" : COMMIT),
      now: () => new Date("2026-11-18T12:00:05Z"),
    });
    const firstBytes = readFileSync(first.path);
    const secondBytes = readFileSync(second.path);
    expect(firstBytes.length).toBeGreaterThan(0);
    expect(firstBytes.equals(secondBytes)).toBe(false);
    expect(first.identity.version).toBe(second.identity.version);
    expect(first.identity.commit).toBe(second.identity.commit);
    expect(first.size).toBe(firstBytes.length);
    expect(first.target).toMatch(/^[a-z0-9]+-[a-z0-9]+$/u);
    // No reproducibility claim: the build instant differs, and nothing claims a
    // byte-identical rebuild.
    expect(first.identity.builtAt).not.toBe(second.identity.builtAt);
  });
});

describe("TC-BIN-065 the version line shape and the alias line modulo the name", () => {
  test("one line, no extra field, --json byte-identical, alias line normalised", async () => {
    const identity = {
      version: "1.2.3",
      commit: COMMIT,
      builtAt: "2026-11-18T12:00:00.000Z",
      dirty: false,
      channel: "dev",
    };
    const primary = await renderVersion({ declared: "jaiship", buildIdentity: identity });
    const alias = await renderVersion({ declared: "delivery-os", buildIdentity: identity });
    const primaryJson = await renderVersion({
      declared: "jaiship",
      argv: ["--version", "--json"],
      buildIdentity: identity,
    });
    expect(primary.exit).toBe(0);
    expect(primary.stdout.trim().split("\n")).toHaveLength(1);
    expect(primary.stdout).not.toContain("{");
    expect(primaryJson.stdout).toBe(primary.stdout);
    expect(primary.stdout).toBe(`jaiship 1.2.3 (build ${COMMIT.slice(0, 7)})\n`);
    expect(alias.stdout).toBe(`delivery-os 1.2.3 (build ${COMMIT.slice(0, 7)})\n`);
    expect(primary.stdout.replace("jaiship", "<bin>")).toBe(
      alias.stdout.replace("delivery-os", "<bin>"),
    );
    // The delivered non-injected baseline cell still describes the alias.
    const baseline = JSON.parse(
      readFileSync(join(ROOT, "tests/fixtures/entrypoint/alias-baseline.json"), "utf8"),
    ) as { readonly cells: { readonly version: { readonly stdout: string } } };
    const delivered = await renderVersion({ declared: "delivery-os" });
    expect(delivered.stdout).toBe(baseline.cells.version.stdout);
    expect(existsSync(join(ROOT, "packages/cli/bin/delivery-os.ts"))).toBe(true);
    // The build entry's capture reads the same five fields the seam consumes.
    const captured = captureBuildIdentity({
      root: ROOT,
      git: (arguments_) => (arguments_.includes("status") ? "" : COMMIT),
      now: () => new Date("2026-11-18T12:00:00Z"),
    });
    expect(Object.keys(captured).sort()).toEqual([
      "builtAt",
      "channel",
      "commit",
      "dirty",
      "version",
    ]);
  });
});
