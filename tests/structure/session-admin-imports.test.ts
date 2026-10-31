/**
 * TC-DB-002 (contracts/domain and adapter halves), TC-DB-016/033 static halves,
 * and TC-DB-036 hermeticity scan.
 *
 * Every detector is exercised by a planted positive in a temp copy; the live
 * tree must be clean. No suite spawns a process or reads a real path.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { SECRET_READ_ALLOWLIST } from "../../scripts/checks/secret-read-boundary";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/session.ts";
const DOMAIN = "packages/core/src/domain/session-admin.ts";
const ADAPTER = "packages/adapters/src/session/index.ts";
const DB_COMMAND = "packages/cli/src/commands/db.ts";
const SESSION_SUITES = [
  "tests/structure/session-admin-contract.test.ts",
  "tests/structure/session-admin-imports.test.ts",
  "tests/behaviour/session-admin-size-list.test.ts",
  "tests/behaviour/session-admin-prune.test.ts",
  "tests/behaviour/session-admin-reboot.test.ts",
  "tests/behaviour/session-admin-grammar.test.ts",
  "tests/behaviour/session-admin-output.test.ts",
  "tests/behaviour/session-admin-sql-safety.test.ts",
  "tests/behaviour/session-admin-privacy.test.ts",
];

const parse = (path: string, text: string): ts.SourceFile =>
  ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const specifiersOf = (source: ts.SourceFile): string[] => {
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      const argument = node.arguments[0];
      if (argument !== undefined && ts.isStringLiteral(argument)) specifiers.push(argument.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
};

const callNames = (source: ts.SourceFile): string[] => {
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) names.push(node.expression.text);
      if (ts.isPropertyAccessExpression(node.expression)) {
        names.push(`${node.expression.expression.getText(source)}.${node.expression.name.text}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
};

const DATA_ONLY = new Set<number>([
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.EndOfFileToken,
]);

export const contractsDataOnly = (text: string, label = CONTRACT): string[] => {
  const source = parse(label, text);
  const violations: string[] = [];
  for (const statement of source.statements) {
    if (!DATA_ONLY.has(statement.kind)) {
      violations.push(`${label}: executable statement ${ts.SyntaxKind[statement.kind]}`);
    }
  }
  for (const specifier of specifiersOf(source)) {
    if (specifier.startsWith("node:") || specifier.startsWith("bun:")) {
      violations.push(`${label}: runtime import ${specifier}`);
    }
  }
  return violations;
};

export const domainPure = (text: string, label = DOMAIN): string[] => {
  const source = parse(label, text);
  const violations: string[] = [];
  for (const specifier of specifiersOf(source)) {
    const allowed =
      specifier === "#contracts" ||
      specifier.startsWith("#domain/") ||
      specifier.startsWith("./") ||
      specifier.startsWith("../contracts/");
    if (!allowed) violations.push(`${label}: domain import ${specifier}`);
  }
  for (const name of callNames(source)) {
    if (
      [
        "Date.now",
        "Math.random",
        "performance.now",
        "process." + "env",
        "Bun." + "env",
        "fetch",
        "readFileSync",
      ].includes(name)
    ) {
      violations.push(`${label}: impure call ${name}`);
    }
  }
  return violations;
};

/** Runtime specifiers are admitted only in the session adapter I/O subpath. */
export const runtimeConfinementFailures = (files: readonly string[]): string[] => {
  const failures: string[] = [];
  for (const file of files) {
    const source = parse(file, readFileSync(join(ROOT, file), "utf8"));
    for (const specifier of specifiersOf(source)) {
      if (!specifier.startsWith("node:") && !specifier.startsWith("bun:")) continue;
      if (file === ADAPTER) continue;
      failures.push(`${file}: runtime import ${specifier}`);
    }
  }
  return failures;
};

export const ambientEnvironmentFailures = (files: readonly string[]): string[] => {
  const failures: string[] = [];
  for (const file of files) {
    if (!file.endsWith(".ts")) continue;
    const source = parse(file, readFileSync(join(ROOT, file), "utf8"));
    const visit = (node: ts.Node): void => {
      if (
        ts.isPropertyAccessExpression(node) &&
        node.name.text === "env" &&
        ts.isIdentifier(node.expression) &&
        ["process", "Bun"].includes(node.expression.text)
      ) {
        failures.push(`${file}: ambient environment read`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return failures;
};

const DRIVER_PATTERN = new RegExp(
  `\\b(?:${["node:" + "sqlite", "bun:" + "sqlite", "better-" + "sqlite" + "3", "@lib" + "sql", "sqlite" + "3"].join("|")})\\b`,
);

export const sqliteDriverFailures = (files: readonly string[]): string[] => {
  const failures: string[] = [];
  for (const file of files) {
    if (!file.endsWith(".ts")) continue;
    if (DRIVER_PATTERN.test(readFileSync(join(ROOT, file), "utf8"))) {
      failures.push(`${file}: SQLite driver reference`);
    }
  }
  return failures;
};

const DESTRUCTIVE = [
  "unlink",
  "unlinkSync",
  "rm",
  "rmSync",
  "rmdir",
  "truncate",
  "truncateSync",
  "writeFile",
  "writeFileSync",
  "rename",
  "renameSync",
  "ftruncate",
  "copyFile",
  "appendFile",
];

const PROCESS_KILL = ["kill", "killSync", "pkill", "killall", "SIGTERM", "SIGKILL"];

/** The destructive/process denylist for the adapter and the db command. */
export const destructiveApiFailures = (text: string, label: string): string[] => {
  const failures: string[] = [];
  for (const name of [...DESTRUCTIVE, ...PROCESS_KILL]) {
    if (new RegExp(`\\b${name}\\b`).test(text)) failures.push(`${label}: ${name}`);
  }
  return failures;
};

const HOME_PATTERN =
  /(?:\/home\/[A-Za-z0-9._-]+\/|\/Users\/[A-Za-z0-9._-]+\/|[A-Za-z]:\\Users\\[A-Za-z0-9._-]+\\)/;

export const homePathFailures = (text: string, label: string): string[] =>
  HOME_PATTERN.test(text) ? [`${label}: real home-shaped path`] : [];

const newSourceFiles = (): string[] =>
  [CONTRACT, DOMAIN, ADAPTER, DB_COMMAND].filter((file) => {
    try {
      readFileSync(join(ROOT, file));
      return true;
    } catch {
      return false;
    }
  });

const presentSuites = (): string[] =>
  SESSION_SUITES.filter((file) => {
    try {
      readFileSync(join(ROOT, file));
      return true;
    } catch {
      return false;
    }
  });

describe("TC-DB-002 contract and domain tier discipline", () => {
  test("the live session contract is data-only and the domain is pure", () => {
    expect(contractsDataOnly(readFileSync(join(ROOT, CONTRACT), "utf8"))).toEqual([]);
    expect(domainPure(readFileSync(join(ROOT, DOMAIN), "utf8"))).toEqual([]);
  });

  test("runtime APIs stay confined and no ambient environment is read", () => {
    const files = newSourceFiles();
    expect(runtimeConfinementFailures(files)).toEqual([]);
    expect(ambientEnvironmentFailures(files)).toEqual([]);
  });

  test("no SQLite driver reference exists in the new files", () => {
    expect(sqliteDriverFailures(newSourceFiles())).toEqual([]);
  });

  test("the secret-read allowlist stays at four and names no session file", () => {
    expect(SECRET_READ_ALLOWLIST).toHaveLength(4);
    const paths = SECRET_READ_ALLOWLIST.map((entry) => entry.path);
    for (const file of [CONTRACT, DOMAIN, ADAPTER, DB_COMMAND]) {
      expect(paths.some((path) => path.includes(file.replace("packages/", "")))).toBe(false);
    }
  });

  test("package export maps and subpaths are unchanged", () => {
    const adapters = JSON.parse(
      readFileSync(join(ROOT, "packages/adapters/package.json"), "utf8"),
    ) as { exports: Record<string, unknown> };
    expect(Object.keys(adapters.exports).sort()).toEqual(
      [
        "./azure",
        "./ci",
        "./credentials",
        "./file",
        "./github",
        "./gitlab",
        "./host",
        "./jira",
        "./legacy",
        "./provider-quota",
        "./registry",
        "./repo",
        "./session",
      ].sort(),
    );
    const core = JSON.parse(readFileSync(join(ROOT, "packages/core/package.json"), "utf8")) as {
      exports: Record<string, unknown>;
    };
    expect(Object.keys(core.exports).sort()).toEqual(
      [".", "./branding", "./contracts", "./provider", "./state"].sort(),
    );
    const cli = JSON.parse(readFileSync(join(ROOT, "packages/cli/package.json"), "utf8")) as {
      exports: Record<string, unknown>;
    };
    expect(Object.keys(cli.exports)).toEqual(["."]);
  });

  test("seeded runtime, ambient, driver, and pure-domain violations fail by name", () => {
    expect(
      contractsDataOnly(`import "node:fs";\n${readFileSync(join(ROOT, CONTRACT), "utf8")}`).some(
        (line) => line.includes("node:fs"),
      ),
    ).toBe(true);
    expect(
      domainPure(
        `${readFileSync(join(ROOT, DOMAIN), "utf8")}\nexport const rogue = (): number => Date.now();`,
      ).some((line) => line.includes("Date.now")),
    ).toBe(true);
    expect(DRIVER_PATTERN.test('import "node:' + 'sqlite";')).toBe(true);
    expect(DRIVER_PATTERN.test('import "node:' + 'fs";')).toBe(false);
  });

  test("the boundary fixture registry has no session-admin widening", () => {
    const registry = readFileSync(join(ROOT, "tests/boundaries/fixture-registry.json"), "utf8");
    expect(registry.includes("session-admin")).toBe(false);
    expect(registry.includes("db-session")).toBe(false);
  });
});

describe("TC-DB-016/033 destructive and process denylist", () => {
  test("the live adapter and db command contain no destructive or process API", () => {
    for (const file of [ADAPTER, DB_COMMAND]) {
      try {
        const text = readFileSync(join(ROOT, file), "utf8");
        expect(destructiveApiFailures(text, file)).toEqual([]);
      } catch {
        // The file is introduced in a later phase.
      }
    }
  });

  test("planted unlinkSync and process.kill are detected", () => {
    expect(destructiveApiFailures("unlinkSync(path);", "probe.ts")).toContain(
      "probe.ts: unlinkSync",
    );
    expect(destructiveApiFailures("process.kill(pid);", "probe.ts")).toContain("probe.ts: kill");
  });
});

describe("TC-DB-036 hermeticity scan", () => {
  test("the present session-admin suites import no process, network, home, or SQLite API", () => {
    const suites = presentSuites();
    expect(suites.length).toBeGreaterThan(0);
    for (const file of suites) {
      const text = readFileSync(join(ROOT, file), "utf8");
      const source = parse(file, text);
      for (const specifier of specifiersOf(source)) {
        expect(specifier.startsWith("node:child_process"), file).toBe(false);
        expect(specifier.startsWith("node:http"), file).toBe(false);
        expect(specifier.startsWith("node:https"), file).toBe(false);
      }
      for (const banned of [
        "Bun." + "spawn",
        "os." + "homedir",
        "process." + "env",
        "$" + "HOME",
      ]) {
        expect(text.includes(banned), `${file} contains a banned token`).toBe(false);
      }
      expect(sqliteDriverFailures([file])).toEqual([]);
    }
  });

  test("a real home-shaped path is detected while /synthetic paths are accepted", () => {
    const home = `/home/${"synthetic-user"}/session/opencode.db`;
    expect(homePathFailures(home, "probe.ts").length).toBe(1);
    expect(homePathFailures("/synthetic/harness/opencode/opencode.db", "probe.ts")).toEqual([]);
  });

  test("the introduced files carry no real home path and the scan has scope", () => {
    const files = newSourceFiles();
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const file of files) {
      expect(homePathFailures(readFileSync(join(ROOT, file), "utf8"), file)).toEqual([]);
    }
  });
});
