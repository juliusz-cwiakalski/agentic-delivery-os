/**
 * TC-STATE-023 — the foundation story ships no CLI command, no configuration
 * import, and no caller beyond tests; the public port is exercisable entirely
 * through a synthetic consumer, and seeded violations prove the scan is live.
 */
import { describe, expect, test } from "bun:test";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

import { exercise, repairTerminalTail } from "../fixtures/state/consumer";
import {
  ledgerPath,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  withinFence,
} from "../fixtures/state/harness";

const ROOT = process.cwd();
const STATE_ROOT = "packages/core/src/state";

const importSpecifiers = (source: string): string[] => {
  const file = ts.createSourceFile(
    "probe.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
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
      if (argument !== undefined && ts.isStringLiteral(argument)) {
        specifiers.push(argument.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return specifiers;
};

const listStateFiles = (root: string): string[] => {
  const results: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(join(root, current), { withFileTypes: true })) {
      const next = `${current}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith(".ts")) results.push(next);
    }
  };
  walk(STATE_ROOT);
  return results.sort();
};

export const stateConfigViolations = (root: string): string[] => {
  const failures: string[] = [];
  for (const file of listStateFiles(root)) {
    for (const specifier of importSpecifiers(readFileSync(join(root, file), "utf8"))) {
      if (
        specifier.startsWith("#branding") ||
        specifier.startsWith("#config") ||
        specifier.includes("/config/") ||
        specifier.startsWith("@delivery-os/core/config")
      ) {
        failures.push(`${file}: ${specifier}`);
      }
    }
  }
  return failures;
};

export const cliStateCommandViolations = (root: string): string[] => {
  const failures: string[] = [];
  const commands = readFileSync(join(root, "packages/cli/src/commands/index.ts"), "utf8");
  if (/["']state["']\s*:/.test(commands) || commands.includes("createStateCommandDefinition")) {
    failures.push("packages/cli/src/commands/index.ts: state command registered");
  }
  if (readdirSync(join(root, "packages/cli/src/commands")).includes("state.ts")) {
    failures.push("packages/cli/src/commands/state.ts: state command implemented");
  }
  return failures;
};

const cloneCommandRegistry = (): string => {
  const root = mkdtempSync(join(tmpdir(), "scope-seed-"));
  return root;
};

const seedStateTier = (): string => {
  const root = cloneCommandRegistry();
  mkdirSync(join(root, "packages/core/src/state"), { recursive: true });
  return root;
};

describe("TC-STATE-023 foundation scope", () => {
  test("no state CLI command is registered or implemented", () => {
    expect(cliStateCommandViolations(ROOT)).toEqual([]);
  });

  test("the state tier has no configuration or branding import", () => {
    expect(stateConfigViolations(ROOT)).toEqual([]);
  });

  test("no state consumer exists outside the state tier and tests", () => {
    const offenders: string[] = [];
    const packages = ["adapters", "cli", "mcp", "opencode", "testkit"];
    for (const packageName of packages) {
      const walk = (current: string): void => {
        for (const entry of readdirSync(join(ROOT, current), { withFileTypes: true })) {
          const next = `${current}/${entry.name}`;
          if (entry.isDirectory()) walk(next);
          else if (entry.name.endsWith(".ts")) {
            const text = readFileSync(join(ROOT, next), "utf8");
            if (text.includes("@delivery-os/core/state")) offenders.push(next);
          }
        }
      };
      walk(`packages/${packageName}/src`);
    }
    expect(offenders).toEqual([]);
  });

  test("a synthetic consumer exercises every public operation without config or branding", () => {
    const root = makeTempRoot("scope-consumer");
    try {
      const report = exercise(root);
      expect(report.steps).toEqual([
        "open",
        "fence-acquire",
        "append",
        "replace-document",
        "integrity",
        "fence-release",
        "read-with-key-set",
        "recover",
        "append-after-recovery",
      ]);
      expect(report.values).toEqual({ phase: { phase: "deliver" } });
      expect(report.recovered).toBe(true);
    } finally {
      removeRoot(root);
    }
  });

  test("the synthetic consumer repairs a terminal torn tail through the port", () => {
    const root = makeTempRoot("scope-repair");
    try {
      const identity = makeIdentity(root, { workspaceId: "repair" });
      const { store } = openStore(identity);
      withinFence(store, "writer", (handle) => {
        store.append(handle, {
          kind: "consumer-record",
          recordKey: "phase",
          payload: { phase: "deliver" },
        });
      });
      appendFileSync(ledgerPath(identity), '{"schemaVersion":"delivery.state.v1","kind":"partial"');
      const report = repairTerminalTail(root);
      expect(report.repaired).toBe(true);
      expect(report.values).toEqual({ phase: { phase: "deliver" } });
    } finally {
      removeRoot(root);
    }
  });

  test("seeded violations prove the scope scans are live", () => {
    const cliRoot = cloneCommandRegistry();
    try {
      mkdirSync(join(cliRoot, "packages/cli/src/commands"), { recursive: true });
      writeFileSync(
        join(cliRoot, "packages/cli/src/commands/index.ts"),
        'export const commands = { "state": { handler: () => null } };\n',
      );
      writeFileSync(join(cliRoot, "packages/cli/src/commands/state.ts"), "export const x = 1;\n");
      const violations = cliStateCommandViolations(cliRoot);
      expect(violations.length).toBe(2);
    } finally {
      removeRoot(cliRoot);
    }

    const stateRoot = seedStateTier();
    try {
      writeFileSync(
        join(stateRoot, `${STATE_ROOT}/index.ts`),
        [
          'import { resolveConfig } from "#config/resolver";',
          'export * from "#branding/index";',
          "export { resolveConfig };",
        ].join("\n"),
      );
      expect(stateConfigViolations(stateRoot)).toEqual([
        `${STATE_ROOT}/index.ts: #config/resolver`,
        `${STATE_ROOT}/index.ts: #branding/index`,
      ]);
    } finally {
      removeRoot(stateRoot);
    }
  });
});
