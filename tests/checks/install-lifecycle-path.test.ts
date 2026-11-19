/**
 * GH-346 TC-INST-070..076 — the managed PATH block and the migration hook
 * (F-12, F-13; DM-5, OQ-TP-7, NG-1).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createNodeInstallFilePort } from "../../packages/adapters/src/file/index";
import { createInstallCommandDefinition } from "../../packages/cli/src/commands/install";
import { resolveBrandIdentity } from "../../packages/core/src/branding";
import type { InstallFilePort } from "../../packages/core/src/contracts/install";
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
  readRecordText,
} from "../fixtures/install/home";

const brand = (() => {
  const resolved = resolveBrandIdentity({ workingName: "jaiship" });
  if (!resolved.ok) throw new Error("the resolver rejected jaiship");
  return resolved.value;
})();

type Output = {
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string };
};
const dataOf = (outcome: Output): Record<string, unknown> => outcome.data ?? {};

const invoke = async (
  runtime: ReturnType<typeof createInstallRuntime>,
  positionals: readonly string[] = [],
  flags: Readonly<Record<string, string | true>> = {},
): Promise<Output> => {
  const definition = createInstallCommandDefinition(runtime);
  return (await definition.handler({
    command: "install",
    flags,
    argv: ["install", ...positionals],
    positionals,
    brand,
  } as never)) as Output;
};

let running: FixtureArtifact;
let other: FixtureArtifact;
let base: InstallScratch;

beforeAll(() => {
  running = createFixtureArtifact("path-running");
  other = createFixtureArtifact("path-other");
  base = createInstallScratch("path-base");
});

afterAll(() => {
  removeFixtureArtifact(running);
  removeFixtureArtifact(other);
  base.dispose();
});

const fresh = (): InstallScratch => createInstallScratch("path");
const runtimeFor = (target: InstallScratch, shell?: string) =>
  createInstallRuntime({
    scratch: target,
    runningArtifactPath: running.path,
    identity: fixtureIdentity(),
    environment: { HOME: target.home, ...(shell === undefined ? {} : { SHELL: shell }) },
  });

describe("TC-INST-070 the PATH block is appended once, recorded, and replaced in place", () => {
  test("an identical block is not re-appended and different content is replaced", async () => {
    const target = fresh();
    try {
      mkdirSync(target.home, { recursive: true });
      const profile = join(target.home, ".zshrc");
      writeFileSync(profile, "# operator profile\n");
      const first = await invoke(runtimeFor(target, "/bin/zsh"), [], { "--add-to-path": true });
      expect(first.error).toBeUndefined();
      const recorded = dataOf(first).pathBlock as {
        readonly file?: string;
        readonly marker?: string;
      };
      expect(recorded.file).toBe(profile);
      expect(recorded.marker).toBe("jaiship-install-path");
      const textOnce = readFileSync(profile, "utf8");
      expect(textOnce.match(/jaiship-install-path >>>/gu)).toHaveLength(1);
      expect(textOnce).toContain(`export PATH="${target.installDirectory}:$PATH"`);
      // Idempotent re-run.
      await invoke(runtimeFor(target, "/bin/zsh"), [], { "--add-to-path": true });
      expect(readFileSync(profile, "utf8")).toBe(textOnce);
      // Different content is replaced in place, never duplicated.
      writeFileSync(profile, textOnce.replace(target.installDirectory, "/old/place"));
      await invoke(runtimeFor(target, "/bin/zsh"), [], { "--add-to-path": true });
      const replaced = readFileSync(profile, "utf8");
      expect(replaced.match(/jaiship-install-path >>>/gu)).toHaveLength(1);
      expect(replaced).toContain(target.installDirectory);
      expect(replaced).not.toContain("/old/place");
      expect(replaced.startsWith("# operator profile\n")).toBe(true);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-070a the managed block is written once per path and its failure is typed", () => {
  test("a replacing install and an agreement run each write the profile once", async () => {
    const target = fresh();
    try {
      mkdirSync(target.home, { recursive: true });
      const profile = join(target.home, ".zshrc");
      const node = createNodeInstallFilePort();
      const writes: string[] = [];
      const counting: InstallFilePort = {
        ...node,
        writeStaged: (path, bytes, mode) => {
          writes.push(path);
          return node.writeStaged(path, bytes, mode);
        },
      };
      const countingRuntime = createInstallRuntime({
        scratch: target,
        runningArtifactPath: running.path,
        identity: fixtureIdentity(),
        environment: { HOME: target.home, SHELL: "/bin/zsh" },
        fs: counting,
      });
      // A first, replacing install writes the block exactly once.
      const first = await invoke(countingRuntime, [], { "--add-to-path": true });
      expect(first.error).toBeUndefined();
      expect(writes.filter((path) => path === profile)).toHaveLength(1);
      // A second, agreeing install writes it exactly once too, never twice.
      writes.length = 0;
      const second = await invoke(countingRuntime, [], { "--add-to-path": true });
      expect(second.error).toBeUndefined();
      expect(second.data?.outcome).toBe("unchanged");
      expect(writes.filter((path) => path === profile)).toHaveLength(1);
      expect(readFileSync(profile, "utf8").match(/jaiship-install-path >>>/gu)).toHaveLength(1);
    } finally {
      target.dispose();
    }
  });

  test("an explicit --shell-profile directory is created", async () => {
    const target = fresh();
    try {
      mkdirSync(target.home, { recursive: true });
      const profile = join(target.base, "custom", "nested", "profile");
      const outcome = await invoke(runtimeFor(target), [], {
        "--add-to-path": true,
        "--shell-profile": profile,
      });
      expect(outcome.error).toBeUndefined();
      expect(existsSync(profile)).toBe(true);
      expect(readFileSync(profile, "utf8")).toContain(target.installDirectory);
      expect((dataOf(outcome).pathBlock as { readonly file?: string } | undefined)?.file).toBe(
        profile,
      );
    } finally {
      target.dispose();
    }
  });

  test("a separator-less --shell-profile creates no stray sibling and removal targets the same file", async () => {
    const target = fresh();
    const previous = process.cwd();
    try {
      process.chdir(target.base);
      const profile = ".zshrc";
      const installed = await invoke(runtimeFor(target), [], {
        "--add-to-path": true,
        "--shell-profile": profile,
      });
      expect(installed.error).toBeUndefined();
      // The bare name's parent is the working directory: no `.zshr` sibling.
      expect(readdirSync(target.base).sort()).toEqual([profile, "home", "state"]);
      expect(existsSync(join(target.base, ".zshr"))).toBe(false);
      expect(readFileSync(join(target.base, profile), "utf8")).toContain(target.installDirectory);
      const removed = await invoke(runtimeFor(target), ["uninstall"]);
      expect(removed.error).toBeUndefined();
      expect(readdirSync(target.base).sort()).toEqual([profile, "home", "state"]);
      expect(readFileSync(join(target.base, profile), "utf8")).not.toContain(
        "jaiship-install-path",
      );
    } finally {
      process.chdir(previous);
      target.dispose();
    }
  });

  test("a profile write that fails after the swap says the artifact is installed", async () => {
    const target = fresh();
    try {
      mkdirSync(target.installDirectory, { recursive: true });
      // A differing compiled artifact at the destination makes this a replacing run.
      writeFileSync(target.destinationPath, readFileSync(other.path), { mode: 0o755 });
      const node = createNodeInstallFilePort();
      const profile = join(target.home, ".zshrc");
      const failing: InstallFilePort = {
        ...node,
        writeStaged: (path, bytes, mode) =>
          path === profile
            ? { ok: false, reason: "the staged file could not be written" }
            : node.writeStaged(path, bytes, mode),
      };
      const refused = await invoke(
        createInstallRuntime({
          scratch: target,
          runningArtifactPath: running.path,
          identity: fixtureIdentity(),
          environment: { HOME: target.home, SHELL: "/bin/zsh" },
          fs: failing,
        }),
        [],
        { "--add-to-path": true },
      );
      expect(refused.error?.code).toBe("fallback.internal");
      const summary = refused.error?.summary ?? "";
      expect(summary).toContain("internal failure");
      expect(summary).toContain(`the artifact is now installed at ${target.destinationPath}`);
      expect(summary).toContain("the previous artifact is in the rollback slot");
      expect(summary).toContain(`was not written to ${profile}`);
      expect(summary).toContain("re-run install");
      // The tolerated step-7 shape: the swap landed, the record did not.
      expect(readFileSync(target.destinationPath)).toEqual(readFileSync(running.path));
      expect(readFileSync(target.slotPath)).toEqual(readFileSync(other.path));
      expect(readRecordText(target)).toBeUndefined();
    } finally {
      target.dispose();
    }
  });

  test("a profile write that fails is a typed refusal and no block is recorded", async () => {
    const target = fresh();
    try {
      mkdirSync(target.home, { recursive: true });
      const profile = join(target.home, ".zshrc");
      const node = createNodeInstallFilePort();
      const failing: InstallFilePort = {
        ...node,
        writeStaged: (path, bytes, mode) =>
          path === profile
            ? { ok: false, reason: "the staged file could not be written" }
            : node.writeStaged(path, bytes, mode),
      };
      // Arm 1: a first (replacing) install refuses before the record exists.
      const refused = await invoke(
        createInstallRuntime({
          scratch: target,
          runningArtifactPath: running.path,
          identity: fixtureIdentity(),
          environment: { HOME: target.home, SHELL: "/bin/zsh" },
          fs: failing,
        }),
        [],
        { "--add-to-path": true },
      );
      expect(refused.error?.code).toBe("fallback.internal");
      expect(refused.error?.summary).toContain(profile);
      expect(refused.error?.summary).toContain("PATH block was not written");
      expect(existsSync(profile)).toBe(false);
      const record = JSON.parse(readRecordText(target) ?? "{}") as {
        readonly pathBlock?: unknown;
      };
      expect(record.pathBlock).toBeUndefined();
      // Arm 2: a clean install records the block; the same failure on an
      // agreement run refuses and leaves both the record and the profile alone.
      const clean = await invoke(runtimeFor(target, "/bin/zsh"), [], { "--add-to-path": true });
      expect(clean.error).toBeUndefined();
      const recordBefore = readRecordText(target);
      const profileBefore = readFileSync(profile, "utf8");
      const refusedAgreement = await invoke(
        createInstallRuntime({
          scratch: target,
          runningArtifactPath: running.path,
          identity: fixtureIdentity(),
          environment: { HOME: target.home, SHELL: "/bin/zsh" },
          fs: failing,
        }),
        [],
        { "--add-to-path": true },
      );
      expect(refusedAgreement.error?.code).toBe("fallback.internal");
      expect(readRecordText(target)).toBe(recordBefore);
      expect(readFileSync(profile, "utf8")).toBe(profileBefore);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-071 the shell mapping selects exactly one declared profile file", () => {
  test("zsh, bash, and sh map to their declared files", async () => {
    for (const [shell, file] of [
      ["/bin/zsh", ".zshrc"],
      ["/usr/bin/bash", ".bashrc"],
      ["/bin/sh", ".profile"],
    ] as const) {
      const target = fresh();
      try {
        mkdirSync(target.home, { recursive: true });
        await invoke(runtimeFor(target, shell), [], { "--add-to-path": true });
        expect({ shell, exists: existsSync(join(target.home, file)) }).toEqual({
          shell,
          exists: true,
        });
        expect(readFileSync(join(target.home, file), "utf8")).toContain(target.installDirectory);
        for (const other of [".zshrc", ".bashrc", ".profile"].filter((name) => name !== file)) {
          expect(existsSync(join(target.home, other))).toBe(false);
        }
      } finally {
        target.dispose();
      }
    }
  });
});

describe("TC-INST-072 an unidentifiable shell refuses typedly and writes no profile", () => {
  test("no SHELL and no explicit path is install.shell-profile.unresolved", async () => {
    const target = fresh();
    try {
      mkdirSync(target.home, { recursive: true });
      const refused = await invoke(runtimeFor(target, "/bin/fish"), [], { "--add-to-path": true });
      expect(refused.error?.code).toBe("install.shell-profile.unresolved");
      expect(refused.error?.summary).toContain("--shell-profile");
      expect(existsSync(join(target.home, ".zshrc"))).toBe(false);
      expect(existsSync(join(target.home, ".bashrc"))).toBe(false);
      expect(existsSync(join(target.home, ".profile"))).toBe(false);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-073 without --add-to-path no profile file is written", () => {
  test("the run completes and no profile appears", async () => {
    const target = fresh();
    try {
      mkdirSync(target.home, { recursive: true });
      const outcome = await invoke(runtimeFor(target, "/bin/zsh"), []);
      expect(outcome.error).toBeUndefined();
      expect(existsSync(join(target.home, ".zshrc"))).toBe(false);
      expect(dataOf(outcome).pathBlock).toBeUndefined();
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-074 removal deletes exactly the managed block and nothing else", () => {
  test("uninstall leaves the rest of the profile byte-identical", async () => {
    const target = fresh();
    try {
      mkdirSync(target.home, { recursive: true });
      const profile = join(target.home, ".bashrc");
      writeFileSync(profile, "# operator profile\nkubectl() { :; }\n");
      await invoke(runtimeFor(target, "/bin/bash"), [], { "--add-to-path": true });
      await invoke(runtimeFor(target, "/bin/bash"), ["uninstall"]);
      expect(readFileSync(profile, "utf8")).toBe("# operator profile\nkubectl() { :; }\n");
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-075 prior-namespace artifacts are detected and advised, never moved", () => {
  test("one advisory line names them and no file changes", async () => {
    const target = fresh();
    try {
      const prior = join(target.home, ".delivery-os");
      mkdirSync(prior, { recursive: true });
      writeFileSync(join(prior, "config.yaml"), "provider: fixture\n");
      const runtime = createInstallRuntime({
        scratch: target,
        runningArtifactPath: running.path,
        identity: fixtureIdentity(),
        environment: { HOME: target.home },
        priorNamespaceArtifacts: [prior],
      });
      const outcome = await invoke(runtime, []);
      const advisories = dataOf(outcome).advisories as readonly string[];
      expect(advisories.some((line) => line.includes(prior))).toBe(true);
      expect(advisories.some((line) => line.includes("documented manual move"))).toBe(true);
      expect(readFileSync(join(prior, "config.yaml"), "utf8")).toBe("provider: fixture\n");
      expect(existsSync(join(target.home, ".jaiship"))).toBe(true);
    } finally {
      target.dispose();
    }
  });
});

describe("TC-INST-076 --migrate refuses typedly and a dry-run still detects", () => {
  test("the refusal names M4-S2 and the dry-run prints the detection list", async () => {
    const target = fresh();
    try {
      const prior = join(target.home, ".delivery-os");
      mkdirSync(prior, { recursive: true });
      const runtime = createInstallRuntime({
        scratch: target,
        runningArtifactPath: running.path,
        identity: fixtureIdentity(),
        environment: { HOME: target.home },
        priorNamespaceArtifacts: [prior],
      });
      const refused = await invoke(runtime, [], { "--migrate": true });
      expect(refused.error?.code).toBe("install.migration.unavailable");
      expect(refused.error?.summary).toContain("M4-S2");
      expect(refused.error?.summary).toContain("nothing was moved");
      const dry = await invoke(runtime, [], { "--migrate": true, "--dry-run": true });
      expect(dry.error).toBeUndefined();
      const joined = (dataOf(dry).plan as readonly string[]).join("\n");
      expect(joined).toContain(prior);
      expect(joined).toContain("nothing would be migrated");
    } finally {
      target.dispose();
    }
  });
});
