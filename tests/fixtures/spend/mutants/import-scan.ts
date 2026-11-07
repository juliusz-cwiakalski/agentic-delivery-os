/**
 * The spend-tier import and purity detector (GH-236 TC-SPEND-002).
 *
 * Shared by the permanent imports suite and the mutant meta-suite so a planted
 * violation and the real tree are judged by exactly one rule set.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

/** The spend modules this change introduces. */
export const SPEND_MODULES = [
  "packages/core/src/contracts/spend.ts",
  "packages/core/src/domain/spend.ts",
  "packages/core/src/domain/spend-text.ts",
] as const;

const AMBIENT_MEMBERS = [
  "Date.now",
  "Math.random",
  "process.env",
  "process.cwd",
  "process.exit",
  "fetch",
  "setTimeout",
  "setInterval",
] as const;

const specifiersOf = (source: string, name: string): { text: string; typeOnly: boolean }[] => {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const specifiers: { text: string; typeOnly: boolean }[] = [];
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;
    const clause = statement.importClause;
    const typeOnly = clause?.isTypeOnly === true;
    specifiers.push({ text: statement.moduleSpecifier.text, typeOnly });
  }
  return specifiers;
};

/**
 * Every import a spend module may declare.
 *
 * Contracts may import only sibling contracts modules; domain may import only
 * `#contracts` (its own pure tier vocabulary). A package import, a runtime
 * import, an adapter import, or a non-type import in contracts is a violation.
 */
export const forbiddenSpendImports = (source: string, relative: string): string[] => {
  const violations: string[] = [];
  const contractsModule = relative.startsWith("packages/core/src/contracts/");
  for (const { text, typeOnly } of specifiersOf(source, relative)) {
    if (text === "#contracts") continue;
    if (text.startsWith("./")) {
      if (contractsModule) continue;
      // The domain may only reach its own domain siblings by relative path.
      if (text.startsWith("./spend")) continue;
      violations.push(`${relative}: cross-module relative import ${text}`);
      continue;
    }
    violations.push(`${relative}: forbidden import ${text}`);
    if (contractsModule && !typeOnly) {
      violations.push(`${relative}: runtime import ${text} in a contracts module`);
    }
  }
  for (const ambient of AMBIENT_MEMBERS) {
    if (source.includes(ambient)) violations.push(`${relative}: ambient access ${ambient}`);
  }
  return violations;
};

/** The detector over the live tree (or a temp copy). */
export const spendImportViolations = (root: string): string[] => {
  const violations: string[] = [];
  for (const relative of SPEND_MODULES) {
    const text = readFileSync(join(root, relative), "utf8");
    violations.push(...forbiddenSpendImports(text, relative));
  }
  return violations;
};

/** The write/fence surface the read path must never reach (TC-SPEND-032). */
export const WRITE_MEMBERS = [
  ".acquireFence(",
  ".releaseFence(",
  ".append(",
  ".salvage(",
  ".replaceDocument(",
  ".ensureStoreArtifact(",
] as const;

export const writeMemberViolations = (source: string, relative: string): string[] =>
  WRITE_MEMBERS.filter((member) => source.includes(member)).map(
    (member) => `${relative}: write member ${member}`,
  );
