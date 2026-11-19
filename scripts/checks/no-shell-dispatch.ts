/**
 * The static no-shell invariant (GH-347 AC-F9-4/AC-F9-5, API-7, NFR-5; §7.2(b)).
 *
 * It scans a DECLARED dispatch-flow surface with precise rules:
 *   R1  a script-path string literal: a whole literal value ending `.sh`, a
 *       path whose first segment is `scripts/` or `tools/`, or one containing
 *       `deliver-ticket`. Anchored on the literal's VALUE, never a substring.
 *   R2  a declared `shell: true`.
 *   R3  a shell-capable child-process import or call, bound to the
 *       `child_process` receiver: only `spawn` may be imported, and a call on a
 *       `child_process` namespace binding must be `spawn(`.
 *   R4  the one permitted child-process `spawn(` call must carry a literal
 *       `shell: false`.
 *
 * A `RegExp.prototype.exec` call and a port object's `.spawn(` call are NOT
 * child-process calls and are asserted false-positive controls. The line
 * allowlist is declared EMPTY; a future entry needs a written justification in
 * this file.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

/** The declared dispatch-flow surface (every file must exist). */
export const DISPATCH_FLOW_SURFACE = [
  "packages/core/src/app/dispatch.ts",
  "packages/core/src/app/dispatch-attempts.ts",
  "packages/core/src/app/dispatch-gate.ts",
  "packages/core/src/app/dispatch-ledger.ts",
  "packages/core/src/app/dispatch-lane.ts",
  "packages/core/src/domain/dispatch-attempts.ts",
  "packages/core/src/domain/dispatch-authority.ts",
  "packages/core/src/domain/dispatch-comparison.ts",
  "packages/core/src/domain/dispatch-gate.ts",
  "packages/core/src/domain/dispatch-identity.ts",
  "packages/core/src/domain/dispatch-liveness.ts",
  "packages/core/src/domain/dispatch-prompt.ts",
  "packages/core/src/domain/dispatch-result.ts",
  "packages/core/src/domain/dispatch-resume.ts",
  "packages/core/src/domain/dispatch-tracker.ts",
  "packages/core/src/domain/harness-spawn-env.ts",
  "packages/cli/src/commands/dispatch.ts",
  "packages/cli/src/edge.ts",
  "packages/cli/src/production.ts",
  "packages/adapters/src/harness/opencode.ts",
  "packages/adapters/src/host/index.ts",
  "packages/adapters/src/daemon/lane-executor.ts",
] as const;

/** The declared line allowlist. Empty by construction; a hit is never silenced. */
export const NO_SHELL_ALLOWLIST: readonly string[] = [];

export const NO_SHELL_RULES = [
  "script-path literal",
  "shell-enabled spawn",
  "shell-exec import",
  "child-process spawn without shell:false",
] as const;

export type NoShellRule = (typeof NO_SHELL_RULES)[number];

export type NoShellViolation = {
  readonly rule: NoShellRule;
  readonly file: string;
  readonly line: number;
};

const CHILD_PROCESS_MODULES = new Set(["child_process", "node:child_process"]);
const FORBIDDEN_MEMBERS = new Set([
  "exec",
  "execSync",
  "execFile",
  "execFileSync",
  "spawnSync",
  "fork",
]);

const isScriptPathLiteral = (value: string): boolean =>
  value.endsWith(".sh") ||
  value.startsWith("scripts/") ||
  value.startsWith("tools/") ||
  value.includes("deliver-ticket");

const lineOf = (source: ts.SourceFile, node: ts.Node): number =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

/** Scan one source file's text for the four rules. */
export const scanSource = (file: string, text: string): NoShellViolation[] => {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const violations: NoShellViolation[] = [];
  const childProcessNamespaceBindings = new Set<string>();
  const childProcessSpawnBindings = new Set<string>();
  const push = (rule: NoShellRule, node: ts.Node): void => {
    violations.push({ rule, file, line: lineOf(source, node) });
  };

  const visit = (node: ts.Node): void => {
    // R1 — script-path literals (value-anchored).
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (isScriptPathLiteral(node.text)) push("script-path literal", node);
    }
    // R2 — a declared shell: true.
    if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText(source);
      if (name === "shell" && node.initializer.getText(source) === "true") {
        push("shell-enabled spawn", node);
      }
    }
    // R3 — child-process imports.
    if (ts.isImportDeclaration(node)) {
      const moduleName = ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : "";
      if (CHILD_PROCESS_MODULES.has(moduleName)) {
        const named = node.importClause?.namedBindings;
        if (named !== undefined && ts.isNamedImports(named)) {
          for (const element of named.elements) {
            const imported = element.propertyName?.text ?? element.name.text;
            if (FORBIDDEN_MEMBERS.has(imported)) push("shell-exec import", element);
            if (imported === "spawn") childProcessSpawnBindings.add(element.name.text);
          }
        }
        if (named !== undefined && ts.isNamespaceImport(named)) {
          childProcessNamespaceBindings.add(named.name.text);
        }
      }
    }
    // R3/R4 — child-process calls.
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const object = node.expression.expression;
      const member = node.expression.name.text;
      if (ts.isIdentifier(object) && childProcessNamespaceBindings.has(object.text)) {
        if (member !== "spawn") {
          push("shell-exec import", node);
        } else {
          checkSpawnShell(node);
        }
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      childProcessSpawnBindings.has(node.expression.text)
    ) {
      checkSpawnShell(node);
    }
    function checkSpawnShell(call: ts.CallExpression): void {
      const options = call.arguments[2];
      const literalFalse =
        options !== undefined &&
        ts.isObjectLiteralExpression(options) &&
        options.properties.some(
          (property) =>
            ts.isPropertyAssignment(property) &&
            property.name.getText(source) === "shell" &&
            property.initializer.getText(source) === "false",
        );
      if (!literalFalse) push("child-process spawn without shell:false", call);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
};

/** The declared surface files that are absent under `root` (non-vacuity). */
export const missingSurfaceFiles = (
  root: string,
  surface: readonly string[] = DISPATCH_FLOW_SURFACE,
): string[] => surface.filter((relative) => !existsSync(join(root, relative)));

/** Scan the declared surface under `root` (existence is asserted separately). */
export const scan = (
  root: string,
  surface: readonly string[] = DISPATCH_FLOW_SURFACE,
): NoShellViolation[] => {
  const violations: NoShellViolation[] = [];
  for (const relative of surface) {
    if (!existsSync(join(root, relative))) continue;
    const text = readFileSync(join(root, relative), "utf8");
    violations.push(...scanSource(relative, text));
  }
  return violations;
};

/** The CLI entry: exit 1 and name the rule/file/line on any violation. */
const main = (): number => {
  const root = process.cwd();
  const violations = scan(root);
  if (violations.length === 0) {
    console.log(`no-shell invariant: clean (${DISPATCH_FLOW_SURFACE.length} surface files)`);
    return 0;
  }
  for (const violation of violations) {
    console.error(`no-shell invariant: ${violation.rule} at ${violation.file}:${violation.line}`);
  }
  return 1;
};

if (import.meta.main) {
  process.exit(main());
}
