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
import {
  classifyDomainKind,
  classifyThrown,
  resolveAppErrorCode,
} from "../../packages/cli/src/classify";
import {
  DOMAIN_KINDS,
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
  code === FALLBACK_INVOCATION_CODE ||
  code === FALLBACK_INTERNAL_CODE ||
  code === "provider.outage" ||
  CODE_PATTERN.test(code);

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
    expect(config).toHaveLength(10);
    const declared = [
      ...readFileSync(join(ROOT, CONTRACTS_DIR, "config.ts"), "utf8").matchAll(
        /\| "(config\.[a-z]+\.[a-z]+)"|= "(config\.[a-z]+\.[a-z]+)"/g,
      ),
      // The credential port carries the `config`-kind identity it surfaces.
      ...readFileSync(join(ROOT, CONTRACTS_DIR, "credentials.ts"), "utf8").matchAll(
        /= "(config\.[a-z]+\.[a-z]+)"/g,
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
    expect(scoped).toContain(`${CONTRACTS_DIR}/pm-notes.ts`);
    expect(scoped).toContain(`${CONTRACTS_DIR}/registry.ts`);
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

describe("TC-STATE-018 state rows join the declared kind set", () => {
  test("state is a declared multi-row domain kind and never singleton-classified", () => {
    expect(DOMAIN_KINDS).toContain("state");
    const state = entries.filter((entry) => entry.domainKind === "state");
    expect(state).toHaveLength(7);
    for (const entry of state) {
      expect(entry.code.startsWith("state.")).toBe(true);
      expect(entry.consequence).toBe("not_landed");
      expect(entry.remediationHint.length).toBeGreaterThan(0);
      expect(entry.summary ?? "").not.toContain("planted-");
    }
  });

  test("the documented and machine state rows agree row for row", () => {
    const doc = readFileSync(join(ROOT, "doc/spec/features/feature-result-contract.md"), "utf8");
    for (const entry of entries.filter((candidate) => candidate.domainKind === "state")) {
      const row = `| ${entry.code} | state | ${entry.category} | ${entry.retryable} | ${entry.consequence} | ${entry.remediationHint} | ${entry.projectionClass} | ${entry.summary ?? ""} |`;
      expect(doc, entry.code).toContain(row);
    }
  });
});

const LINT_ROWS = [
  [
    "lint.notes.malformed",
    "Correct the document so it conforms to the pm-notes schema (syntax, structure, and value types) and retry.",
    "The pm-notes document is malformed.",
  ],
  [
    "lint.keys.missing",
    "Add the named required key(s) with a conforming value and retry.",
    "A required pm-notes key is missing.",
  ],
  [
    "lint.variant.unknown",
    "Set `variant` to `full` or `lite` and retry.",
    "The pm-notes variant is unknown.",
  ],
  [
    "lint.phases.incomplete",
    "Add the named missing required phase(s) of the declared variant or correct the declared variant.",
    "A required phase of the declared variant is missing.",
  ],
  [
    "lint.target.missing",
    "pm-notes target only: initialize pm-notes for the named change ref or correct the reference (an absent registry target is a verified-empty pass, C-3).",
    "The pm-notes target is missing.",
  ],
] as const;

describe("TC-SYNC-007 lint rows are exact and additive", () => {
  test("lint is a declared multi-row kind with exactly the five pinned rows", () => {
    expect(DOMAIN_KINDS).toContain("lint");
    const lint = entries.filter((entry) => entry.domainKind === "lint");
    expect(lint).toHaveLength(5);
    expect(lint.map((entry) => entry.code)).toEqual(LINT_ROWS.map(([code]) => code));
    for (const [code, hint, summary] of LINT_ROWS) {
      expect(classifyDomainKind("lint", code)).toMatchObject({
        code,
        domainKind: "lint",
        category: "user",
        retryable: false,
        consequence: "not_landed",
        projectionClass: "user-validation",
        remediationHint: hint,
        summary,
      });
    }
  });

  test("lint codes round-trip exactly through returned and thrown classification", () => {
    for (const [code] of LINT_ROWS) {
      const row = classifyDomainKind("lint", code);
      expect(resolveAppErrorCode(code)).toEqual({ ok: true, entry: row });
      expect(classifyThrown({ kind: "lint", code })).toEqual(row);
      expect(classifyThrown({ kind: "lint", code, summary: "UNTRUSTED-CANARY" })).toEqual(row);
    }
  });

  test("the documented and machine lint rows agree row for row, exactly once", () => {
    const doc = readFileSync(join(ROOT, "doc/spec/features/feature-result-contract.md"), "utf8");
    for (const [code, hint, summary] of LINT_ROWS) {
      const row = `| ${code} | lint | user | false | not_landed | ${hint} | user-validation | ${summary} |`;
      expect(doc.split(row).length - 1, code).toBe(1);
    }
  });

  test("existing provider, input, config and state rows are unchanged", () => {
    expect(classifyDomainKind("provider", "provider.quota.exceeded").code).toBe(
      "provider.quota.exceeded",
    );
    expect(() => classifyDomainKind("provider")).toThrow();
    expect(classifyDomainKind("input").code).toBe("input.value.rejected");
    expect(entries.filter((entry) => entry.domainKind === "config")).toHaveLength(10);
    expect(entries.filter((entry) => entry.domainKind === "state")).toHaveLength(7);
    expect(() => classifyDomainKind("config")).toThrow();
    expect(() => classifyDomainKind("state")).toThrow();
  });
});

const PROVIDER_ROWS = [
  [
    "provider.quota.exceeded",
    "transient",
    true,
    "not_landed",
    "Wait for the quota window to reset, then retry the operation.",
    "platform-provider",
    "The provider quota was exceeded.",
  ],
  [
    "provider.outage",
    "transient",
    true,
    "not_landed",
    "Retry after the provider becomes reachable; consult the announcement and park for the resume time.",
    "platform-provider",
    "The provider is unreachable.",
  ],
  [
    "provider.auth.rejected",
    "user",
    false,
    "not_landed",
    "Correct or replace the declared credential and retry.",
    "user-validation",
    "The provider rejected the credential.",
  ],
  [
    "provider.chain.empty",
    "user",
    false,
    "not_landed",
    "Declare a non-empty provider chain (or select one) and retry.",
    "user-validation",
    "No provider chain is declared.",
  ],
  [
    "provider.chain.invalid",
    "user",
    false,
    "not_landed",
    "Correct the named chain entries, ordering, or references and retry.",
    "user-validation",
    "The provider chain is invalid.",
  ],
] as const;

describe("TC-PROV-045 provider rows are exact and synced", () => {
  test("the five provider rows carry their declared fields", () => {
    const provider = entries.filter((entry) => entry.domainKind === "provider");
    expect(provider.map((entry) => entry.code)).toEqual(PROVIDER_ROWS.map(([code]) => code));
    for (const [
      code,
      category,
      retryable,
      consequence,
      hint,
      projectionClass,
      summary,
    ] of PROVIDER_ROWS) {
      expect(classifyDomainKind("provider", code)).toMatchObject({
        code,
        domainKind: "provider",
        category,
        retryable,
        consequence,
        remediationHint: hint,
        projectionClass,
        summary,
      });
    }
  });

  test("the documented provider rows agree exactly once", () => {
    const doc = readFileSync(join(ROOT, "doc/spec/features/feature-result-contract.md"), "utf8");
    for (const [code, , , , hint, projectionClass, summary] of PROVIDER_ROWS) {
      const row = `| ${code} | provider | ${PROVIDER_ROWS.find(([candidate]) => candidate === code)?.[1]} | ${String(PROVIDER_ROWS.find(([candidate]) => candidate === code)?.[2])} | not_landed | ${hint} | ${projectionClass} | ${summary} |`;
      expect(doc.split(row).length - 1, code).toBe(1);
    }
const VERIFY_HINT =
  "Complete the named required phases of the declared variant through the phase command, or correct the declaration, then re-run verify.";
const VERIFY_SUMMARY = "The declared variant's required phases are not all completed.";

describe("TC-VERIFY-019 verify kind and row", () => {
  test("verify is a declared single-row kind with the exact C-8 fields", () => {
    expect(DOMAIN_KINDS).toContain("verify");
    const verify = entries.filter((entry) => entry.domainKind === "verify");
    expect(verify).toHaveLength(1);
    expect(verify[0]).toMatchObject({
      code: "verify.ledger.incomplete",
      domainKind: "verify",
      category: "user",
      retryable: false,
      consequence: "not_landed",
      projectionClass: "user-validation",
      remediationHint: VERIFY_HINT,
      summary: VERIFY_SUMMARY,
    });
  });

  test("the verify row round-trips through returned, thrown, and exact-code selection", () => {
    const row = classifyDomainKind("verify", "verify.ledger.incomplete");
    expect(row.code).toBe("verify.ledger.incomplete");
    expect(resolveAppErrorCode("verify.ledger.incomplete")).toEqual({ ok: true, entry: row });
    expect(classifyThrown({ kind: "verify", code: "verify.ledger.incomplete" })).toEqual(row);
    expect(
      classifyThrown({ kind: "verify", code: "verify.ledger.incomplete", summary: "x" }),
    ).toEqual(row);
    expect(() => classifyDomainKind("verify", "lint.notes.malformed")).toThrow();
  });

  test("the documented row appears exactly once and matches column-for-column", () => {
    const doc = readFileSync(join(ROOT, "doc/spec/features/feature-result-contract.md"), "utf8");
    const row = `| verify.ledger.incomplete | verify | user | false | not_landed | ${VERIFY_HINT} | user-validation | ${VERIFY_SUMMARY} |`;
    expect(doc.split(row).length - 1).toBe(1);
    const declaredKinds = "`provider`, `input`, `config`, `state`, `lint`, and `verify`";
    expect(doc).toContain(declaredKinds);
    expect(doc).toContain("`verify.ledger.incomplete`");
  });

  test("existing kinds remain untouched and the addition is the only new row", () => {
    expect(entries.filter((entry) => entry.domainKind === "provider")).toHaveLength(1);
    expect(entries.filter((entry) => entry.domainKind === "input")).toHaveLength(1);
    expect(entries.filter((entry) => entry.domainKind === "config")).toHaveLength(10);
    expect(entries.filter((entry) => entry.domainKind === "state")).toHaveLength(7);
    expect(entries.filter((entry) => entry.domainKind === "lint")).toHaveLength(5);
    expect(entries).toHaveLength(27);
  });
});
