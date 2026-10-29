/**
 * TC-SCAFFOLD-015 — ambient-global AST guard for the ADR-verbatim neutral set.
 *
 * Scope (ADR-0003 DEC-2 "Additional rules" bullet 6 + "Enforcement is mechanical"
 * bullet 6): the `core` `.` entry module, `core/src/contracts/**`, and the internal
 * tiers `core/src/{domain,app,config,branding}/**`. `bun:*` / `node:*` specifiers
 * are enforced over the same set by `runtime-apis-confinement` (dependency-cruiser).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

export const PUBLIC_ENTRY = "packages/core/src/index.ts";
export const NEUTRAL_TIER_DIRECTORIES = [
  "packages/core/src/contracts",
  "packages/core/src/domain",
  "packages/core/src/app",
  "packages/core/src/config",
  "packages/core/src/branding",
] as const;

export const AMBIENT_SCOPE = {
  files: [PUBLIC_ENTRY],
  directories: [...NEUTRAL_TIER_DIRECTORIES],
} as const;

export const BANNED_GLOBALS = ["process", "Bun", "Deno", "setTimeout", "setInterval", "fetch"];
export const BANNED_PROPERTY_ACCESS: Array<[string, string]> = [
  ["Date", "now"],
  ["Math", "random"],
];

export const NEUTRAL_TIERS_RULE = "ambient-globals-neutral-tiers";
export const BRANDING_ENV_RULE = "ambient-env-branding";

export type AmbientViolation = {
  rule: string;
  file: string;
  line: number;
  detail: string;
};

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

export const scopedFiles = (root: string): string[] => {
  const files = new Set<string>();
  for (const file of AMBIENT_SCOPE.files) {
    if (existsSync(join(root, file))) files.add(file);
  }
  for (const directory of AMBIENT_SCOPE.directories) {
    for (const file of listTypeScriptFiles(root, directory)) files.add(file);
  }
  return [...files].sort();
};

const isSkippedIdentifierPosition = (node: ts.Identifier): boolean => {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isPropertySignature(parent) && parent.name === node) return true;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return true;
  if (ts.isImportSpecifier(parent) || ts.isImportClause(parent)) return true;
  if (ts.isQualifiedName(parent) && parent.right === node) return true;
  if (ts.isTypeAliasDeclaration(parent) && parent.name === node) return true;
  return false;
};

const isEnvironmentRead = (node: ts.Identifier): boolean => {
  const parent = node.parent;
  return (
    !!parent &&
    ts.isPropertyAccessExpression(parent) &&
    parent.expression === node &&
    parent.name.text === "env"
  );
};

export const scan = (root: string): AmbientViolation[] => {
  const violations: AmbientViolation[] = [];
  for (const file of scopedFiles(root)) {
    const source = ts.createSourceFile(
      file,
      readFileSync(join(root, file), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const inBranding = file.startsWith("packages/core/src/branding/");
    const report = (rule: string, node: ts.Node, detail: string): void => {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      violations.push({ rule, file, line: line + 1, detail });
    };

    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && !isSkippedIdentifierPosition(node)) {
        if (BANNED_GLOBALS.includes(node.text)) {
          const environment = isEnvironmentRead(node);
          const rule =
            inBranding && environment && (node.text === "process" || node.text === "Bun")
              ? BRANDING_ENV_RULE
              : NEUTRAL_TIERS_RULE;
          report(
            rule,
            node,
            environment
              ? `ambient environment read ${node.text}.env`
              : `ambient global ${node.text}`,
          );
        }
        for (const [objectName, propertyName] of BANNED_PROPERTY_ACCESS) {
          const parent = node.parent;
          if (
            node.text === objectName &&
            parent &&
            ts.isPropertyAccessExpression(parent) &&
            parent.expression === node &&
            parent.name.text === propertyName
          ) {
            report(
              NEUTRAL_TIERS_RULE,
              node,
              `ambient clock/randomness ${objectName}.${propertyName}`,
            );
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return violations;
};

if (import.meta.main) {
  const violations = scan(process.cwd());
  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(
        `FAIL ${violation.rule}: ${violation.file}:${violation.line} ${violation.detail}`,
      );
    }
    process.exit(1);
  }
  console.log(
    `OK ambient-globals: ${scopedFiles(process.cwd()).length} neutral-set files clean (${AMBIENT_SCOPE.files.length} entry + ${AMBIENT_SCOPE.directories.length} tier scopes)`,
  );
}
