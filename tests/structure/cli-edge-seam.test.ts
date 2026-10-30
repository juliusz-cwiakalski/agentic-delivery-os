/**
 * TC-RUNCLI-004 / TC-REDACT-004 — brand values arrive as parameters at the edge,
 * no ambient environment read exists in the CLI, and serialization is the single
 * write path downstream of redaction.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { registerEdgeSecrets } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { bufferSink, loadProgram, programFor, SYNTHETIC_BRAND } from "../golden/helpers";

const ROOT = process.cwd();
const CLI_DIR = "packages/cli/src";
const SERIALIZE = `${CLI_DIR}/output/serialize.ts`;
const SEED_LITERALS = ["a" + "dos", "A" + "DOS_", "~/" + "." + "ad" + "os"];

const listTypeScriptFiles = (root: string, relativeDir: string): string[] => {
  const results: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith(".ts")) results.push(next);
    }
  };
  walk(relativeDir);
  return results.sort();
};

const parse = (root: string, relative: string): ts.SourceFile =>
  ts.createSourceFile(
    relative,
    readFileSync(join(root, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

const lineOf = (source: ts.SourceFile, node: ts.Node): number =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

const envReadFailures = (root: string): string[] => {
  const failures: string[] = [];
  for (const file of listTypeScriptFiles(root, CLI_DIR)) {
    const source = parse(root, file);
    const visit = (node: ts.Node): void => {
      if (
        ts.isPropertyAccessExpression(node) &&
        node.name.text === "env" &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === "process" || node.expression.text === "Bun")
      ) {
        failures.push(`${file}:${lineOf(source, node)} ambient environment read`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return failures;
};

const streamWriteFailures = (root: string): string[] => {
  const failures: string[] = [];
  for (const file of listTypeScriptFiles(root, CLI_DIR)) {
    if (file === SERIALIZE) continue;
    const source = parse(root, file);
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const owner = node.expression.expression;
        const method = node.expression.name.text;
        if (method === "write") {
          failures.push(`${file}:${lineOf(source, node)} stream write`);
        }
        if (ts.isIdentifier(owner) && owner.text === "console") {
          failures.push(`${file}:${lineOf(source, node)} console write`);
        }
        if (ts.isIdentifier(owner) && owner.text === "process" && method !== "exit") {
          failures.push(`${file}:${lineOf(source, node)} process stream access`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return failures;
};

const serializerImporters = (root: string): string[] => {
  const importers: string[] = [];
  for (const file of listTypeScriptFiles(root, CLI_DIR)) {
    const source = parse(root, file);
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const specifier = statement.moduleSpecifier.text;
      if (specifier.includes("output/serialize") || specifier.endsWith("/serialize")) {
        importers.push(file);
      }
    }
  }
  return importers.sort();
};

const callPositions = (
  source: ts.SourceFile,
): { redact: number | undefined; write: number | undefined; writes: number } => {
  let redact: number | undefined;
  let write: number | undefined;
  let writes = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isIdentifier(expression) && expression.text === "redact") {
        redact ??= node.getStart(source);
      }
      if (ts.isPropertyAccessExpression(expression) && expression.name.text === "write") {
        writes += 1;
        write ??= node.getStart(source);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { redact, write, writes };
};

const writeOrderFailures = (sourceText: string, path: string): string[] => {
  const source = ts.createSourceFile(
    path,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const positions = callPositions(source);
  const failures: string[] = [];
  if (positions.writes !== 1) failures.push(`${path}: expected exactly one stream write`);
  if (positions.redact === undefined) failures.push(`${path}: no redaction call`);
  if (
    positions.redact !== undefined &&
    positions.write !== undefined &&
    positions.write < positions.redact
  ) {
    failures.push(`${path}: stream write occurs before redaction`);
  }
  return failures;
};

const staticHintFailures = (root: string): string[] => {
  const failures: string[] = [];
  const file = "packages/core/src/contracts/error-table.ts";
  const source = parse(root, file);
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node)) {
      const name =
        ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : "";
      if (name === "remediationHint" || name === "summary") {
        if (!ts.isStringLiteral(node.initializer)) {
          failures.push(`${file}:${lineOf(source, node)} ${name} must be a static string`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return failures;
};

const productTokenFailures = (root: string): string[] => {
  const failures: string[] = [];
  for (const file of listTypeScriptFiles(root, CLI_DIR)) {
    const text = readFileSync(join(root, file), "utf8");
    for (const token of SEED_LITERALS) {
      if (text.includes(token)) failures.push(`${file}: product token`);
    }
  }
  return failures;
};

const makeTempCliFile = (relative: string, content: string): string => {
  const root = mkdtempSync(join(tmpdir(), "cli-seam-"));
  mkdirSync(join(root, CLI_DIR), { recursive: true });
  const path = join(root, relative);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
  return root;
};

describe("TC-RUNCLI-004 brand and environment seam", () => {
  test("no ambient environment read exists in the CLI", () => {
    expect(envReadFailures(ROOT)).toEqual([]);
  });

  test("the edge receives environment facts as data", () => {
    const first = registerEdgeSecrets({ FIRST: "planted-fake-secret-0200" }, ["FIRST", "MISSING"]);
    const second = registerEdgeSecrets({ FIRST: "planted-fake-secret-0201" }, ["FIRST"]);
    expect(first).toEqual(["planted-fake-secret-0200"]);
    expect(second).toEqual(["planted-fake-secret-0201"]);
  });

  test("a temp-copy command env read fails by file and line", () => {
    const root = makeTempCliFile(
      `${CLI_DIR}/commands/probe.ts`,
      "export const value = process.env.SOMETHING;\n",
    );
    try {
      const failures = envReadFailures(root);
      expect(failures.some((message) => message.includes("commands/probe.ts:1"))).toBe(true);
    } finally {
      // temp tree is intentionally left for the OS to reap
    }
  });

  test("a temp-copy edge env read also fails (no exception path)", () => {
    const root = makeTempCliFile(`${CLI_DIR}/edge.ts`, "export const value = Bun.env.SOMETHING;\n");
    expect(envReadFailures(root).length).toBeGreaterThan(0);
  });

  test("brand-dependent text reflects the injected identity", async () => {
    const stdout = bufferSink();
    const stderr = bufferSink();
    const ticks = [1, 2] as const;
    let tick = 0;
    const deps: CliDependencies = {
      brand: { ...SYNTHETIC_BRAND, binaryName: "renamed-product" },
      clock: {
        now: () => {
          const value = ticks[Math.min(tick, 1)] as number;
          tick += 1;
          return value;
        },
      },
      newRunId: () => "run-brand",
      secrets: [],
      program: programFor(loadProgram("ok-data")),
    };
    const exitCode = await runCli(["--json", "synthetic.missing"], { stdout, stderr }, deps);
    expect(exitCode).toBe(1);
    expect(stderr.value).toContain("renamed-product");
    expect(JSON.parse(stdout.value)).toMatchObject({ error: { code: "fallback.invocation" } });
  });

  test("no product token literal exists in the new CLI code", () => {
    expect(productTokenFailures(ROOT)).toEqual([]);
  });
});

describe("TC-REDACT-004 single serialization chokepoint", () => {
  test("only the surface entry imports the serializer", () => {
    expect(serializerImporters(ROOT)).toEqual([`${CLI_DIR}/index.ts`]);
  });

  test("no other CLI module writes to a stream", () => {
    expect(streamWriteFailures(ROOT)).toEqual([]);
  });

  test("the serializer has one write call site after the redaction call", () => {
    const source = readFileSync(join(ROOT, SERIALIZE), "utf8");
    expect(writeOrderFailures(source, SERIALIZE)).toEqual([]);
  });

  test("an order-swapped temp copy is detected", () => {
    const mutated = [
      'import { redact } from "./something";',
      "export const write = (stream: { write: (chunk: string) => void }, value: unknown) => {",
      '  stream.write("fragment");',
      "  return redact(value, []);",
      "};",
    ].join("\n");
    expect(writeOrderFailures(mutated, "mutant.ts").length).toBeGreaterThan(0);
  });

  test("hints and summaries are static table data", () => {
    expect(staticHintFailures(ROOT)).toEqual([]);
  });

  test("a temp-copy console.log in a command module is detected by file and line", () => {
    const root = makeTempCliFile(
      `${CLI_DIR}/commands/probe.ts`,
      "export const leak = (payload: unknown): void => {\n  console.log(payload);\n};\n",
    );
    const failures = streamWriteFailures(root);
    expect(failures.some((message) => message.includes("commands/probe.ts:2"))).toBe(true);
  });
});
