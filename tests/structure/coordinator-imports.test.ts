/**
 * TC-COORD-002 (domain half) — the coordinator domain tier is pure: no node:/
 * bun import, no clock, randomness, environment, network, timer, child process,
 * filesystem, or CPU read is reachable. Temp-copy mutants prove each guard.
 */
import { describe, expect, test } from "bun:test";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const DOMAIN = "packages/core/src/domain";
const COORDINATOR_FILES = [
  "coordinator-admission.ts",
  "coordinator-escalation.ts",
  "coordinator-evidence.ts",
  "coordinator-fence.ts",
  "coordinator-lifecycle.ts",
  "coordinator-observe.ts",
  "coordinator-regime.ts",
  "coordinator-wake.ts",
];

/** Every coordinator module in the pure domain tier. */
export const coordinatorDomainFiles = (root = ROOT): string[] =>
  readdirSync(join(root, DOMAIN))
    .filter((entry) => entry.startsWith("coordinator") && entry.endsWith(".ts"))
    .sort();

const FORBIDDEN_MODULES = [
  "node:",
  "bun:",
  "fs",
  "os",
  "child_process",
  "net",
  "http",
  "https",
  "dns",
  "worker_threads",
  "perf_hooks",
];

const FORBIDDEN_IDENTIFIERS = [
  "Date.now",
  "new Date",
  "performance",
  "process.env",
  "process.cpuUsage",
  "setTimeout",
  "setInterval",
  "Math.random",
  "fetch(",
  "readFile",
  "execSync",
];

/** The structural purity violations of one coordinator domain file. */
export const purityViolations = (root: string, file: string): string[] => {
  const relative = `${DOMAIN}/${file}`;
  const text = readFileSync(join(root, relative), "utf8");
  const violations: string[] = [];
  for (const marker of FORBIDDEN_IDENTIFIERS) {
    if (text.includes(marker)) violations.push(`${relative}: forbidden marker ${marker}`);
  }
  const source = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true);
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!ts.isStringLiteral(specifier)) {
      violations.push(`${relative}: non-literal import`);
      continue;
    }
    const value = specifier.text;
    const allowed =
      value === "#contracts" || (value.startsWith("./") && value.endsWith(".js"));
    if (!allowed) violations.push(`${relative}: forbidden import ${value}`);
    if (FORBIDDEN_MODULES.some((module) => value === module || value.startsWith(module))) {
      violations.push(`${relative}: runtime import ${value}`);
    }
  }
  return violations;
};

const mutateDomainFile = (
  file: string,
  mutate: (text: string) => string,
): { root: string; restore: () => void } => {
  const root = mkdtempSync(join(tmpdir(), "coordinator-domain-"));
  mkdirSync(join(root, DOMAIN), { recursive: true });
  for (const entry of coordinatorDomainFiles()) {
    cpSync(join(ROOT, DOMAIN, entry), join(root, DOMAIN, entry));
  }
  cpSync(join(ROOT, DOMAIN, "blockers.ts"), join(root, DOMAIN, "blockers.ts"));
  const path = join(root, DOMAIN, file);
  writeFileSync(path, mutate(readFileSync(path, "utf8")));
  return { root, restore: () => rmSync(root, { recursive: true, force: true }) };
};

describe("TC-COORD-002 the coordinator domain tier is pure and confined", () => {
  test("every coordinator domain file imports only #contracts and sibling modules", () => {
    const violations: string[] = [];
    for (const file of coordinatorDomainFiles()) {
      violations.push(...purityViolations(ROOT, file));
    }
    expect(violations).toEqual([]);
    expect(coordinatorDomainFiles()).toEqual(COORDINATOR_FILES);
  });

  test("a node:fs import in the domain fails naming the runtime import", () => {
    const mutated = mutateDomainFile("coordinator-evidence.ts", (text) =>
      `import { readFileSync } from "node:fs";\n${text}`,
    );
    try {
      const violations = purityViolations(mutated.root, "coordinator-evidence.ts");
      expect(violations.some((message) => message.includes("node:fs"))).toBe(true);
    } finally {
      mutated.restore();
    }
  });

  test("an ambient clock read in the domain fails naming the marker", () => {
    const mutated = mutateDomainFile("coordinator-lifecycle.ts", (text) =>
      `${text}\nexport const now = Date.now();\n`,
    );
    try {
      const violations = purityViolations(mutated.root, "coordinator-lifecycle.ts");
      expect(violations.some((message) => message.includes("Date.now"))).toBe(true);
    } finally {
      mutated.restore();
    }
  });

  test("an environment read in the domain fails naming the marker", () => {
    const mutated = mutateDomainFile("coordinator-evidence.ts", (text) =>
      `${text}\nexport const limit = process.env.LIMIT;\n`,
    );
    try {
      const violations = purityViolations(mutated.root, "coordinator-evidence.ts");
      expect(violations.some((message) => message.includes("process.env"))).toBe(true);
    } finally {
      mutated.restore();
    }
  });

  test("the domain imports no adapter, state, config, or app tier", () => {
    for (const file of coordinatorDomainFiles()) {
      const text = readFileSync(join(ROOT, DOMAIN, file), "utf8");
      for (const marker of ["#state", "#config", "#app", "#branding", "@delivery-os/adapters"]) {
        expect(text.includes(marker), `${file} must not import ${marker}`).toBe(false);
      }
    }
  });
});
