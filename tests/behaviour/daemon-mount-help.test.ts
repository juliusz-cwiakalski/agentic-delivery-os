/**
 * The mounted family's self-description (TC-DAEMON-011, 012, 013, 114).
 *
 * Help is a pure data lookup: every case asserts the rendered sections, the
 * declared flags, the see-also targets that resolve to real files, bounded
 * ANSI-free output, and the purity half — `--help` and `--version` compose
 * nothing and write nothing.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  allHelpEntries,
  helpEntryFor,
  renderHelp,
  renderRootHelp,
} from "../../packages/cli/src/help";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/help/prompt-required-commands";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";
import * as helpComposerInvoked from "../fixtures/daemon/mount-mutants/help-composer-invoked";

const helpText = (path: readonly string[]): string => {
  const entry = helpEntryFor(path);
  if (entry === undefined) throw new Error(`no help entry for ${path.join(" ")}`);
  return renderHelp(entry, SYNTHETIC_BRAND);
};

const SECTIONS = ["Usage:", "Options:", "Examples:", "Exit codes:", "See also:"] as const;

describe("TC-DAEMON-011 root help and the family page", () => {
  test("root --help lists the family with a one-line summary and composes nothing", async () => {
    const stdout = bufferSink();
    const stderr = bufferSink();
    let composerCalls = 0;
    const exitCode = await runEntrypoint(["--help"], {
      streams: { stdout, stderr },
      environment: {},
      configuredWorkingName: SYNTHETIC_BRAND.binaryName,
      composeProgram: () => {
        composerCalls += 1;
        throw new Error("help must not compose");
      },
    });
    expect(exitCode).toBe(0);
    expect(composerCalls).toBe(0);
    const row = stdout.value.split("\n").find((line) => line.startsWith("  daemon  "));
    expect(row).toBeDefined();
    expect((row ?? "").replace("  daemon  ", "").trim().length).toBeGreaterThan(0);
  });

  test("the family page renders the five declared sections and a see-also pointer", () => {
    const text = helpText(["daemon"]);
    for (const section of SECTIONS) expect(text).toContain(section);
    expect(text).toContain("start");
    expect(text).toContain("stop");
    expect(text).toContain("status");
    expect(text).toContain("install");
    expect(text).toContain("uninstall");
    expect(text).toContain("--foreground");
    expect(text).toContain("--live");
    expect(text).toContain("--mode");
    expect(text).toContain("commands/daemon.md");
    expect(text).toContain("man-page.md");
  });

  test("every see-also target of every daemon page resolves to a file", () => {
    for (const entry of allHelpEntries().filter((candidate) => candidate.path[0] === "daemon")) {
      for (const target of entry.seeAlso) {
        expect(existsSync(join(process.cwd(), target)), target).toBe(true);
      }
    }
  });

  test("the root listing is derived, not bespoke: it equals the family rows", () => {
    const rendered = renderRootHelp(SYNTHETIC_BRAND);
    for (const family of PROMPT_REQUIRED_COMMANDS) {
      expect(rendered).toContain(`  ${family}  `);
    }
  });
});

describe("TC-DAEMON-012 every subcommand answers --help at exit 0", () => {
  test("six daemon help tuples resolve, with the declared flags only", async () => {
    const paths = [
      ["daemon"],
      ["daemon", "start"],
      ["daemon", "stop"],
      ["daemon", "status"],
      ["daemon", "install"],
      ["daemon", "uninstall"],
    ] as const;
    let failures = 0;
    for (const path of paths) {
      const stdout = bufferSink();
      const stderr = bufferSink();
      const exitCode = await runEntrypoint([...path, "--help"], {
        streams: { stdout, stderr },
        environment: {},
        configuredWorkingName: SYNTHETIC_BRAND.binaryName,
        composeProgram: () => {
          throw new Error("help must not compose");
        },
      });
      if (exitCode !== 0) failures += 1;
      if (stderr.value.length > 0) failures += 1;
      const text = stdout.value;
      for (const section of SECTIONS) if (!text.includes(section)) failures += 1;
      expect(text).not.toContain("unknown flag");
      expect(text).not.toContain("unexpected argument");
    }
    expect(failures).toBe(0);
  });

  test("the declared flags only: no grammar widening", () => {
    const family = helpEntryFor(["daemon"]);
    expect(family).toBeDefined();
    const declared = (family?.options ?? []).map(([flag]) => flag);
    for (const flag of declared.filter((entry) => entry.startsWith("--"))) {
      expect([
        "--foreground",
        "--live",
        "--mode <mode>",
        "--json",
        "--verbose",
        "--pretty",
      ]).toContain(flag);
    }
    const status = helpEntryFor(["daemon", "status"]);
    expect((status?.options ?? []).map(([flag]) => flag)).toContain("--live");
    const stop = helpEntryFor(["daemon", "stop"]);
    expect((stop?.options ?? []).map(([flag]) => flag)).toContain("--mode <mode>");
    const start = helpEntryFor(["daemon", "start"]);
    expect((start?.options ?? []).map(([flag]) => flag)).toContain("--foreground");
  });
});

describe("TC-DAEMON-013 the help, parity, and conformance guards", () => {
  test("the inventory names the family and the page in both arrays", async () => {
    const coverage = (await import("../fixtures/help-guide/coverage.json")) as {
      default: { commands: readonly string[]; referencePages: readonly string[] };
    };
    const inventory = "default" in coverage ? coverage.default : (coverage as never);
    const value = inventory as { commands: readonly string[]; referencePages: readonly string[] };
    expect(value.commands).toContain("daemon");
    expect(value.referencePages).toContain(
      "doc/planning/oss-tooling/milestones/m1/commands/daemon.md",
    );
  });

  test("the reference page carries the help section and both flags", async () => {
    const page = await Bun.file(
      join(process.cwd(), "doc/planning/oss-tooling/milestones/m1/commands/daemon.md"),
    ).text();
    expect(page).toContain("## HELP");
    expect(page).toContain("--help");
    expect(page).toContain("--version");
    expect(page).not.toContain("not mounted");
  });
});

describe("TC-DAEMON-114 help and version purity", () => {
  test("--version composes nothing and writes nothing", async () => {
    const stdout = bufferSink();
    const stderr = bufferSink();
    let composerCalls = 0;
    const exitCode = await runEntrypoint(["--version"], {
      streams: { stdout, stderr },
      environment: {},
      configuredWorkingName: SYNTHETIC_BRAND.binaryName,
      composeProgram: () => {
        composerCalls += 1;
        throw new Error("version must not compose");
      },
    });
    expect(exitCode).toBe(0);
    expect(composerCalls).toBe(0);
    expect(stdout.value).toContain(SYNTHETIC_BRAND.binaryName);
  });

  test("the rendered help is bounded and ANSI-free", () => {
    for (const entry of allHelpEntries().filter((candidate) => candidate.path[0] === "daemon")) {
      const text = renderHelp(entry, SYNTHETIC_BRAND);
      expect(text.length).toBeLessThanOrEqual(4_000);
      expect(text).not.toContain("\u001b[");
      expect(text.split("\n").length).toBeLessThanOrEqual(120);
    }
  });

  test("the help-composer mutant is caught by the purity claim", () => {
    const source = readFileSync(join(process.cwd(), "packages/cli/src/entrypoint.ts"), "utf8");
    expect(helpComposerInvoked.violates(0)).toBe(false);
    expect(helpComposerInvoked.violates(1)).toBe(true);
    expect(helpComposerInvoked.apply(source)).not.toBe(source);
  });
});
