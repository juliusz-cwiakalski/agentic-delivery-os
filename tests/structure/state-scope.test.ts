/**
 * TC-STATE-023 — the state tier has no configuration/branding import, and its
 * consumers are confined to the documented GH-179 surface (the CLI edge and the
 * phase command). Seeded violations prove the scan is live.
 */
import { describe, expect, test } from "bun:test";
import {
  appendFileSync,
  existsSync,
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

/**
 * The documented GH-179 consumers (C-5, D3): the CLI edge composes the store and
 * the phase command folds verified transitions. Every other package/file stays
 * outside the state surface.
 */
export const STATE_CONSUMERS = [
  "packages/cli/src/commands/phase.ts",
  "packages/cli/src/edge.ts",
] as const;

export const stateConsumerFiles = (root: string): string[] => {
  const found: string[] = [];
  const packages = ["adapters", "cli", "mcp", "opencode", "testkit"];
  for (const packageName of packages) {
    if (!existsSync(join(root, `packages/${packageName}/src`))) continue;
    const walk = (current: string): void => {
      for (const entry of readdirSync(join(root, current), { withFileTypes: true })) {
        const next = `${current}/${entry.name}`;
        if (entry.isDirectory()) walk(next);
        else if (entry.name.endsWith(".ts")) {
          if (readFileSync(join(root, next), "utf8").includes("@delivery-os/core/state")) {
            found.push(next);
          }
        }
      }
    };
    walk(`packages/${packageName}/src`);
  }
  return found.sort();
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

  test("state consumers are exactly the documented GH-179 surface", () => {
    expect(stateConsumerFiles(ROOT)).toEqual([...STATE_CONSUMERS].sort());
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

    const consumerRoot = cloneCommandRegistry();
    try {
      mkdirSync(join(consumerRoot, "packages/mcp/src"), { recursive: true });
      writeFileSync(
        join(consumerRoot, "packages/mcp/src/probe.ts"),
        'export * from "@delivery-os/core/state";\n',
      );
      expect(stateConsumerFiles(consumerRoot)).toContain("packages/mcp/src/probe.ts");
      expect([...STATE_CONSUMERS]).not.toContain("packages/mcp/src/probe.ts");
    } finally {
      removeRoot(consumerRoot);
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
