/**
 * TC-PORT-001 — the v1 contract surface inventory, fail-closed in both
 * directions against the committed fixture.
 *
 * The fixture is the exact expected export surface, independent of whatever the
 * contracts currently declare. Mutations run in `mkdtemp` copies only.
 */
import { describe, expect, test } from "bun:test";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const CONTRACTS_DIR = "packages/core/src/contracts";
const INVENTORY_PATH = "tests/fixtures/ports/v1-contract-inventory.json";

type Inventory = {
  readonly modules: Record<string, string[]>;
  readonly v1Primitives: string[];
  readonly credentialPort: string[];
  readonly envelope: string[];
};

export const expected = JSON.parse(readFileSync(join(ROOT, INVENTORY_PATH), "utf8")) as Inventory;

const hasExportModifier = (node: ts.Node): boolean =>
  ((node as { modifiers?: readonly ts.Modifier[] }).modifiers ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  );

const declaredNames = (statement: ts.Statement): string[] => {
  if (ts.isTypeAliasDeclaration(statement)) return [statement.name.text];
  if (ts.isInterfaceDeclaration(statement)) return [statement.name.text];
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.map((declaration) =>
      ts.isIdentifier(declaration.name) ? declaration.name.text : declaration.name.getText(),
    );
  }
  return [];
};

const reExportedNames = (statement: ts.Statement): string[] => {
  if (!ts.isExportDeclaration(statement) || statement.exportClause === undefined) return [];
  if (!ts.isNamedExports(statement.exportClause)) return [];
  return statement.exportClause.elements.map((element) => element.name.text);
};

/** Collect the exported surface of every contract module under a root. */
export const collectInventory = (root: string): Record<string, string[]> => {
  const directory = join(root, CONTRACTS_DIR);
  const modules: Record<string, string[]> = {};
  for (const entry of readdirSync(directory).sort()) {
    if (!entry.endsWith(".ts")) continue;
    const source = ts.createSourceFile(
      entry,
      readFileSync(join(directory, entry), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const names = new Set<string>();
    for (const statement of source.statements) {
      if (hasExportModifier(statement)) {
        for (const name of declaredNames(statement)) names.add(name);
      }
      for (const name of reExportedNames(statement)) names.add(name);
    }
    modules[entry] = [...names].sort();
  }
  return modules;
};

/** Compare an actual inventory against the fixture; every divergence is named. */
export const compareInventory = (
  actual: Record<string, string[]>,
  fixture: Inventory,
): string[] => {
  const failures: string[] = [];
  const actualModules = Object.keys(actual).sort();
  const expectedModules = Object.keys(fixture.modules).sort();
  for (const module of expectedModules.filter((entry) => !actualModules.includes(entry))) {
    failures.push(`${module}: missing contract module`);
  }
  for (const module of actualModules.filter((entry) => !expectedModules.includes(entry))) {
    failures.push(`${module}: unexpected contract module`);
  }
  for (const module of expectedModules) {
    const wanted = fixture.modules[module];
    const got = actual[module];
    if (wanted === undefined || got === undefined) continue;
    for (const name of wanted.filter((entry) => !got.includes(entry))) {
      failures.push(`${module}: missing export ${name}`);
    }
    for (const name of got.filter((entry) => !wanted.includes(entry))) {
      failures.push(`${module}: unexpected export ${name}`);
    }
  }
  return failures;
};

const makeContractsCopy = (mutate: (directory: string) => void): string => {
  const root = mkdtempSync(join(tmpdir(), "port-inventory-"));
  mkdirSync(join(root, "packages/core/src"), { recursive: true });
  cpSync(join(ROOT, CONTRACTS_DIR), join(root, CONTRACTS_DIR), { recursive: true });
  mutate(root);
  return root;
};

describe("TC-PORT-001 v1 contract surface inventory", () => {
  test("the live surface equals the fixture in both directions", () => {
    expect(compareInventory(collectInventory(ROOT), expected)).toEqual([]);
  });

  test("exactly the nine catalogue primitives are typed in ports.ts", () => {
    expect(expected.v1Primitives).toHaveLength(9);
    expect([...expected.v1Primitives].sort()).toEqual(
      [
        "AdapterContract",
        "DeliveryRequest",
        "ExternalSystemInstance",
        "IdempotencyKey",
        "PipelineRun",
        "RetryPolicy",
        "WorkItem",
        "WorkItemRelation",
        "WorkflowMap",
      ].sort(),
    );
    const ports = collectInventory(ROOT)["ports.ts"] ?? [];
    for (const primitive of expected.v1Primitives) {
      expect(ports, `${primitive} must be typed in ports.ts`).toContain(primitive);
    }
  });

  test("primitive names are catalogue PascalCase, never numeric", () => {
    for (const name of expected.v1Primitives) {
      expect(name).toMatch(/^[A-Z][A-Za-z0-9]*$/);
    }
  });

  test("the credential port and the envelope are declared exactly once", () => {
    const modules = collectInventory(ROOT);
    const declarationModules = Object.entries(modules).filter(([module]) => module !== "index.ts");
    for (const name of [...expected.credentialPort, ...expected.envelope]) {
      const owners = declarationModules
        .filter(([, names]) => names.includes(name))
        .map(([module]) => module);
      expect(owners, `${name} must have exactly one declaration module`).toHaveLength(1);
    }
  });

  test("removing a primitive fails naming the missing contract", () => {
    const root = makeContractsCopy((directory) => {
      const path = join(directory, CONTRACTS_DIR, "ports.ts");
      writeFileSync(
        path,
        readFileSync(path, "utf8").replace(
          /\/\*\* A normalized ticket \(DM-3\)\. \*\/\nexport type WorkItem = \{[\s\S]*?\n\};\n/,
          "",
        ),
      );
    });
    try {
      const failures = compareInventory(collectInventory(root), expected);
      expect(failures.some((message) => message.includes("WorkItem"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("adding an out-of-scope primitive fails naming the extra contract", () => {
    const root = makeContractsCopy((directory) => {
      const path = join(directory, CONTRACTS_DIR, "ports.ts");
      writeFileSync(
        path,
        `${readFileSync(path, "utf8")}\n/** A harness primitive that is out of v1 scope. */\nexport type Compensation = { readonly kind: "harness" };\n`,
      );
    });
    try {
      const failures = compareInventory(collectInventory(root), expected);
      expect(failures.some((message) => message.includes("Compensation"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("adding a whole new port module fails naming the extra module", () => {
    const root = makeContractsCopy((directory) => {
      writeFileSync(
        join(directory, CONTRACTS_DIR, "harness-port.ts"),
        "/** An out-of-scope harness port. */\nexport type HarnessPort = { readonly kind: string };\n",
      );
    });
    try {
      const failures = compareInventory(collectInventory(root), expected);
      expect(failures.some((message) => message.includes("harness-port.ts"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
