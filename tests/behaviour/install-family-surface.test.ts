/**
 * GH-346 TC-INST-001..006 — the composed install family and its refusals.
 *
 * Both identities compose the family for exact parity; the primary identity
 * owns installation and the alias answers one typed refusal that names the
 * invoked identity, the owning role, and the documented remedy, and writes
 * nothing. Grammar refusals reuse the delivered `fallback.invocation`, and no
 * flag, argument, or environment value can redirect the destination.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createInstallCommandDefinition } from "../../packages/cli/src/commands/install";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { allHelpEntries, renderRootHelp } from "../../packages/cli/src/help";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/help/prompt-required-commands";
import { resolveBrandIdentity } from "../../packages/core/src/branding";
import {
  createFixtureArtifact,
  type FixtureArtifact,
  removeFixtureArtifact,
} from "../fixtures/install/artifact";
import {
  createInstallRuntime,
  createInstallScratch,
  fixtureIdentity,
  type InstallScratch,
  snapshotTree,
} from "../fixtures/install/home";
import { bufferSink } from "../golden/helpers";

const brandOf = (name: string) => {
  const resolved = resolveBrandIdentity({ workingName: name });
  if (!resolved.ok) throw new Error(`the resolver rejected ${name}`);
  return resolved.value;
};

type Run = {
  readonly exit: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly data?: unknown;
  readonly error?: { readonly code?: string; readonly summary?: string };
};

let scratch: InstallScratch;
let artifact: FixtureArtifact;

beforeAll(() => {
  scratch = createInstallScratch("family-surface");
  artifact = createFixtureArtifact("running");
});

afterAll(() => {
  removeFixtureArtifact(artifact);
  scratch.dispose();
});

const runAs = async (
  declaredWorkingName: string,
  argv: readonly string[],
  options: { readonly ownsInstallation?: boolean } = {},
): Promise<Run> => {
  const runtime = createInstallRuntime({
    scratch,
    runningArtifactPath: artifact.path,
    identity: fixtureIdentity(),
    ownsInstallation: options.ownsInstallation ?? declaredWorkingName === "jaiship",
    invokedIdentity: brandOf(declaredWorkingName).binaryName,
  });
  const install = createInstallCommandDefinition(runtime);
  const stdout = bufferSink();
  const stderr = bufferSink();
  const composeProgram = () => ({
    commands: Object.fromEntries(
      PROMPT_REQUIRED_COMMANDS.map((name) => [
        name,
        name === "install" ? install : { handler: () => ({ data: {} }) },
      ]),
    ),
  });
  const exit = await runEntrypoint(argv, {
    streams: { stdout, stderr },
    environment: {},
    declaredWorkingName,
    composeProgram,
    clock: { now: () => 1 },
    newRunId: () => "run-install-surface",
  });
  let data: unknown;
  let error: Run["error"];
  try {
    const envelope = JSON.parse(stdout.value) as {
      readonly data?: unknown;
      readonly error?: { readonly code?: string; readonly summary?: string };
    };
    data = envelope.data;
    error = envelope.error;
  } catch {
    // Human form: the assertions read the streams instead.
  }
  return { exit, stdout: stdout.value, stderr: stderr.value, data, error };
};

describe("TC-INST-001 five lifecycle entry points resolve through both composed programs", () => {
  test("5/5 resolve to the family handler on the primary identity", async () => {
    const entries: readonly (readonly string[])[] = [
      ["install", "--dry-run", "--json"],
      ["install", "status", "--json"],
      ["install", "rollback", "--json"],
      ["install", "uninstall", "--dry-run", "--json"],
      ["install", "purge", "--dry-run", "--json"],
    ];
    for (const argv of entries) {
      const run = await runAs("jaiship", argv);
      expect({ argv, code: run.error?.code }).not.toEqual({ argv, code: "fallback.internal" });
      expect({ argv, code: run.error?.code }).not.toEqual({ argv, code: "fallback.invocation" });
      const resolved = run.data !== undefined || run.error?.code?.startsWith("install.") === true;
      expect({ argv, resolved }).toEqual({ argv, resolved: true });
    }
  });

  test("5/5 resolve to the family handler on the alias, as one typed refusal", async () => {
    const entries: readonly (readonly string[])[] = [
      ["install", "--json"],
      ["install", "status", "--json"],
      ["install", "rollback", "--json"],
      ["install", "uninstall", "--json"],
      ["install", "purge", "--json"],
    ];
    for (const argv of entries) {
      const run = await runAs("delivery-os", argv);
      expect({ argv, code: run.error?.code }).toEqual({
        argv,
        code: "install.identity.not-owning",
      });
    }
  });
});

describe("TC-INST-002 root help and each entry's own help come from the static inventory", () => {
  test("root help lists the family as the twenty-sixth, and each entry has its five sections", () => {
    const brand = brandOf("jaiship");
    const help = renderRootHelp(brand);
    const families = help
      .split("\n")
      .filter((line) => /^ {2}[a-z][a-z0-9-]* {2}/u.test(line))
      .map((line) => line.trimStart().split("  ")[0]);
    expect(families).toHaveLength(27);
    expect(families.at(-2)).toBe("install");
    expect(families.at(-1)).toBe("loop");
    for (const path of [
      ["install"],
      ["install", "status"],
      ["install", "rollback"],
      ["install", "uninstall"],
      ["install", "purge"],
    ]) {
      const entry = allHelpEntries().find(
        (candidate) => candidate.path.join(" ") === path.join(" "),
      );
      expect({ path, found: entry !== undefined }).toEqual({ path, found: true });
      expect(entry?.usage.length).toBeGreaterThan(0);
      expect(entry?.examples.length).toBeGreaterThan(0);
      expect(entry?.seeAlso).toContain(
        "doc/planning/oss-tooling/milestones/m4/commands/install.md",
      );
    }
    const family = allHelpEntries().find((entry) => entry.path.join(" ") === "install");
    expect(family?.summary).toContain("installation is owned by the primary identity");
    expect(family?.summary).toContain("installed product binary");
    expect(family?.summary).not.toContain("jaiship");
  });

  test("no entry renders another family's flags", () => {
    const installEntries = allHelpEntries().filter((entry) => entry.path[0] === "install");
    for (const entry of installEntries) {
      const flags = entry.options.map(([flag]) => flag);
      expect(flags).not.toContain("--cache");
      expect(flags).not.toContain("--lane");
    }
    const status = installEntries.find((entry) => entry.path.join(" ") === "install status");
    expect(status?.options.map(([flag]) => flag)).not.toContain("--yes");
  });
});

describe("TC-INST-003 a missing family runtime is a containment, not an absent family", () => {
  test("an uncomposed family answers fallback.internal at exit 2 and writes nothing", async () => {
    const before = snapshotTree(scratch.home);
    const stdout = bufferSink();
    const stderr = bufferSink();
    const exit = await runEntrypoint(["install", "--json"], {
      streams: { stdout, stderr },
      environment: {},
      declaredWorkingName: "jaiship",
      composeProgram: () => ({ commands: {} }),
      clock: { now: () => 1 },
      newRunId: () => "run-install-missing",
    });
    expect(exit).toBe(2);
    const envelope = JSON.parse(stdout.value) as { readonly error?: { readonly code?: string } };
    expect(envelope.error?.code).toBe("fallback.internal");
    expect(snapshotTree(scratch.home)).toEqual(before);
  });
});

describe("TC-INST-004 the alias refuses all five typedly and writes nothing", () => {
  test("one line carries the invoked identity, the owning role, and the remedy", async () => {
    const before = snapshotTree(scratch.base);
    for (const argv of [
      ["install", "--json"],
      ["install", "status", "--json"],
      ["install", "rollback", "--json"],
      ["install", "uninstall", "--json"],
      ["install", "purge", "--yes", "--json"],
    ]) {
      const run = await runAs("delivery-os", argv);
      expect(run.exit).toBe(1);
      const summary = run.error?.summary ?? "";
      expect(summary).toContain("delivery-os");
      expect(summary).toContain("does not own installation");
      expect(summary).toContain("owned by the primary identity");
      expect(summary).toContain("installed product binary");
      expect(summary).not.toContain("jaiship");
    }
    expect(snapshotTree(scratch.base)).toEqual(before);
  });

  test("the working-name override moves neither side's ownership", async () => {
    const runtime = createInstallRuntime({
      scratch,
      runningArtifactPath: artifact.path,
      identity: fixtureIdentity(),
      ownsInstallation: false,
      invokedIdentity: "renamed-tool",
    });
    const install = createInstallCommandDefinition(runtime);
    const envelope = await install.handler({
      command: "install",
      flags: { "--json": true },
      argv: ["install", "--json"],
      positionals: [],
      brand: brandOf("delivery-os"),
    } as never);
    expect((envelope as { readonly error?: { readonly code?: string } }).error?.code).toBe(
      "install.identity.not-owning",
    );
  });

  test("other alias commands keep the delivered shape", async () => {
    const version = await runAs("delivery-os", ["--version"]);
    expect(version.exit).toBe(0);
    expect(version.stdout).toBe("delivery-os 0.0.0 (build dev)\n");
    const help = await runAs("delivery-os", ["--help"]);
    expect(help.exit).toBe(0);
    expect(help.stdout).toContain("Commands:");
  });
});

describe("TC-INST-005 grammar refusals reuse fallback.invocation and write nothing", () => {
  test("an unknown subcommand, an unrecognised flag, and a destination argument refuse", async () => {
    const before = snapshotTree(scratch.base);
    for (const argv of [
      ["install", "upgrade", "--json"],
      ["install", "--invented-flag", "--json"],
      ["install", "--target", "/tmp/elsewhere", "--json"],
      ["install", "status", "/tmp/elsewhere", "--json"],
    ]) {
      const run = await runAs("jaiship", argv);
      expect({ argv, exit: run.exit }).toEqual({ argv, exit: 1 });
      expect({ argv, code: run.error?.code }).toEqual({ argv, code: "fallback.invocation" });
    }
    expect(snapshotTree(scratch.base)).toEqual(before);
  });
});

describe("TC-INST-006 no flag, argument, or environment value redirects the destination", () => {
  test("the effective destination is always the resolver's brand install path", async () => {
    const runtime = createInstallRuntime({
      scratch,
      runningArtifactPath: artifact.path,
      identity: fixtureIdentity(),
      environment: { HOME: scratch.home, JAISHIP_INSTALL_DIR: "/tmp/elsewhere" },
    });
    const install = createInstallCommandDefinition(runtime);
    const outcome = (await install.handler({
      command: "install",
      flags: { "--json": true },
      argv: ["install"],
      positionals: [],
      brand: brandOf("jaiship"),
    } as never)) as { readonly data?: { readonly destination?: string } };
    expect(outcome.data?.destination).toBe(scratch.destinationPath);
    expect(outcome.data?.destination).toBe(
      brandOf("jaiship").installPath.replace("~", scratch.home),
    );
  });
});
