/**
 * TC-SCAFFOLD-016 — fixture-coverage meta-check. Every configured rule has at
 * least one registered case at `severity: error`, the mandatory importer set is
 * complete, both `subpath-undeclared` forms are registered, the ambient registry
 * covers the ADR neutral set, and deleting a case (including only the adapters
 * row) fails.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { validateFixtureCoverage } from "../../scripts/checks/secret-read-boundary";
import { SECRET_READ_CASES } from "../fixtures/secret-boundary/cases";
import {
  AMBIENT_CASES,
  AMBIENT_VIOLATION_CASES,
  DEPCRUISE_VIOLATION_CASES,
  RULE_CASES,
} from "./fixtures/cases";

const ROOT = process.cwd();
const require = createRequire(import.meta.url);

type RegistryEntry = { id: string; tc: string; path: string; wholePackage?: boolean };
type Registry = Record<string, RegistryEntry[]>;
type ForbiddenRule = { name: string; severity: string };

const config = require("../../.dependency-cruiser.cjs") as { forbidden: ForbiddenRule[] };
const registry = JSON.parse(
  readFileSync(join(ROOT, "tests/boundaries/fixture-registry.json"), "utf8"),
) as Registry;

const AMBIENT_RULE_IDS = ["ambient-globals-neutral-tiers", "ambient-env-branding"];
const MANDATORY_IMPORTER_RULES = [
  "matrix-core-importer",
  "matrix-adapters-importer",
  "matrix-cli-importer",
  "matrix-mcp-importer",
  "matrix-opencode-importer",
  "testkit-no-production-import",
  "testkit-no-surface-import",
];

const knownCaseIds = new Set([
  ...RULE_CASES.map((entry) => entry.id),
  ...AMBIENT_CASES.map((entry) => entry.id),
]);

export const validateRegistry = (candidate: Registry): string[] => {
  const failures: string[] = [];
  const configured = [...new Set(config.forbidden.map((rule) => rule.name))];

  for (const rule of config.forbidden) {
    if (rule.severity !== "error") {
      failures.push(`rule ${rule.name} has severity ${rule.severity}; only error is enforced`);
    }
  }
  for (const name of configured) {
    if (AMBIENT_RULE_IDS.includes(name)) continue;
    if ((candidate[name] ?? []).length === 0) {
      failures.push(`unenforced rule ${name}: no registered fixture case`);
    }
  }
  for (const name of AMBIENT_RULE_IDS) {
    if ((candidate[name] ?? []).length === 0) {
      failures.push(`unenforced ambient rule ${name}: no registered fixture case`);
    }
  }
  for (const key of Object.keys(candidate)) {
    if (!configured.includes(key) && !AMBIENT_RULE_IDS.includes(key)) {
      failures.push(`orphan registry key ${key}: no such rule in the configuration`);
    }
    for (const entry of candidate[key] ?? []) {
      if (!knownCaseIds.has(entry.id)) failures.push(`registry case ${entry.id} has no fixture`);
    }
  }

  for (const mandatory of MANDATORY_IMPORTER_RULES) {
    if ((candidate[mandatory] ?? []).length === 0) {
      failures.push(`mandatory importer rule ${mandatory} is not registered`);
    }
  }

  const undeclared = candidate["subpath-undeclared"] ?? [];
  if (!undeclared.some((entry) => entry.wholePackage === true)) {
    failures.push("subpath-undeclared is missing the whole-package root `.` case");
  }
  if (!undeclared.some((entry) => entry.wholePackage !== true)) {
    failures.push("subpath-undeclared is missing the subpath-level case");
  }

  const neutral = candidate["ambient-globals-neutral-tiers"] ?? [];
  const neutralPaths = neutral.map((entry) => entry.path);
  const coveredScopes: Array<[string, string[]]> = [
    ["the core `.` entry", ["packages/core/src/index.ts"]],
    ["`./contracts`", ["packages/core/src/contracts/"]],
    ["`domain`", ["packages/core/src/domain/"]],
    ["`app`", ["packages/core/src/app/"]],
    ["`config`", ["packages/core/src/config/"]],
    ["`branding`", ["packages/core/src/branding/"]],
  ];
  for (const [label, prefixes] of coveredScopes) {
    if (!neutralPaths.some((path) => prefixes.some((prefix) => path.startsWith(prefix)))) {
      failures.push(`ambient-globals-neutral-tiers is missing a registered case for ${label}`);
    }
  }
  if (!neutral.some((entry) => entry.id === "ambient-contracts-process-env")) {
    failures.push("ambient-globals-neutral-tiers is missing the process.env case in ./contracts");
  }
  if (!neutral.some((entry) => entry.path === "packages/core/src/index.ts")) {
    failures.push("ambient-globals-neutral-tiers is missing the `.` entry case");
  }

  const branding = candidate["ambient-env-branding"] ?? [];
  const brandingIds = branding.map((entry) => entry.id).join(" ");
  if (!brandingIds.includes("process-env")) {
    failures.push("ambient-env-branding is missing the process.env case");
  }
  if (!brandingIds.includes("bun-env")) {
    failures.push("ambient-env-branding is missing the Bun.env case");
  }

  return failures;
};

test("live registry covers every configured rule with error severity", () => {
  expect(validateRegistry(registry)).toEqual([]);
});

test("registered case counts match the committed fixture definitions", () => {
  const registeredIds = new Set(
    Object.values(registry)
      .flat()
      .map((entry) => entry.id),
  );
  const expectedIds = [
    ...DEPCRUISE_VIOLATION_CASES.map((entry) => entry.id),
    ...AMBIENT_VIOLATION_CASES.map((entry) => entry.id),
  ];
  expect([...registeredIds].sort()).toEqual([...expectedIds].sort());
});

test("deleting a registered case fails the meta-check", () => {
  const copy: Registry = JSON.parse(JSON.stringify(registry));
  const firstKey = Object.keys(copy)[0] as string;
  const entries = copy[firstKey] as RegistryEntry[];
  entries.pop();
  expect(validateRegistry(copy).length).toBeGreaterThan(0);
});

test("deleting only the matrix-adapters-importer case fails the meta-check", () => {
  const copy: Registry = JSON.parse(JSON.stringify(registry));
  delete copy["matrix-adapters-importer"];
  const failures = validateRegistry(copy);
  expect(failures.some((message) => message.includes("matrix-adapters-importer"))).toBe(true);
});

test("a rule at warn severity is treated as unenforced", () => {
  const copy: Registry = JSON.parse(JSON.stringify(registry));
  const original = config.forbidden.find((rule) => rule.name === "matrix-adapters-importer");
  if (original) original.severity = "warn";
  try {
    expect(validateRegistry(copy).some((message) => message.includes("severity warn"))).toBe(true);
  } finally {
    if (original) original.severity = "error";
  }
});

test("the secret-read rule registers a firing fixture and a clean control", () => {
  expect(validateFixtureCoverage(SECRET_READ_CASES)).toEqual([]);
});

test("deleting the only secret-read negative fixture fails the meta-check", () => {
  const failures = validateFixtureCoverage(
    SECRET_READ_CASES.filter((entry) => entry.expect === "clean"),
  );
  expect(failures.some((message) => message.includes("negative fixture"))).toBe(true);
});
