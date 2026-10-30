/**
 * TC-TABLE-001..004 and TC-BOUNDARY-001 — row shape, fallback containment,
 * identity hygiene, single-source/runtime-neutral declarations, and the ambient
 * guard's coverage of the new contracts files.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { resolveAppErrorCode } from "../../packages/cli/src/classify";
import {
  ERROR_TABLE,
  type ErrorTableEntry,
  FALLBACK_INTERNAL_CODE,
  FALLBACK_INVOCATION_CODE,
} from "../../packages/core/src/contracts/index";
import { scan, scopedFiles } from "../../scripts/checks/ambient-globals";

const ROOT = process.cwd();
const CONTRACTS_DIR = "packages/core/src/contracts";
const ALLOWLIST = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/result/unknown-consequence-allowlist.json"), "utf8"),
) as { baseline: string[]; allowed: string[] };
const RESULT_SHAPE = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/result/result-shape.json"), "utf8"),
) as {
  resultType: string;
  okTrue: string;
  okFalse: string;
  commandResultType: string;
};

const entries = ERROR_TABLE as readonly ErrorTableEntry[];
const REQUIRED_KEYS = [
  "code",
  "domainKind",
  "category",
  "retryable",
  "consequence",
  "remediationHint",
  "projectionClass",
] as const;
const CATEGORIES = ["user", "platform", "transient", "permanent"];
const CONSEQUENCES = ["landed", "not_landed", "unknown"];
const PROJECTION_CLASSES = ["success", "user-validation", "platform-provider"];
const CODE_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/;

const isValidCode = (code: string): boolean =>
  code === FALLBACK_INVOCATION_CODE || code === FALLBACK_INTERNAL_CODE || CODE_PATTERN.test(code);

const contractsFiles = (): string[] =>
  readdirSync(join(ROOT, CONTRACTS_DIR))
    .filter((entry) => entry.endsWith(".ts"))
    .map((entry) => `${CONTRACTS_DIR}/${entry}`)
    .sort();

const parse = (root: string, relative: string): ts.SourceFile =>
  ts.createSourceFile(
    relative,
    readFileSync(join(root, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

const listTypeScriptFiles = (root: string, relativeDir: string): string[] => {
  const results: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules") continue;
        walk(next);
      } else if (entry.name.endsWith(".ts")) results.push(next);
    }
  };
  walk(relativeDir);
  return results.sort();
};

const ALLOWED_DECLARATIONS = new Set<number>([
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.EndOfFileToken,
]);

const declarationViolations = (root: string, relative: string): string[] => {
  const violations: string[] = [];
  const source = parse(root, relative);
  for (const statement of source.statements) {
    if (!ALLOWED_DECLARATIONS.has(statement.kind)) {
      violations.push(`${relative}: executable statement ${ts.SyntaxKind[statement.kind]}`);
    }
  }
  return violations;
};

const runtimeImportViolations = (root: string, relative: string): string[] => {
  const violations: string[] = [];
  const source = parse(root, relative);
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    if (specifier.startsWith("node:") || specifier.startsWith("bun:")) {
      violations.push(`${relative}: runtime import ${specifier}`);
    }
  }
  return violations;
};

const makeTempContractsFile = (content: string): string => {
  const root = mkdtempSync(join(tmpdir(), "contracts-probe-"));
  const path = join(root, CONTRACTS_DIR, "probe.ts");
  mkdirSync(join(root, CONTRACTS_DIR), { recursive: true });
  writeFileSync(path, content);
  return root;
};

describe("TC-TABLE-001 full row shape", () => {
  test("every entry declares every required column with valid enums", () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      for (const key of REQUIRED_KEYS) {
        expect(Object.hasOwn(entry, key), `${entry.code} missing ${key}`).toBe(true);
      }
      expect(typeof entry.code).toBe("string");
      expect(typeof entry.domainKind).toBe("string");
      expect(CATEGORIES).toContain(entry.category);
      expect(typeof entry.retryable).toBe("boolean");
      expect(CONSEQUENCES).toContain(entry.consequence);
      expect(typeof entry.remediationHint).toBe("string");
      expect(entry.remediationHint.length).toBeGreaterThan(0);
      expect(PROJECTION_CLASSES).toContain(entry.projectionClass);
      if (entry.summary !== undefined) {
        expect(typeof entry.summary).toBe("string");
        expect(entry.summary.length).toBeGreaterThan(0);
      }
    }
  });

  test("the four bound seed entries exist and no hint carries a planted marker", () => {
    const codes = entries.map((entry) => entry.code);
    expect(codes).toContain(FALLBACK_INVOCATION_CODE);
    expect(codes).toContain(FALLBACK_INTERNAL_CODE);
    expect(codes).toContain("provider.quota.exceeded");
    expect(codes).toContain("input.value.rejected");
    for (const entry of entries) {
      expect(entry.remediationHint).not.toContain("planted-fake-");
      expect(entry.summary ?? "").not.toContain("planted-fake-");
    }
  });

  test("every entry states consequence explicitly", () => {
    for (const entry of entries) {
      expect(Object.hasOwn(entry, "consequence")).toBe(true);
      expect(CONSEQUENCES).toContain(entry.consequence);
    }
  });
});

describe("TC-TABLE-002 fallback containment", () => {
  test("exactly two containment entries, no third fallback member", () => {
    const fallback = entries.filter((entry) => entry.code.startsWith("fallback."));
    expect(fallback.map((entry) => entry.code).sort()).toEqual(
      [FALLBACK_INTERNAL_CODE, FALLBACK_INVOCATION_CODE].sort(),
    );
  });

  test("DEC-13 fields are fixed", () => {
    const invocation = entries.find((entry) => entry.code === FALLBACK_INVOCATION_CODE);
    const internal = entries.find((entry) => entry.code === FALLBACK_INTERNAL_CODE);
    expect(invocation).toMatchObject({
      category: "user",
      retryable: false,
      consequence: "unknown",
      projectionClass: "user-validation",
    });
    expect(internal).toMatchObject({
      category: "platform",
      retryable: false,
      consequence: "unknown",
      projectionClass: "platform-provider",
    });
    expect(invocation?.remediationHint.length ?? 0).toBeGreaterThan(0);
    expect(internal?.remediationHint.length ?? 0).toBeGreaterThan(0);
  });

  test("unknown consequence is allowlisted outside the baseline", () => {
    const unknown = entries
      .filter((entry) => entry.consequence === "unknown")
      .map((entry) => entry.code);
    const baseline = new Set(ALLOWLIST.baseline);
    const allowed = new Set(ALLOWLIST.allowed);
    for (const code of unknown) {
      if (baseline.has(code)) continue;
      expect(allowed.has(code), `${code} must be allowlisted or justified`).toBe(true);
    }
    expect([...baseline].sort()).toEqual([FALLBACK_INTERNAL_CODE, FALLBACK_INVOCATION_CODE].sort());
  });

  test("both fallback codes resolve through the ordinary path", () => {
    for (const code of [FALLBACK_INVOCATION_CODE, FALLBACK_INTERNAL_CODE]) {
      const resolution = resolveAppErrorCode(code);
      expect(resolution.ok).toBe(true);
      if (resolution.ok) expect(resolution.entry.code).toBe(code);
    }
  });
});

describe("TC-TABLE-003 code identity", () => {
  test("all config discriminants are declared once with a matching namespace", () => {
    const config = entries.filter((entry) => entry.domainKind === "config");
    expect(config).toHaveLength(9);
    const declared = [
      ...readFileSync(join(ROOT, CONTRACTS_DIR, "config.ts"), "utf8").matchAll(
        /\| "(config\.[a-z]+\.[a-z]+)"|= "(config\.[a-z]+\.[a-z]+)"/g,
      ),
    ].map((match) => match[1] ?? match[2]);
    expect(declared.sort()).toEqual(config.map((entry) => entry.code).sort());
    for (const entry of config) {
      expect(entry.code.startsWith("config.")).toBe(true);
      expect(entry.category).toBe("user");
      expect(entry.retryable).toBe(false);
      expect(entry.consequence).toBe("not_landed");
      expect(entry.projectionClass).toBe("user-validation");
    }
  });
  test("codes are well-formed and unique", () => {
    const codes = entries.map((entry) => entry.code);
    for (const code of codes) expect(isValidCode(code), code).toBe(true);
    expect(new Set(codes).size).toBe(codes.length);
  });

  test("resolution is total and functional", () => {
    for (const entry of entries) {
      const resolution = resolveAppErrorCode(entry.code);
      expect(resolution.ok).toBe(true);
      if (resolution.ok) expect(resolution.entry).toEqual(entry);
    }
  });

  test("negative identity forms are rejected", () => {
    for (const code of [
      "404",
      "provider.quota",
      "Provider.Quota.Exceeded",
      "1provider.quota.exceeded",
      "https://example.invalid/error",
      "HTTP_404",
      "fallback.legacy",
    ]) {
      expect(isValidCode(code), code).toBe(false);
    }
  });

  test("an unknown code is reported as unresolvable, not contained", () => {
    const resolution = resolveAppErrorCode("input.unknown.value");
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) expect(resolution.reason).toBe("unresolvable");
  });
});

describe("TC-TABLE-004 single declaration and runtime neutrality", () => {
  test("the table is declared once and never in the CLI", () => {
    const cliFiles = listTypeScriptFiles(ROOT, "packages/cli/src");
    for (const file of cliFiles) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text.includes("ERROR_TABLE ="), `${file} must not declare the table`).toBe(false);
    }
    const declarations = contractsFiles().filter((file) =>
      readFileSync(join(ROOT, file), "utf8").includes("export const ERROR_TABLE"),
    );
    expect(declarations).toEqual([`${CONTRACTS_DIR}/error-table.ts`]);
  });

  test("fixtures reference codes but do not declare entry-shaped rows", () => {
    const walk = (relative: string): string[] => {
      const results: string[] = [];
      for (const entry of readdirSync(join(ROOT, relative), { withFileTypes: true })) {
        const next = `${relative}/${entry.name}`;
        if (entry.isDirectory()) results.push(...walk(next));
        else if (entry.name.endsWith(".json")) results.push(next);
      }
      return results;
    };
    const isEntryShaped = (value: unknown): boolean =>
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      REQUIRED_KEYS.every((key) => Object.hasOwn(value, key));
    for (const file of walk("tests/fixtures")) {
      const parsed = JSON.parse(readFileSync(join(ROOT, file), "utf8")) as unknown;
      const visit = (value: unknown): boolean => {
        if (isEntryShaped(value)) return true;
        if (Array.isArray(value)) return value.some(visit);
        if (typeof value === "object" && value !== null) {
          return Object.values(value).some(visit);
        }
        return false;
      };
      expect(visit(parsed), `${file} must not declare an entry-shaped row`).toBe(false);
    }
  });

  test("contracts declarations are types and also data only", () => {
    for (const file of contractsFiles()) {
      expect(declarationViolations(ROOT, file), file).toEqual([]);
      expect(runtimeImportViolations(ROOT, file), file).toEqual([]);
    }
  });

  test("Result is unchanged and CommandResult is a separate declaration", () => {
    const source = readFileSync(join(ROOT, CONTRACTS_DIR, "index.ts"), "utf8");
    expect(source).toContain(RESULT_SHAPE.resultType);
    expect(source).toContain(RESULT_SHAPE.okTrue);
    expect(source).toContain(RESULT_SHAPE.okFalse);
    const resultDeclarations = contractsFiles().filter((file) =>
      readFileSync(join(ROOT, file), "utf8").includes(RESULT_SHAPE.resultType),
    );
    expect(resultDeclarations).toEqual([`${CONTRACTS_DIR}/index.ts`]);
    const commandDeclarations = contractsFiles().filter((file) =>
      readFileSync(join(ROOT, file), "utf8").includes(RESULT_SHAPE.commandResultType),
    );
    expect(commandDeclarations).toEqual([`${CONTRACTS_DIR}/result.ts`]);
  });
});

describe("TC-BOUNDARY-001 contracts ambient coverage", () => {
  test("new contracts files are inside the ambient scan scope", () => {
    const scoped = scopedFiles(ROOT);
    expect(scoped).toContain(`${CONTRACTS_DIR}/result.ts`);
    expect(scoped).toContain(`${CONTRACTS_DIR}/error-table.ts`);
    expect(scan(ROOT)).toEqual([]);
  });

  test("temp-copy ambient probes fail naming file, line, and kind", () => {
    const probes: Array<[string, string]> = [
      ["export const value = Date.now();\n", "Date.now"],
      ["export const value = Math.random();\n", "Math.random"],
      ["export const value = process.env.EXAMPLE;\n", "process.env"],
    ];
    for (const [source, detail] of probes) {
      const root = makeTempContractsFile(source);
      try {
        const violations = scan(root);
        expect(violations.length, source).toBeGreaterThan(0);
        expect(violations[0]?.file).toBe(`${CONTRACTS_DIR}/probe.ts`);
        expect(violations[0]?.line).toBe(1);
        expect(violations[0]?.detail).toContain(detail);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  test("temp-copy runtime imports fail naming the file and specifier", () => {
    const root = makeTempContractsFile('import { readFileSync } from "node:fs";\n');
    try {
      const violations = runtimeImportViolations(root, `${CONTRACTS_DIR}/probe.ts`);
      expect(violations.some((message) => message.includes("node:fs"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
