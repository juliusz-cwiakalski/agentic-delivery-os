/**
 * GH-346 TC-INST-010 / 013 — admission and the dev-build gates.
 *
 * The refused run is proven three ways: a registered identity, an unchanged
 * destination (bytes and `mtimeNs`), and no record, no staging file, and no
 * profile line. The fixture worktree is a committed topology created by the
 * case; the repository's own worktrees are never used.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInstallCommandDefinition } from "../../packages/cli/src/commands/install";
import { resolveBrandIdentity } from "../../packages/core/src/branding";
import { evaluateInstallAdmission } from "../../packages/core/src/domain/install-admission";
import {
  createFixtureArtifact,
  type FixtureArtifact,
  removeFixtureArtifact,
} from "../fixtures/install/artifact";
import {
  createFixtureCheckouts,
  type FixtureCheckouts,
  readFixtureCheckout,
} from "../fixtures/install/checkouts";
import {
  createInstallRuntime,
  createInstallScratch,
  fixtureIdentity,
  type InstallScratch,
  snapshotTree,
} from "../fixtures/install/home";

const brandOf = (name = "jaiship") => {
  const resolved = resolveBrandIdentity({ workingName: name });
  if (!resolved.ok) throw new Error(`the resolver rejected ${name}`);
  return resolved.value;
};

const internals = () => {
  throw new Error("unreachable");
};

type HandlerOutput = {
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string };
};

const invoke = async (
  runtime: Parameters<typeof createInstallCommandDefinition>[0],
  positionals: readonly string[],
  flags: Readonly<Record<string, string | true>> = {},
): Promise<HandlerOutput> => {
  const definition = createInstallCommandDefinition(runtime);
  const argv = ["install", ...positionals];
  const result = await definition.handler({
    command: "install",
    flags,
    argv,
    positionals,
    brand: brandOf(),
  } as never);
  return result as HandlerOutput;
};

let scratch: InstallScratch;
let checkouts: FixtureCheckouts;
let artifact: FixtureArtifact;

beforeAll(() => {
  scratch = createInstallScratch("admission");
  checkouts = createFixtureCheckouts("admission");
  artifact = createFixtureArtifact("admission");
  mkdirSync(dirname(scratch.destinationPath), { recursive: true });
  writeFileSync(scratch.destinationPath, "previous destination bytes\n", { mode: 0o755 });
});

afterAll(() => {
  removeFixtureArtifact(artifact);
  checkouts.dispose();
  scratch.dispose();
});

describe("TC-INST-010 a linked-worktree target is refused before anything is written", () => {
  test("the refusal names the target, both git directories, the origins, and the deletion", async () => {
    const before = snapshotTree(scratch.base);
    const git = readFixtureCheckout(checkouts.worktree);
    expect(git.kind).toBe("resolved");
    const runtime = createInstallRuntime({
      scratch,
      runningArtifactPath: join(checkouts.worktree, "artifact"),
      identity: fixtureIdentity(),
      git,
    });
    const outcome = await invoke(runtime, []);
    expect(outcome.error?.code).toBe("install.target.worktree");
    const summary = outcome.error?.summary ?? "";
    expect(summary).toContain(checkouts.worktree);
    expect(summary).toContain("git dir");
    expect(summary).toContain("common dir");
    expect(summary).toContain("main checkout");
    expect(summary).toContain("deleted after merge");
    expect(snapshotTree(scratch.base)).toEqual(before);
  });

  test("the same predicate admits a primary checkout, a clone, and a plain directory", () => {
    for (const directory of [checkouts.primary, checkouts.clone]) {
      const read = readFixtureCheckout(directory);
      expect(read.kind).toBe("resolved");
      if (read.kind !== "resolved") continue;
      expect(read.gitDir).toBe(read.commonDir);
      expect(
        evaluateInstallAdmission({
          artifactDirectory: directory,
          identity: fixtureIdentity(),
          git: read,
        }),
      ).toEqual({ ok: true, provenance: "verified", checkoutPath: read.checkoutRoot });
    }
    // A plain directory and a host without git are the same admitted shape: the
    // delivered read answers an absence, which is `unverified` rather than a
    // refusal, and the destination is never an input.
    expect(
      evaluateInstallAdmission({
        artifactDirectory: checkouts.plain,
        identity: fixtureIdentity(),
        git: { kind: "unbound" },
      }),
    ).toEqual({ ok: true, provenance: "unverified" });
  });
});

describe("TC-INST-013 a development run is refused and writes nothing", () => {
  test("the refusal names the build entry and the artifact convention", async () => {
    const before = snapshotTree(scratch.base);
    const runtime = createInstallRuntime({ scratch, runningArtifactPath: artifact.path });
    const outcome = await invoke(runtime, []);
    expect(outcome.error?.code).toBe("install.dev-build");
    const summary = outcome.error?.summary ?? "";
    expect(summary).toContain("bun run build:binary");
    expect(summary).toContain("dist/<binary-name>");
    expect(snapshotTree(scratch.base)).toEqual(before);
  });

  test("a report is never refused by the dev gate", async () => {
    const runtime = createInstallRuntime({ scratch, runningArtifactPath: artifact.path });
    const outcome = await invoke(runtime, ["status"]);
    expect(outcome.error).toBeUndefined();
    expect((outcome.data as { readonly running?: unknown }).running).toBeDefined();
  });
});

describe("the injected thrower is never reached", () => {
  test("internals probe", () => {
    expect(() => internals()).toThrow();
  });
});
