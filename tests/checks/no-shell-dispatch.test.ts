/**
 * TC-SHELL-002 — the static no-shell invariant is green on the live tree, its
 * surface list cannot rot, and each rule fails BY NAME on a planted reference
 * while the legitimate controls report nothing (GH-347 AC-F9-5, NFR-5).
 *
 * This suite IS the gate: the invariant is discovered by `bun test` (no
 * `package.json` script and no CI topology change), so the checks here are what
 * run. The declared surface is guarded three ways — existence, glob equality
 * (a new `dispatch-*.ts` cannot be silently unscanned), and reachability from
 * the declared dispatch entries.
 */
import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, normalize } from "node:path";
import ts from "typescript";
import {
  allowlistKey,
  DISPATCH_FLOW_SURFACE,
  missingSurfaceFiles,
  NO_SHELL_ALLOWLIST,
  scan,
  scanSource,
} from "../../scripts/checks/no-shell-dispatch";

const ROOT = process.cwd();

/** The declared non-glob members of the surface (the entry and adapter files). */
const FIXED_SURFACE = [
  "packages/core/src/app/dispatch.ts",
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
] as const;

/** The declared entries the reachability guard starts from. */
const SURFACE_ENTRIES = [
  "packages/cli/src/edge.ts",
  "packages/cli/src/production.ts",
  "packages/cli/src/commands/dispatch.ts",
  "packages/adapters/src/host/index.ts",
  "packages/adapters/src/daemon/lane-executor.ts",
] as const;

const manifest = (pkg: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(ROOT, "packages", pkg, "package.json"), "utf8")) as Record<
    string,
    unknown
  >;

const pickPath = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as { readonly types?: unknown; readonly default?: unknown };
  return typeof record.types === "string"
    ? record.types
    : typeof record.default === "string"
      ? record.default
      : undefined;
};

/** The import/export/dynamic-import specifiers of one file. */
const specifiersOf = (file: string): string[] => {
  const source = ts.createSourceFile(
    file,
    readFileSync(join(ROOT, file), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      out.push(node.moduleSpecifier.text);
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      out.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      out.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
};

/** Resolve one specifier to a repository-relative `.ts` file. */
const resolveSpecifier = (fromFile: string, specifier: string): string | undefined => {
  const pkg = fromFile.split("/")[1] ?? "";
  const find = (candidates: readonly string[]): string | undefined =>
    candidates.find((candidate) => existsSync(join(ROOT, candidate)));
  if (specifier.startsWith(".")) {
    const base = normalize(join(dirname(fromFile), specifier)).replace(/\.js$/, "");
    return find([`${base}.ts`, `${base}/index.ts`]);
  }
  if (specifier.startsWith("#")) {
    const imports = (manifest(pkg).imports ?? {}) as Readonly<Record<string, unknown>>;
    const key = Object.keys(imports).find(
      (entry) =>
        entry === specifier || (entry.endsWith("/*") && specifier.startsWith(entry.slice(0, -1))),
    );
    if (key === undefined) return undefined;
    const template = pickPath(imports[key]);
    if (template === undefined) return undefined;
    const resolved = key.endsWith("/*")
      ? template.replace("*", specifier.slice(key.length - 1))
      : template;
    return find([`packages/${pkg}/${resolved.replace(/^\.\//, "").replace(/^dist\//, "src/")}`]);
  }
  const match = /^@delivery-os\/([^/]+)(?:\/(.+))?$/.exec(specifier);
  if (match === null) return undefined;
  const targetPkg = match[1] ?? "";
  const sub = match[2] ?? ".";
  const exportsMap = (manifest(targetPkg).exports ?? {}) as Readonly<Record<string, unknown>>;
  const target = pickPath(exportsMap[sub === "." ? "." : `./${sub}`]);
  if (target === undefined) return undefined;
  const relative = target
    .replace(/^\.\//, "")
    .replace(/^dist\//, "src/")
    .replace(/\.d\.ts$/, ".ts")
    .replace(/\.js$/, ".ts");
  return find([`packages/${targetPkg}/${relative}`]);
};

/** Every module reachable from the declared entries. */
const reachableModules = (entries: readonly string[]): ReadonlySet<string> => {
  const reachable = new Set<string>();
  const stack = [...entries];
  while (stack.length > 0) {
    const file = stack.pop();
    if (file === undefined || reachable.has(file) || !existsSync(join(ROOT, file))) continue;
    reachable.add(file);
    for (const specifier of specifiersOf(file)) {
      const resolved = resolveSpecifier(file, specifier);
      if (resolved !== undefined) stack.push(resolved);
    }
  }
  return reachable;
};

describe("TC-SHELL-002 the static no-shell invariant", () => {
  test("the live tree is clean and every declared surface file exists", () => {
    expect(missingSurfaceFiles(ROOT)).toEqual([]);
    expect(DISPATCH_FLOW_SURFACE.length).toBeGreaterThan(0);
    expect(scan(ROOT)).toEqual([]);
    // The live allowlist is EMPTY, and the mechanism that would honour an entry
    // is exercised below — so this is a measurement, not a tautology.
    expect(NO_SHELL_ALLOWLIST).toEqual([]);
  });

  test("the allowlist mechanism is wired: a declared entry suppresses its hit", () => {
    const planted = "surface/planted.ts";
    const text = 'export const script = "tools/deliver-ticket";\n';
    const violations = scanSource(planted, text);
    expect(violations).toHaveLength(1);
    const key = allowlistKey(violations[0] as (typeof violations)[number]);
    expect(key).toBe(`${planted}:1`);

    const base = join(ROOT, "tmp", "tmpdir");
    mkdirSync(base, { recursive: true });
    const root = mkdtempSync(join(base, "no-shell-allowlist-"));
    try {
      mkdirSync(join(root, "surface"), { recursive: true });
      writeFileSync(join(root, planted), text);
      // Without the entry the hit is reported; with it the SAME hit is
      // suppressed. Removing the constant instead would leave no such proof.
      expect(scan(root, [planted], [])).toHaveLength(1);
      expect(scan(root, [planted], [key])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the declared surface equals the dispatch globs plus the fixed entries", () => {
    // A NEW `packages/core/src/{app,domain}/dispatch-*.ts` must be declared, so
    // a file can never be silently unscanned (review m3).
    const directory = (path: string, prefix: string): string[] =>
      readdirSync(join(ROOT, path))
        .filter((name) => name.startsWith(prefix) && name.endsWith(".ts"))
        .map((name) => `${path}/${name}`);
    const globbed = [
      ...directory("packages/core/src/app", "dispatch-"),
      ...directory("packages/core/src/domain", "dispatch-"),
    ].sort();
    const declared = DISPATCH_FLOW_SURFACE.filter(
      (file) => !(FIXED_SURFACE as readonly string[]).includes(file),
    ).sort();
    expect(declared).toEqual(globbed);
    expect([...DISPATCH_FLOW_SURFACE].sort()).toEqual([...globbed, ...FIXED_SURFACE].sort());
  });

  test("every declared surface file is reachable from the dispatch entries", () => {
    const reachable = reachableModules(SURFACE_ENTRIES);
    const unreachable = DISPATCH_FLOW_SURFACE.filter((file) => !reachable.has(file));
    expect(unreachable).toEqual([]);
  });

  test("R1 reports a script-path literal by rule and file", () => {
    const violations = scanSource(
      "planted.ts",
      'const script = "scripts/deliver-ticket.sh";\nexport { script };\n',
    );
    expect(violations.map((violation) => violation.rule)).toContain("script-path literal");
    expect(violations[0]?.file).toBe("planted.ts");
    expect(violations[0]?.line).toBe(1);
  });

  test("R1 reports a SUBSTITUTED template path", () => {
    const violations = scanSource(
      "planted.ts",
      "const root = '/repo';\nexport const run = () => `${root}/scripts/deliver-ticket.sh`;\n",
    );
    expect(violations.map((violation) => violation.rule)).toContain("script-path literal");
  });

  test("R2 reports shell: true", () => {
    const violations = scanSource(
      "planted.ts",
      "const options = { shell: true };\nexport { options };\n",
    );
    expect(violations.map((violation) => violation.rule)).toContain("shell-enabled spawn");
  });

  test("R3 reports every route into the child-process module", () => {
    const rows = [
      {
        label: "named exec",
        source:
          'import { execSync } from "node:child_process";\nexport const run = () => execSync("true");\n',
      },
      {
        label: "default import",
        source: 'import cp from "node:child_process";\nexport const run = () => cp.exec("true");\n',
      },
      {
        label: "require binding",
        source:
          'const cp = require("node:child_process");\nexport const run = () => cp.exec("true");\n',
      },
      {
        label: "destructured require",
        source:
          'const { execFileSync } = require("child_process");\nexport const run = () => execFileSync("x", []);\n',
      },
      {
        label: "dynamic import",
        source: 'export const load = () => import("node:child_process");\n',
      },
      {
        label: "alias",
        source:
          'import { spawn } from "node:child_process";\nconst start = spawn;\nexport const run = () => start("x", []);\n',
      },
    ] as const;
    for (const row of rows) {
      const violations = scanSource("planted.ts", row.source);
      const rules = violations.map((violation) => violation.rule);
      expect(rules, row.label).toContain(
        row.label === "named exec" ||
          row.label === "default import" ||
          row.label === "require binding" ||
          row.label === "destructured require" ||
          row.label === "dynamic import"
          ? "shell-exec import"
          : "child-process spawn without shell:false",
      );
    }
  });

  test("R4 reports a child-process spawn without shell:false, directly and through an alias", () => {
    for (const source of [
      'import { spawn } from "node:child_process";\nexport const run = () => spawn("x", [], { cwd: "/" });\n',
      'import cp from "node:child_process";\nexport const run = () => cp.spawn("x", [], { cwd: "/" });\n',
    ]) {
      expect(scanSource("planted.ts", source).map((violation) => violation.rule)).toContain(
        "child-process spawn without shell:false",
      );
    }
  });

  test("the false-positive controls report nothing", () => {
    const controls = [
      // A member access shaped like a script path is not a literal.
      'const facts = { head: { sha: "abc" } };\nexport const sha = facts.head.sha;\n',
      // A RegExp.exec call is not a child-process call.
      'const pattern = /x/u;\nexport const found = pattern.exec("x");\n',
      // A port object's .spawn( is not a child-process call.
      'export const run = (ports: { spawn: (x: string) => void }) => ports.spawn("x");\n',
      // A require of an unrelated module is not a child-process route.
      'const fs = require("node:fs");\nexport const read = () => fs;\n',
      // shell: false is accepted.
      'import { spawn } from "node:child_process";\nexport const run = () => spawn("x", [], { shell: false });\n',
      // shell: false through the namespace binding is accepted too.
      'import * as cp from "node:child_process";\nexport const run = () => cp.spawn("x", [], { shell: false });\n',
      // A scripts/ reference in a comment is not a literal.
      "// see scripts/checks/no-shell-dispatch.ts\nexport const ok = 1;\n",
    ];
    for (const source of controls) {
      expect(scanSource("control.ts", source), source.slice(0, 40)).toEqual([]);
    }
  });

  test("a planted reference is reported through the temp-workspace scan", () => {
    // The tmp parent is created first: `tmp/` is git-ignored, so a clean clone
    // running this file alone would otherwise fail with ENOENT (review m6).
    const base = join(ROOT, "tmp", "tmpdir");
    mkdirSync(base, { recursive: true });
    const root = mkdtempSync(join(base, "no-shell-control-"));
    try {
      mkdirSync(join(root, "surface"), { recursive: true });
      writeFileSync(
        join(root, "surface", "planted.ts"),
        'export const script = "tools/deliver-ticket";\n',
      );
      const violations = scan(root, ["surface/planted.ts"]);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        rule: "script-path literal",
        file: "surface/planted.ts",
        line: 1,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
