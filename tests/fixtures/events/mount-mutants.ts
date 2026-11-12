/**
 * The GH-290 mount mutants (TC-EVT-064).
 *
 * Each mutant is applied to a temp copy of the shipped tree; the live tree is
 * never mutated. The helpers return the verdicts of the named guard so a case
 * can assert that exactly that guard fails and the unmutated tree does not.
 */
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { runHelpGuideCoverage } from "../../../scripts/checks/help-guide-coverage";

const ROOT = process.cwd();
export const M2_PAGE = "doc/planning/oss-tooling/milestones/m2/commands/events.md";
export const COVERAGE = "tests/fixtures/help-guide/coverage.json";
export const INVENTORY = "tests/structure/inventory.json";
export const ALLOWANCE_FILE = "tests/structure/content-inventory.test.ts";
export const COVERAGE_CHECK = "scripts/checks/help-guide-coverage.ts";
export const PARITY_CHECK = "tests/checks/reference-page-parity.test.ts";

const withCopy = <T>(mutate: (root: string) => void, inspect: (root: string) => T): T => {
  mkdirSync(join(ROOT, "tmp", "tmpdir"), { recursive: true });
  const root = mkdtempSync(join(ROOT, "tmp", "tmpdir", "gh290-mount-"));
  try {
    cpSync(
      join(ROOT, "doc/planning/oss-tooling/milestones"),
      join(root, "doc/planning/oss-tooling/milestones"),
      {
        recursive: true,
      },
    );
    cpSync(join(ROOT, "tests/fixtures/help-guide"), join(root, "tests/fixtures/help-guide"), {
      recursive: true,
    });
    mutate(root);
    return inspect(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const editJson = (path: string, edit: (value: Record<string, unknown>) => void): void => {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  edit(parsed);
  writeFileSync(path, `${JSON.stringify(parsed, null, 2)}\n`);
};

/** Mutant 3: the `commands` row is removed. */
export const commandRowRemoved = (): readonly string[] =>
  withCopy(
    (root) =>
      editJson(join(root, COVERAGE), (value) => {
        value.commands = (value.commands as string[]).filter((name) => name !== "events");
      }),
    (root) => runHelpGuideCoverage(root).map((failure) => `${failure.id}: ${failure.detail}`),
  );

/** Mutant 4a: the `referencePages` row is removed. */
export const referencePageRowRemoved = (): readonly string[] =>
  withCopy(
    (root) =>
      editJson(join(root, COVERAGE), (value) => {
        value.referencePages = (value.referencePages as string[]).filter(
          (page) => !page.endsWith("events.md"),
        );
      }),
    (root) => runHelpGuideCoverage(root).map((failure) => `${failure.id}: ${failure.detail}`),
  );

/** Mutant 4b: the page file is deleted. */
export const pageDeleted = (): readonly string[] =>
  withCopy(
    (root) => rmSync(join(root, M2_PAGE)),
    (root) => runHelpGuideCoverage(root).map((failure) => `${failure.id}: ${failure.detail}`),
  );

/** Mutant 5: the page loses its `--version` section. */
export const versionSectionRemoved = (): readonly string[] =>
  withCopy(
    (root) => {
      const path = join(root, M2_PAGE);
      writeFileSync(path, readFileSync(path, "utf8").replaceAll("--version", "version"));
    },
    (root) => runHelpGuideCoverage(root).map((failure) => `${failure.id}: ${failure.detail}`),
  );

/** The unmutated coverage verdict. */
export const cleanCoverage = (): readonly string[] =>
  withCopy(
    () => undefined,
    (root) => runHelpGuideCoverage(root).map((failure) => `${failure.id}: ${failure.detail}`),
  );

/** Guard text: the `events` page-root row must exist in both resolvers. */
export const pageRootRows = (): { coverage: boolean; parity: boolean } => ({
  coverage: readFileSync(join(ROOT, COVERAGE_CHECK), "utf8").includes('command === "events"'),
  parity: readFileSync(join(ROOT, PARITY_CHECK), "utf8").includes('command === "events"'),
});

/** Mutant 6: a new module is missing from the committed file inventory. */
export const inventoryRowRemoved = (root = ROOT): readonly string[] => {
  const inventory = JSON.parse(readFileSync(join(root, INVENTORY), "utf8")) as Record<
    string,
    string[]
  >;
  const listed = new Set(Object.values(inventory).flat());
  const missing: string[] = ["src/contracts/taxonomy.ts", "src/domain/event-projection.ts"];
  return missing.filter((file) => !listed.has(file));
};

/** Guard text: the executable allowance names the new modules. */
export const allowanceRows = (root = ROOT): { taxonomy: boolean; projection: boolean } => {
  const text = readFileSync(join(root, ALLOWANCE_FILE), "utf8");
  return {
    taxonomy: text.includes('"core/src/contracts/taxonomy.ts"'),
    projection: text.includes('"core/src/domain/event-projection.ts"'),
  };
};

/** Mutant 7/8: a temp root whose inventory/allowance text lacks the rows. */
export const strippedInventory = (): readonly string[] => {
  const root = mkdtempSync(join(ROOT, "tmp", "tmpdir", "gh290-inventory-"));
  try {
    mkdirSync(join(root, "tests/structure"), { recursive: true });
    const inventory = JSON.parse(readFileSync(join(ROOT, INVENTORY), "utf8")) as Record<
      string,
      string[]
    >;
    inventory.core = (inventory.core ?? []).filter(
      (file) => file !== "src/contracts/taxonomy.ts" && file !== "src/domain/event-projection.ts",
    );
    writeFileSync(join(root, INVENTORY), `${JSON.stringify(inventory, null, 2)}\n`);
    const text = readFileSync(join(ROOT, ALLOWANCE_FILE), "utf8")
      .replace(/ {2}"core\/src\/contracts\/taxonomy\.ts": \[[\s\S]*?\n {2}\],\n/u, "")
      .replace(/ {2}"core\/src\/domain\/event-projection\.ts": \[[\s\S]*?\n {2}\],\n/u, "");
    writeFileSync(join(root, ALLOWANCE_FILE), text);
    const missing = inventoryRowRemoved(root);
    const allowance = allowanceRows(root);
    return [
      ...missing.map((file) => `inventory missing ${file}`),
      ...(allowance.taxonomy ? [] : ["allowance missing taxonomy"]),
      ...(allowance.projection ? [] : ["allowance missing event-projection"]),
    ];
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

/** The delivered inline prompt-required list (18 names) for the control case. */
export const DELIVERED_INLINE_NAMES = [
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
  "projects",
] as const;

/** Files under the packages tree, for the tree-vs-inventory direction. */
export const packageFiles = (root = ROOT): readonly string[] => {
  const results: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules") continue;
        walk(next);
      } else if (entry.name.endsWith(".ts")) {
        results.push(next.replace(/^packages\/[^/]+\//u, ""));
      }
    }
  };
  for (const packageName of ["core", "adapters", "cli", "mcp", "opencode", "testkit"]) {
    walk(`packages/${packageName}`);
  }
  return results;
};
