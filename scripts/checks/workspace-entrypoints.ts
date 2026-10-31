/**
 * TC-SCAFFOLD-007 — declared workspace entrypoints: allowed edges resolve, every
 * declaration is enforced, and no package imports an undeclared subpath.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ADAPTER_SUBPATHS = [
  "./gitlab",
  "./jira",
  "./github",
  "./azure",
  "./ci",
  "./registry",
  "./repo",
  "./file",
  "./host",
  "./session",
  "./legacy",
  "./credentials",
  "./provider-quota",
];

export const EXPECTED_ENTRYPOINTS: Record<string, Record<string, string[]>> = {
  core: {},
  adapters: { "@delivery-os/core": ["./contracts"] },
  cli: {
    "@delivery-os/core": [".", "./contracts", "./state", "./branding", "./provider"],
    "@delivery-os/adapters": ADAPTER_SUBPATHS,
  },
  mcp: {
    "@delivery-os/core": [".", "./contracts", "./state", "./branding"],
    "@delivery-os/adapters": ADAPTER_SUBPATHS,
  },
  opencode: {
    "@delivery-os/core": [".", "./contracts", "./state", "./branding"],
    "@delivery-os/adapters": ADAPTER_SUBPATHS,
  },
  testkit: {
    "@delivery-os/core": [".", "./contracts"],
    "@delivery-os/adapters": ADAPTER_SUBPATHS,
  },
};

type Manifest = {
  name: string;
  exports?: Record<string, unknown>;
  workspaceImports?: Record<string, string[]>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

const readManifest = (root: string, packageName: string): Manifest =>
  JSON.parse(readFileSync(join(root, "packages", packageName, "package.json"), "utf8")) as Manifest;

const listTypeScriptFiles = (root: string, relativeDir: string): string[] => {
  const directory = join(root, relativeDir);
  if (!existsSync(directory)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) results.push(...listTypeScriptFiles(root, relativePath));
    else if (entry.name.endsWith(".ts")) results.push(relativePath);
  }
  return results;
};

const moduleSpecifiers = (file: string): string[] => {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
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
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
};

const normalizeSubpath = (remainder: string): string => {
  if (remainder.length === 0) return ".";
  return `./${remainder}`;
};

export const validate = (root: string): string[] => {
  const failures: string[] = [];
  const manifests = new Map<string, Manifest>();
  for (const packageName of Object.keys(EXPECTED_ENTRYPOINTS)) {
    const manifest = readManifest(root, packageName);
    manifests.set(packageName, manifest);

    const declared = manifest.workspaceImports ?? {};
    const expected = EXPECTED_ENTRYPOINTS[packageName] ?? {};
    const declaredKeys = Object.keys(declared).sort();
    const expectedKeys = Object.keys(expected).sort();
    if (JSON.stringify(declaredKeys) !== JSON.stringify(expectedKeys)) {
      failures.push(
        `packages/${packageName}: workspaceImports keys ${JSON.stringify(declaredKeys)} != ${JSON.stringify(expectedKeys)}`,
      );
    }
    for (const dependency of expectedKeys) {
      const actual = [...(declared[dependency] ?? [])].sort();
      const wanted = [...(expected[dependency] ?? [])].sort();
      if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
        failures.push(
          `packages/${packageName}: workspaceImports[${dependency}] must be ${JSON.stringify(wanted)}; got ${JSON.stringify(actual)}`,
        );
      }
      for (const subpath of wanted) {
        const targetName = dependency.replace("@delivery-os/", "");
        const target = manifests.get(targetName) ?? readManifest(root, targetName);
        manifests.set(targetName, target);
        if (!(subpath in (target.exports ?? {}))) {
          failures.push(
            `packages/${packageName}: declared edge ${dependency}${subpath === "." ? "" : subpath.slice(1)} does not resolve (missing export)`,
          );
        }
      }
    }

    for (const field of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ] as const) {
      for (const [dependency, version] of Object.entries(manifest[field] ?? {})) {
        if (!version.startsWith("workspace:")) continue;
        if (!(dependency in declared)) {
          failures.push(
            `packages/${packageName}: manifest ${field} declares ${dependency} but workspaceImports does not`,
          );
        }
      }
    }
  }

  for (const [packageName, manifest] of manifests) {
    const declared = manifest.workspaceImports ?? {};
    for (const relativeDir of ["src", "test"]) {
      for (const relative of listTypeScriptFiles(root, `packages/${packageName}/${relativeDir}`)) {
        for (const specifier of moduleSpecifiers(join(root, relative))) {
          if (!specifier.startsWith("@delivery-os/")) continue;
          const remainder = specifier.slice("@delivery-os/".length);
          const slash = remainder.indexOf("/");
          const targetName = slash === -1 ? remainder : remainder.slice(0, slash);
          const subpath = normalizeSubpath(slash === -1 ? "" : remainder.slice(slash + 1));
          const allowed = declared[`@delivery-os/${targetName}`] ?? [];
          if (!allowed.includes(subpath)) {
            failures.push(
              `${relative}: import ${specifier} is not declared in packages/${packageName}/workspaceImports`,
            );
          }
        }
      }
    }
  }

  return failures;
};

if (import.meta.main) {
  const failures = validate(process.cwd());
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL workspace-entrypoints: ${message}`);
    process.exit(1);
  }
  console.log(
    "OK workspace-entrypoints: declarations match the DEC-2 matrices and all edges resolve",
  );
}
