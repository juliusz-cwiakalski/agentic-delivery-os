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

const removeWorkItemDeclaration = (text: string): string => {
  const start = text.indexOf("export type WorkItem = {");
  if (start === -1) return text;
  const end = text.indexOf("\n};", start);
  if (end === -1) return text;
  return `${text.slice(0, start)}${text.slice(end + 3)}`;
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
      writeFileSync(path, removeWorkItemDeclaration(readFileSync(path, "utf8")));
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

/**
 * TC-CONTRACT-001 — the `WorkItem` field-shape probe (GH-188 OQ-F).
 *
 * The export-name inventory above cannot see field changes, so the ADR-0004 and
 * ADR-0006 extensions are pinned here: exact field set, optionality, readonly
 * modifiers, and the declared type text.
 */
type FieldShape = {
  readonly name: string;
  readonly optional: boolean;
  readonly readonly: boolean;
  readonly typeText: string;
};

type FieldShapeFixture = {
  readonly typeName: string;
  readonly fields: readonly FieldShape[];
};

const FIELD_SHAPE_PATH = "tests/fixtures/ports/workitem-field-shape.json";

export const fieldShapeFixture = JSON.parse(
  readFileSync(join(ROOT, FIELD_SHAPE_PATH), "utf8"),
) as FieldShapeFixture;

const normalizeTypeText = (text: string): string => text.replace(/\s+/g, " ").trim();

/** Read one type alias's property shape from `ports.ts` under a root. */
export const collectFieldShape = (root: string, typeName: string): FieldShape[] | undefined => {
  const file = join(root, CONTRACTS_DIR, "ports.ts");
  const source = ts.createSourceFile(
    "ports.ts",
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of source.statements) {
    if (!ts.isTypeAliasDeclaration(statement) || statement.name.text !== typeName) continue;
    if (!ts.isTypeLiteralNode(statement.type)) return [];
    return statement.type.members.filter(ts.isPropertySignature).map((member) => ({
      name: ts.isIdentifier(member.name) ? member.name.text : member.name.getText(source),
      optional: member.questionToken !== undefined,
      readonly: (member.modifiers ?? []).some(
        (modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword,
      ),
      typeText: normalizeTypeText(member.type?.getText(source) ?? ""),
    }));
  }
  return undefined;
};

/** Compare the live field shape to the fixture; every divergence names the field. */
export const fieldShapeFailures = (root: string, fixture: FieldShapeFixture): string[] => {
  const actual = collectFieldShape(root, fixture.typeName);
  if (actual === undefined) return [`${fixture.typeName}: type is missing`];
  const failures: string[] = [];
  const expectedNames = fixture.fields.map((field) => field.name);
  const actualNames = actual.map((field) => field.name);
  for (const name of expectedNames.filter((entry) => !actualNames.includes(entry))) {
    failures.push(`${fixture.typeName}.${name}: missing field`);
  }
  for (const name of actualNames.filter((entry) => !expectedNames.includes(entry))) {
    failures.push(`${fixture.typeName}.${name}: unexpected field`);
  }
  for (const expectedField of fixture.fields) {
    const found = actual.find((field) => field.name === expectedField.name);
    if (found === undefined) continue;
    if (found.optional !== expectedField.optional) {
      failures.push(
        `${fixture.typeName}.${expectedField.name}: optional ${found.optional} != ${expectedField.optional}`,
      );
    }
    if (found.readonly !== expectedField.readonly) {
      failures.push(
        `${fixture.typeName}.${expectedField.name}: readonly ${found.readonly} != ${expectedField.readonly}`,
      );
    }
    if (found.typeText !== expectedField.typeText) {
      failures.push(
        `${fixture.typeName}.${expectedField.name}: type ${found.typeText} != ${expectedField.typeText}`,
      );
    }
  }
  return failures;
};

describe("TC-CONTRACT-001 WorkItem field-shape probe", () => {
  test("the live WorkItem shape equals the committed fixture exactly", () => {
    expect(fieldShapeFailures(ROOT, fieldShapeFixture)).toEqual([]);
    expect(fieldShapeFixture.typeName).toBe("WorkItem");
    // The additive extensions are pinned by name, not just by field count.
    expect(fieldShapeFixture.fields.map((field) => field.name)).toEqual([
      "identity",
      "title",
      "status",
      "labels",
      "assignee",
      "relations",
      "comments",
      "updatedAt",
    ]);
    expect(fieldShapeFixture.fields.find((field) => field.name === "comments")).toMatchObject({
      optional: true,
      readonly: true,
    });
    expect(fieldShapeFixture.fields.find((field) => field.name === "updatedAt")).toMatchObject({
      optional: true,
      readonly: true,
      typeText: "string",
    });
  });

  test("removing WorkItem.updatedAt fails naming the field (ADR-0004 C-1)", () => {
    const root = makeContractsCopy((directory) => {
      const path = join(directory, CONTRACTS_DIR, "ports.ts");
      writeFileSync(
        path,
        readFileSync(path, "utf8").replace("  readonly updatedAt?: string;\n", ""),
      );
    });
    try {
      const failures = fieldShapeFailures(root, fieldShapeFixture);
      expect(failures.some((message) => message.includes("WorkItem.updatedAt"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("re-tightening comments to required fails naming the field (ADR-0006 C-1)", () => {
    const root = makeContractsCopy((directory) => {
      const path = join(directory, CONTRACTS_DIR, "ports.ts");
      writeFileSync(
        path,
        readFileSync(path, "utf8").replace(
          "readonly comments?: readonly WorkItemComment[];",
          "readonly comments: readonly WorkItemComment[];",
        ),
      );
    });
    try {
      const failures = fieldShapeFailures(root, fieldShapeFixture);
      expect(failures.some((message) => message.includes("WorkItem.comments"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
