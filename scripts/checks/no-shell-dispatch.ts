/**
 * The static no-shell invariant (GH-347 AC-F9-4/AC-F9-5, API-7, NFR-5; §7.2(b)).
 *
 * It scans a DECLARED dispatch-flow surface with precise rules:
 *   R1  a script-path string literal: a whole literal value ending `.sh`, a
 *       path whose first segment is `scripts/` or `tools/`, or one containing
 *       `deliver-ticket`. Anchored on the literal's VALUE, never a substring.
 *   R2  a declared `shell: true`.
 *   R3  a shell-capable child-process import or call, bound to the
 *       `child_process` receiver: only `spawn` may be imported, a call on a
 *       `child_process` namespace binding must be `spawn(`, and every static or
 *       dynamic route to the module is covered — a named import, a default
 *       import, a namespace import, `require(...)`, a destructured `require`,
 *       `await import(...)`, and an alias (`const s = spawn`).
 *   R4  the one permitted child-process `spawn(` call must carry a literal
 *       `shell: false`, including when it is reached through an alias.
 *
 * A `RegExp.prototype.exec` call and a port object's `.spawn(` call are NOT
 * child-process calls and are asserted false-positive controls. R1 also covers
 * a SUBSTITUTED template path (`` `scripts/${name}.sh` ``), because a path
 * assembled from parts is still a script-path route.
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
  "packages/core/src/app/dispatch-lane-view.ts",
  "packages/core/src/app/dispatch-log-sink.ts",
  "packages/core/src/app/dispatch-log-tail.ts",
  "packages/core/src/app/dispatch-last-message.ts",
  // GH-413: the dispatch-owned window watch joins the declared surface.
  "packages/core/src/app/dispatch-peak-pause.ts",
  "packages/core/src/app/dispatch-stop.ts",
  "packages/core/src/domain/dispatch-message.ts",
  "packages/core/src/domain/dispatch-operator-view.ts",
  "packages/core/src/domain/dispatch-log.ts",
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
  "packages/cli/src/output/dispatch-text.ts",
  "packages/adapters/src/harness/opencode.ts",
  "packages/adapters/src/host/index.ts",
  "packages/adapters/src/file/dispatch-logs.ts",
  "packages/adapters/src/harness/opencode-transcript.ts",
  "packages/adapters/src/daemon/lane-executor.ts",
  // GH-348: the loop supervision profile joins the declared surface, so a loop
  // module can never be silently unscanned and no second invariant is authored.
  "packages/core/src/app/loop-supervisor.ts",
  "packages/core/src/app/loop-session.ts",
  "packages/core/src/app/loop-corroborator.ts",
  "packages/core/src/domain/loop-verdict.ts",
  "packages/core/src/domain/loop-backoff.ts",
  "packages/core/src/domain/loop-log.ts",
  "packages/core/src/domain/loop-status.ts",
  "packages/core/src/domain/loop-prompt.ts",
  "packages/core/src/state/loop.ts",
  "packages/cli/src/commands/loop.ts",
  // GH-386: the push seam joins the declared surface, so the typed stack's
  // first remote-write act is under the same static no-shell regime as every
  // other dispatch-flow spawn surface (NFR-3).
  "packages/adapters/src/git/push.ts",
] as const;

/**
 * The declared line allowlist: `file:line` entries a justification could excuse.
 *
 * It is CONSULTED by `scan`, and it is declared EMPTY. A future entry needs a
 * written justification here, and the suite asserts both that the live list is
 * empty and that a supplied entry is actually honoured — so "the allowlist is
 * empty" is a measurement of the mechanism, never a tautology.
 */
export const NO_SHELL_ALLOWLIST: readonly string[] = [];

/** The identity of one violation, as an allowlist entry spells it. */
export const allowlistKey = (violation: NoShellViolation): string =>
  `${violation.file}:${violation.line}`;

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

const isScriptPathValue = (value: string): boolean =>
  value.endsWith(".sh") ||
  value.startsWith("scripts/") ||
  value.startsWith("tools/") ||
  value.includes("deliver-ticket");

/**
 * A substituted template path: its STATIC parts still spell a script route
 * (`` `${root}/scripts/deliver-ticket.sh` ``), so a path assembled from parts is
 * not a way around the invariant.
 */
const isScriptPathTemplate = (node: ts.TemplateExpression): boolean =>
  [node.head, ...node.templateSpans.map((span) => span.literal)].some((part) =>
    isScriptPathValue(part.text),
  );

const lineOf = (source: ts.SourceFile, node: ts.Node): number =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

/** Scan one source file's text for the four rules. */
export const scanSource = (file: string, text: string): NoShellViolation[] => {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const violations: NoShellViolation[] = [];
  const childProcessModuleBindings = new Set<string>();
  const childProcessSpawnBindings = new Set<string>();
  const isChildProcessModule = (node: ts.Expression | undefined): boolean =>
    node !== undefined &&
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
    CHILD_PROCESS_MODULES.has(node.text);
  const push = (rule: NoShellRule, node: ts.Node): void => {
    violations.push({ rule, file, line: lineOf(source, node) });
  };

  const visit = (node: ts.Node): void => {
    // R1 — script-path literals (value-anchored), including a substituted
    // template whose STATIC parts spell the route.
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (isScriptPathValue(node.text)) push("script-path literal", node);
    }
    if (ts.isTemplateExpression(node) && isScriptPathTemplate(node)) {
      push("script-path literal", node);
    }
    // R2 — a declared shell: true.
    if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText(source);
      if (name === "shell" && node.initializer.getText(source) === "true") {
        push("shell-enabled spawn", node);
      }
    }
    // R3 — child-process imports, static and dynamic.
    if (ts.isImportDeclaration(node)) {
      const moduleName = ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : "";
      if (CHILD_PROCESS_MODULES.has(moduleName)) {
        const clause = node.importClause;
        const named = clause?.namedBindings;
        if (named !== undefined && ts.isNamedImports(named)) {
          for (const element of named.elements) {
            const imported = element.propertyName?.text ?? element.name.text;
            if (FORBIDDEN_MEMBERS.has(imported)) push("shell-exec import", element);
            if (imported === "spawn") childProcessSpawnBindings.add(element.name.text);
          }
        }
        if (named !== undefined && ts.isNamespaceImport(named)) {
          childProcessModuleBindings.add(named.name.text);
        }
        // A DEFAULT import of the module is the module object.
        if (clause?.name !== undefined && named === undefined) {
          childProcessModuleBindings.add(clause.name.text);
        }
      }
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      isChildProcessModule(node.arguments[0])
    ) {
      // A dynamic import cannot be verified statically.
      push("shell-exec import", node);
    }
    // A `require("child_process")` route: a destructured binding is followed as
    // a spawn/namespace binding, a bare require is refused outright.
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      isChildProcessModule(node.arguments[0])
    ) {
      const declaration = node.parent;
      if (ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name)) {
        childProcessModuleBindings.add(declaration.name.text);
      } else if (
        ts.isVariableDeclaration(declaration) &&
        ts.isObjectBindingPattern(declaration.name)
      ) {
        for (const element of declaration.name.elements) {
          const imported = element.propertyName?.getText(source) ?? element.name.getText(source);
          if (FORBIDDEN_MEMBERS.has(imported)) push("shell-exec import", element);
          if (imported === "spawn" && ts.isIdentifier(element.name)) {
            childProcessSpawnBindings.add(element.name.text);
          }
        }
      } else {
        push("shell-exec import", node);
      }
    }
    // R3 — an ALIAS of a child-process binding (`const s = spawn`,
    // `const cp = childProcess`, `const s = childProcess.spawn`).
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const initializer = node.initializer;
      if (initializer !== undefined && ts.isIdentifier(initializer)) {
        if (childProcessSpawnBindings.has(initializer.text)) {
          childProcessSpawnBindings.add(node.name.text);
        }
        if (childProcessModuleBindings.has(initializer.text)) {
          childProcessModuleBindings.add(node.name.text);
        }
      }
      if (
        initializer !== undefined &&
        ts.isPropertyAccessExpression(initializer) &&
        ts.isIdentifier(initializer.expression) &&
        childProcessModuleBindings.has(initializer.expression.text) &&
        initializer.name.text === "spawn"
      ) {
        childProcessSpawnBindings.add(node.name.text);
      }
    }
    // R3/R4 — child-process calls.
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const object = node.expression.expression;
      const member = node.expression.name.text;
      if (ts.isIdentifier(object) && childProcessModuleBindings.has(object.text)) {
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

/**
 * Scan the declared surface under `root` (existence is asserted separately).
 *
 * The allowlist is consulted here: a hit whose `file:line` is declared is
 * suppressed. The live list is empty, and the suite proves the mechanism by
 * supplying one entry, so an empty allowlist can never be a vacuous claim.
 */
export const scan = (
  root: string,
  surface: readonly string[] = DISPATCH_FLOW_SURFACE,
  allowlist: readonly string[] = NO_SHELL_ALLOWLIST,
): NoShellViolation[] => {
  const violations: NoShellViolation[] = [];
  for (const relative of surface) {
    if (!existsSync(join(root, relative))) continue;
    const text = readFileSync(join(root, relative), "utf8");
    for (const violation of scanSource(relative, text)) {
      if (allowlist.includes(allowlistKey(violation))) continue;
      violations.push(violation);
    }
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
