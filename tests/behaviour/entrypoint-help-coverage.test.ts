/**
 * TC-ENTRY-004 — every prompt-required command and subcommand has
 * man-page-grade help: usage, options, at least one example, exit codes, and a
 * see-also pointer. Examples are syntactically accepted and every see-also
 * target maps to a static coverage inventory row.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { allHelpEntries, helpEntryFor } from "../../packages/cli/src/help";
import { type CommandProgram, runCli } from "../../packages/cli/src/index";
import { HELP_TUPLES, syntheticPromptProgram } from "../fixtures/entrypoint/programs";
import { bufferSink } from "../golden/helpers";

const coverage = JSON.parse(
  readFileSync(join(process.cwd(), "tests/fixtures/help-guide/coverage.json"), "utf8"),
) as { readonly referencePages: readonly string[]; readonly commands: readonly string[] };

const optionsOf = (path: readonly string[]): string[] => {
  const help = helpEntryFor(path);
  if (help === undefined) return [];
  const flags: string[] = [];
  for (const [flag] of help.options) {
    const name = flag.split(" ")[0];
    if (name?.startsWith("--") === true) flags.push(name);
  }
  return flags;
};

const parserProgram = (): CommandProgram => {
  const commands: Record<
    string,
    {
      handler: () => { data: Record<string, never> };
      flags: string[];
      positionals: { max: number };
    }
  > = {};
  for (const help of allHelpEntries()) {
    if (help.path.length === 0) continue;
    const name = help.path[0];
    if (name === undefined) continue;
    const flags = new Set<string>(optionsOf([name]));
    // A subcommand tuple exercises the same command definition.
    commands[name] = {
      handler: () => ({ data: {} }),
      flags: [...flags],
      positionals: { max: 8 },
    };
  }
  return { commands };
};

const runFor = async (args: readonly string[]) => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const exitCode = await runEntrypoint(args, {
    streams: { stdout, stderr },
    environment: {},
    configuredWorkingName: "example-product",
    composeProgram: () => parserProgram(),
    clock: { now: () => 1 },
    newRunId: () => "run-help-coverage",
  });
  return { exitCode, stdout: stdout.value, stderr: stderr.value };
};

describe("TC-ENTRY-004 help coverage", () => {
  test("every tuple exits 0 and carries the five declared sections", async () => {
    const failures: string[] = [];
    for (const tuple of HELP_TUPLES) {
      const run = await runFor(tuple.args);
      if (run.exitCode !== 0) failures.push(`${tuple.args.join(" ")} exited ${run.exitCode}`);
      for (const section of ["Usage:", "Options:", "Examples:", "Exit codes:", "See also:"]) {
        if (!run.stdout.includes(section)) {
          failures.push(`${tuple.args.join(" ")} is missing ${section}`);
        }
      }
      if (!run.stdout.includes("example-product")) {
        failures.push(`${tuple.args.join(" ")} does not render the binary identity`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("every example parses without a fallback.invocation code", async () => {
    const failures: string[] = [];
    const program = parserProgram();
    const brand = {
      productName: "example-product",
      binaryName: "example-product",
      packageScope: "@example-scope",
      environmentPrefix: "EXAMPLE_PRODUCT_",
      configDirectoryName: ".example-product",
      stateDirectoryName: ".example-product-state",
      mcpToolPrefix: "example-product_",
      telemetryNamespace: "delivery",
      docsBaseUrl: "https://example-scope.github.io/example-product/",
      repositoryUrl: "https://github.com/example-scope/example-product",
      releaseAssetPrefix: "example-product-",
      installPath: "~/.example-product/bin/example-product",
    };
    for (const help of allHelpEntries()) {
      if (help.path.length === 0) continue;
      for (const example of help.examples) {
        const tokens = example
          .replaceAll("<binary>", "example-product")
          .match(/"[^"]*"|\S+/g)
          ?.map((token) => token.replace(/^"|"$/g, ""));
        if (tokens === undefined) continue;
        const argv = tokens.slice(1);
        const stdout = bufferSink();
        const stderr = bufferSink();
        const exitCode = await runCli(
          ["--json", ...argv],
          { stdout, stderr },
          {
            brand,
            clock: { now: () => 1 },
            newRunId: () => "run-example",
            secrets: [],
            program,
          },
        );
        const parsed = JSON.parse(stdout.value) as { error?: { code?: string } };
        if (exitCode === 1 && parsed.error?.code === "fallback.invocation") {
          failures.push(`example "${example}" is not accepted by the parser`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  test("every see-also target maps to a coverage inventory row", () => {
    const missing: string[] = [];
    for (const help of allHelpEntries()) {
      for (const target of help.seeAlso) {
        if (!coverage.referencePages.includes(target)) {
          missing.push(`${help.path.join(" ")} -> ${target}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  test("the coverage inventory names exactly the prompt-required commands", async () => {
    const run = await runFor(["--help"]);
    expect(run.exitCode).toBe(0);
    expect([...coverage.commands].sort()).toEqual(
      [
        "status",
        "brief",
        "queue",
        "lanes",
        "blockers",
        "phase",
        "commit",
        "lint",
        "plan",
        "verify",
        "merge",
        "closeout",
        "spend",
        "retro",
        "dispatch",
        "coordinator",
        "daemon",
      ].sort(),
    );
  });

  test("the synthetic program defines the same commands the inventory names", () => {
    const program = syntheticPromptProgram();
    expect(Object.keys(program.commands).sort()).toEqual([...coverage.commands].sort());
  });
});
