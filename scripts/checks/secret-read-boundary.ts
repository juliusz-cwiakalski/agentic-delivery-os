/**
 * TC-SECRET-001..004 — the binding secret-read boundary invariant (F-4, DEC-4).
 *
 * Scope: every workspace package production source (`packages/<pkg>/src/**`).
 * Rule: ambient environment access is permitted only in the enumerated
 * allowlist. The registry is exact-path and reason-bearing: a `file` entry
 * matches one file, a `directory` entry matches that directory and its
 * descendants. Wildcards, prefixes, absolute paths, and trailing separators are
 * rejected; growth is a reviewed change.
 *
 * The check is read-only and fail-closed: it names rule, file, and line, and it
 * reports the scoped-file count so an empty scope cannot pass silently.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

export const SECRET_READ_RULE = "secret-read-boundary";
export const SECRET_READ_SEVERITY = "error" as const;

export type AllowlistClass = "credential-material" | "configuration-environment-source";

export type AllowlistEntry = {
  readonly kind: "file" | "directory";
  readonly path: string;
  readonly class: AllowlistClass;
  readonly reason: string;
};

/** The enumerated v1 allowlist: one credential implementation and two readers. */
export const SECRET_READ_ALLOWLIST: readonly AllowlistEntry[] = [
  {
    kind: "directory",
    path: "packages/adapters/src/credentials",
    class: "credential-material",
    reason: "The single environment-backed credential-port implementation.",
  },
  {
    kind: "file",
    path: "packages/adapters/src/file/yaml-parser.ts",
    class: "configuration-environment-source",
    reason: "Pre-existing file-tier parser host-switch guard.",
  },
  {
    kind: "file",
    path: "packages/adapters/src/legacy/index.ts",
    class: "configuration-environment-source",
    reason: "Pre-existing legacy-name adapter environment reader.",
  },
];

const AMBIENT_GLOBALS = new Set(["process", "Bun", "Deno"]);

export type SecretReadViolation = {
  readonly rule: string;
  readonly file: string;
  readonly line: number;
  readonly detail: string;
};

const listTypeScriptFiles = (root: string, relativeDir: string): string[] => {
  const directory = join(root, relativeDir);
  if (!existsSync(directory)) return [];
  const results: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules") continue;
        walk(next);
      } else if (entry.name.endsWith(".ts")) {
        results.push(next);
      }
    }
  };
  walk(relativeDir);
  return results.sort();
};

/** Every workspace package production source in scope. */
export const scopedFiles = (root: string): string[] => {
  const packagesDir = join(root, "packages");
  if (!existsSync(packagesDir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "node_modules") continue;
    files.push(...listTypeScriptFiles(root, `packages/${entry.name}/src`));
  }
  return files.sort();
};

const isAllowed = (file: string, entries: readonly AllowlistEntry[]): boolean =>
  entries.some((entry) =>
    entry.kind === "file" ? file === entry.path : file.startsWith(`${entry.path}/`),
  );

const isSkippedIdentifierPosition = (node: ts.Identifier): boolean => {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isPropertySignature(parent) && parent.name === node) return true;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return true;
  if (ts.isImportSpecifier(parent) || ts.isImportClause(parent)) return true;
  if (ts.isTypeAliasDeclaration(parent) && parent.name === node) return true;
  return false;
};

/** Detect every ambient-environment read form, including property names. */
export const sourceViolations = (
  file: string,
  text: string,
): Array<{ readonly line: number; readonly detail: string }> => {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const violations: Array<{ line: number; detail: string }> = [];
  const lineOf = (node: ts.Node): number =>
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      const specifier = node.moduleSpecifier;
      if (
        ts.isStringLiteral(specifier) &&
        /^(node:)?process$|^bun$|^node:bun$/.test(specifier.text)
      ) {
        violations.push({ line: lineOf(node), detail: `runtime import ${specifier.text}` });
      }
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "env" &&
      ts.isIdentifier(node.expression) &&
      AMBIENT_GLOBALS.has(node.expression.text)
    ) {
      violations.push({
        line: lineOf(node),
        detail: `ambient environment read ${node.expression.text}.env`,
      });
    }
    if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)) {
      const name = node.argumentExpression.text;
      if (name === "env" || AMBIENT_GLOBALS.has(name)) {
        violations.push({ line: lineOf(node), detail: `ambient element access ["${name}"]` });
      }
    }
    if (ts.isIdentifier(node) && AMBIENT_GLOBALS.has(node.text)) {
      const parent = node.parent;
      const propertyRead = ts.isPropertyAccessExpression(parent) && parent.expression === node;
      const elementRead = ts.isElementAccessExpression(parent) && parent.expression === node;
      if (!propertyRead && !elementRead && !isSkippedIdentifierPosition(node)) {
        violations.push({ line: lineOf(node), detail: `ambient global ${node.text} aliased` });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
};

/** Scan a root, naming every ambient read outside the allowlist. */
export const scan = (
  root: string,
  entries: readonly AllowlistEntry[] = SECRET_READ_ALLOWLIST,
): SecretReadViolation[] => {
  const violations: SecretReadViolation[] = [];
  for (const file of scopedFiles(root)) {
    if (isAllowed(file, entries)) continue;
    for (const violation of sourceViolations(file, readFileSync(join(root, file), "utf8"))) {
      violations.push({ rule: SECRET_READ_RULE, file, ...violation });
    }
  }
  return violations;
};

/** Registry-shape validation: exact paths, reasons, classes, sole credential entry. */
export const validateAllowlist = (
  root: string,
  entries: readonly AllowlistEntry[] = SECRET_READ_ALLOWLIST,
): string[] => {
  const failures: string[] = [];
  if (entries.length === 0) failures.push("allowlist is empty");
  const paths = new Set<string>();
  for (const entry of entries) {
    const label = `${entry.kind}:${entry.path || "<empty path>"}`;
    if (entry.kind !== "file" && entry.kind !== "directory") {
      failures.push(`${label}: unknown entry kind`);
    }
    if (entry.path.length === 0) failures.push(`${label}: path is empty`);
    if (paths.has(entry.path)) failures.push(`${label}: duplicate path`);
    paths.add(entry.path);
    if (entry.path.startsWith("/") || entry.path.includes("..") || entry.path.includes("*")) {
      failures.push(`${label}: path must be an exact relative path (no wildcard or prefix)`);
    }
    if (entry.path.endsWith("/"))
      failures.push(`${label}: trailing separator is not an exact path`);
    if (entry.reason.trim().length === 0) failures.push(`${label}: entry requires a reason`);
    if (
      entry.class !== "credential-material" &&
      entry.class !== "configuration-environment-source"
    ) {
      failures.push(`${label}: unknown class ${entry.class}`);
    }
    if (entry.kind === "file" && !entry.path.endsWith(".ts")) {
      failures.push(`${label}: file entries must name a .ts file`);
    }
    if (entry.kind === "directory" && entry.path.endsWith(".ts")) {
      failures.push(`${label}: directory entries must name a directory`);
    }
    const target = join(root, entry.path);
    if (!existsSync(target)) {
      failures.push(`${label}: allowlisted path does not exist`);
    } else if (entry.kind === "file" && !statSync(target).isFile()) {
      failures.push(`${label}: file entry does not name a file`);
    } else if (entry.kind === "directory" && !statSync(target).isDirectory()) {
      failures.push(`${label}: directory entry does not name a directory`);
    }
  }
  const credentialEntries = entries.filter((entry) => entry.class === "credential-material");
  if (credentialEntries.length !== 1) {
    failures.push(
      `exactly one credential-material entry is required; found ${credentialEntries.length}`,
    );
  }
  if (credentialEntries[0]?.path !== "packages/adapters/src/credentials") {
    failures.push("the credential-material entry must be the credential implementation directory");
  }
  return failures;
};

/** Validate a root: registry shape, non-vacuity, and zero non-allowlisted reads. */
export const validate = (
  root: string,
  entries: readonly AllowlistEntry[] = SECRET_READ_ALLOWLIST,
): string[] => {
  const failures = validateAllowlist(root, entries);
  const files = scopedFiles(root);
  if (files.length === 0) failures.push("scan scope is empty (0 production files)");
  for (const violation of scan(root, entries)) {
    failures.push(
      `FAIL ${violation.rule}: ${violation.file}:${violation.line} ${violation.detail}`,
    );
  }
  return failures;
};

/** Fixture-coverage meta-check: a firing negative fixture and a clean control exist. */
export const validateFixtureCoverage = (
  cases: readonly { readonly id: string; readonly expect: "violation" | "clean" }[],
): string[] => {
  const failures: string[] = [];
  if (SECRET_READ_SEVERITY !== "error") {
    failures.push(`rule ${SECRET_READ_RULE} must be enforced at error severity`);
  }
  if (!cases.some((entry) => entry.expect === "violation")) {
    failures.push(`rule ${SECRET_READ_RULE} has no firing negative fixture`);
  }
  if (!cases.some((entry) => entry.expect === "clean")) {
    failures.push(`rule ${SECRET_READ_RULE} has no clean control`);
  }
  return failures;
};

if (import.meta.main) {
  const failures = validate(process.cwd());
  if (failures.length > 0) {
    for (const failure of failures) console.error(failure);
    process.exit(1);
  }
  console.log(
    `OK ${SECRET_READ_RULE}: ${scopedFiles(process.cwd()).length} production files clean ` +
      `(${SECRET_READ_ALLOWLIST.length} allowlisted entries, severity ${SECRET_READ_SEVERITY})`,
  );
}
