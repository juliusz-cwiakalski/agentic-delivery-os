/**
 * Help/guide coverage matrix (GH-242 F-9, NFR-5).
 *
 * The static inventory declares the prompt-required commands and the reference
 * pages they must have. The check fails when a command is missing a page, when
 * a page lacks `--help`/`--version`, or when the inventory itself drifts from
 * the prompt-required set.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/help/prompt-required-commands";

export const COVERAGE_PATH = "tests/fixtures/help-guide/coverage.json";
const PAGE_ROOT = "doc/planning/oss-tooling/milestones/m1/commands";

export type CoverageInventory = {
  readonly schemaVersion: string;
  readonly referencePages: readonly string[];
  readonly commands: readonly string[];
};

export type CoverageFailure = {
  readonly id: string;
  readonly detail: string;
};

const pageFor = (command: string): string => {
  if (command === "verify") return `${PAGE_ROOT}/verify-change.md`;
  return `${PAGE_ROOT}/${command}.md`;
};

export const runHelpGuideCoverage = (root = process.cwd()): readonly CoverageFailure[] => {
  const read = (relative: string): string => readFileSync(join(root, relative), "utf8");
  const inventory = JSON.parse(read(COVERAGE_PATH)) as CoverageInventory;
  const failures: CoverageFailure[] = [];

  for (const command of PROMPT_REQUIRED_COMMANDS) {
    if (!inventory.commands.includes(command)) {
      failures.push({ id: command, detail: "missing from the coverage inventory" });
      continue;
    }
    const page = pageFor(command);
    let text: string;
    try {
      text = read(page);
    } catch {
      failures.push({ id: command, detail: `missing reference page ${page}` });
      continue;
    }
    if (!text.includes("--help")) failures.push({ id: command, detail: `${page} lacks --help` });
    if (!text.includes("--version")) {
      failures.push({ id: command, detail: `${page} lacks --version` });
    }
    if (!inventory.referencePages.includes(page)) {
      failures.push({ id: command, detail: `${page} missing from referencePages` });
    }
  }

  for (const command of inventory.commands) {
    if (!(PROMPT_REQUIRED_COMMANDS as readonly string[]).includes(command)) {
      failures.push({ id: command, detail: "inventory names a non-prompt-required command" });
    }
  }
  const entry = "doc/planning/oss-tooling/milestones/m1/commands/entrypoint.md";
  if (!inventory.referencePages.includes(entry)) {
    failures.push({ id: "entrypoint", detail: "missing entrypoint reference page" });
  }
  return failures;
};

const isMain = (): boolean => {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
};

if (isMain()) {
  const failures = runHelpGuideCoverage();
  for (const failure of failures) process.stderr.write(`${failure.id}: ${failure.detail}\n`);
  if (failures.length > 0) {
    process.stderr.write(`help-guide-coverage: ${failures.length} failure(s)\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("help-guide-coverage: all prompt-required commands covered\n");
  }
}
