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
  BOARD_COLLECTOR_ERROR_PREFIX,
  BOARD_COLLECTOR_ERROR_SUFFIX,
  BOARD_COLLECTOR_IDS,
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
const CODE_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*){2,}$/;

const RESERVED_TWO_SEGMENT_CODES = new Set([
  "provider.outage",
  "watchdog.checkout-dirty",
  "watchdog.checkout-non-base",
  "watchdog.signals-absent",
  "blockers.invalid-type",
  "blockers.unknown-id",
  "blockers.credential-value-rejected",
  "blockers.audience-mismatch",
  // GH-235 pins the sourced-stall and dispatch economics identities exactly.
  "watchdog.liveness-stalled",
  "dispatch.restart-budget-exceeded",
  "dispatch.resume-uneconomical",
  "dispatch.state-unverified",
  // GH-227 pins these three commit identities exactly; they remain exact
  // declared codes, not a pattern widening.
  "commit.staging-blocked-untracked",
  "commit.commitlint-failed",
  "commit.atomic-abort",
  // GH-225 pins the merge identities exactly; they are two-segment codes.
  "merge.gates-stale",
  "merge.waiver-unauthorized",
  "merge.owner-gate-override-without-waiver",
  "merge.rebase-conflict",
  "merge.state-unverified",
  "merge.landing-unverified",
  "merge.transaction-aborted",
  // GH-240 pins the capsule-invalid identity exactly; it is a two-segment code.
  "closeout.capsule-invalid",
  // GH-236 pins the spend read-side identity exactly; it is a two-segment code.
  "spend.telemetry-absent",
  // GH-237 pins the four two-segment queue identities exactly.
  "queue.dependency-cycle",
  "queue.lease-conflict",
  "queue.park-condition-stuck",
  "queue.entry.unobserved",
  // GH-238 pins the eight resident-daemon identities exactly.
  "daemon.already-running",
  "daemon.takeover-refused",
  "daemon.heartbeat-stale",
  "daemon.state-recovery-failed",
  "daemon.protocol.unsupported",
  "daemon.socket-unreachable",
  "daemon.subscriber-degraded",
  "daemon.supervisor-unsupported",
  // GH-241 pins the two two-segment coordinator identities exactly; the other
  // four coordinator identities are three-segment.
  "coordinator.already-running",
  "coordinator.restart-budget-exhausted",
]);

const isValidCode = (code: string): boolean =>
  code === FALLBACK_INVOCATION_CODE ||
  code === FALLBACK_INTERNAL_CODE ||
  RESERVED_TWO_SEGMENT_CODES.has(code) ||
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
    expect(state).toHaveLength(9);
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
  test("lint is a declared multi-row kind with the five conformance rows plus the unreadable row", () => {
    expect(DOMAIN_KINDS).toContain("lint");
    const lint = entries.filter((entry) => entry.domainKind === "lint");
    expect(lint).toHaveLength(6);
    expect(lint.map((entry) => entry.code)).toEqual([
      ...LINT_ROWS.map(([code]) => code),
      "lint.document.unreadable",
    ]);
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
    expect(classifyDomainKind("lint", "lint.document.unreadable")).toMatchObject({
      category: "platform",
      retryable: false,
      consequence: "not_landed",
      projectionClass: "platform-provider",
      summary: "A lint target document could not be read or decoded.",
    });
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
    const unreadable = classifyDomainKind("lint", "lint.document.unreadable");
    const unreadableRow = `| ${unreadable.code} | lint | ${unreadable.category} | ${unreadable.retryable} | ${unreadable.consequence} | ${unreadable.remediationHint} | ${unreadable.projectionClass} | ${unreadable.summary ?? ""} |`;
    expect(doc.split(unreadableRow).length - 1).toBe(1);
  });

  test("existing provider, input, config and state rows are unchanged", () => {
    expect(classifyDomainKind("provider", "provider.quota.exceeded").code).toBe(
      "provider.quota.exceeded",
    );
    expect(() => classifyDomainKind("provider")).toThrow();
    expect(classifyDomainKind("input").code).toBe("input.value.rejected");
    expect(entries.filter((entry) => entry.domainKind === "config")).toHaveLength(10);
    expect(entries.filter((entry) => entry.domainKind === "state")).toHaveLength(9);
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
  [
    "provider.profile.absent",
    "user",
    false,
    "not_landed",
    "Declare provider profiles and a preference chain in configuration, then retry; no model is invented when nothing is declared.",
    "user-validation",
    "No provider profile or preference chain is declared.",
  ],
  [
    "provider.profile.invalid",
    "user",
    false,
    "not_landed",
    "Correct the named profile, tier, seat, chain entry, or pacing value and retry; the profile configuration is validated fail-closed.",
    "user-validation",
    "The provider profile configuration is invalid.",
  ],
  [
    "provider.profile.capability-denied",
    "user",
    false,
    "not_landed",
    "Assign a seat whose declared capability matches the task (for example vision-capable) and retry; the gate reads declared descriptors only.",
    "user-validation",
    "A profile seat was refused by the hard capability gate.",
  ],
  [
    "provider.profile.unavailable",
    "transient",
    true,
    "not_landed",
    "Wait for a named provider condition to clear or declare another eligible profile, then retry; the decision is parked with reasons.",
    "platform-provider",
    "No provider profile is eligible under the current conditions.",
  ],
  [
    "provider.env-record.unauthorized",
    "user",
    false,
    "not_landed",
    "Use a model-environment name that matches the configured allowlist and retry; the record was rejected as a whole.",
    "user-validation",
    "The env record names a variable outside the allowlist.",
  ],
  [
    "provider.env-record.duplicate",
    "user",
    false,
    "not_landed",
    "Remove the duplicated env-record name and retry; the record was rejected as a whole.",
    "user-validation",
    "The env record declares a name more than once.",
  ],
  [
    "provider.env-record.malformed",
    "user",
    false,
    "not_landed",
    "Correct the env-record header, line grammar, name shape, or final line feed and retry; the record was rejected as a whole.",
    "user-validation",
    "The env record does not conform to the data-v1 grammar.",
  ],
  [
    "provider.env-record.oversized",
    "user",
    false,
    "not_landed",
    "Reduce the env-record file, line, or record count below the configured limits and retry.",
    "user-validation",
    "The env record exceeds a configured size limit.",
  ],
] as const;

describe("TC-PROV-045 provider rows are exact and synced", () => {
  test("the thirteen provider rows carry their declared fields", () => {
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
  });
});

const VERIFY_HINT =
  "Complete the named required phases of the declared variant through the phase command, or correct the declaration, then re-run verify.";
const VERIFY_SUMMARY = "The declared variant's required phases are not all completed.";

describe("TC-VERIFY-019 verify kind and row", () => {
  test("verify is a declared single-row kind with the exact C-8 fields", () => {
    expect(DOMAIN_KINDS).toContain("verify");
    const verify = entries.filter((entry) => entry.domainKind === "verify");
    expect(verify).toHaveLength(6);
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
    expect(verify[1]).toMatchObject({
      code: "verify.gates.failed",
      domainKind: "verify",
      category: "user",
      retryable: false,
      consequence: "not_landed",
      projectionClass: "user-validation",
      remediationHint:
        "Resolve the named failing gate evidence (lifecycle, CI, push parity, owner gate, or squash preflight) and re-run the gates.",
      summary: "One or more merge gates did not pass.",
    });
    expect(verify[2]).toMatchObject({
      code: "verify.gates.unavailable",
      domainKind: "verify",
      category: "platform",
      retryable: false,
      consequence: "not_landed",
      projectionClass: "platform-provider",
      remediationHint:
        "Restore access to the named gate-evidence source and re-run the gates; the gates were not fully evaluated.",
      summary: "Merge-gate evidence could not be read.",
    });
  });

  test("both gate identities classify exactly and the ledger row is unchanged", () => {
    expect(resolveAppErrorCode("verify.gates.failed").ok).toBe(true);
    expect(resolveAppErrorCode("verify.gates.unavailable").ok).toBe(true);
    expect(() => classifyDomainKind("verify", "verify.gates.unknown")).toThrow();
    const ledger = entries.find((entry) => entry.code === "verify.ledger.incomplete");
    expect(ledger?.projectionClass).toBe("user-validation");
    expect(ledger?.remediationHint).toBe(VERIFY_HINT);
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
    const declaredKinds =
      "`provider`, `input`, `config`, `state`, `lint`, `verify`, `db`, `closeout`, `plan`, `watchdog`, `commit`, `status`, `blockers`, `doctor`, `merge`, `harness`, `retro`, `spend`, `dispatch`, `queue`, and `daemon`";
    expect(doc).toContain(declaredKinds);
    expect(doc).toContain("`verify.ledger.incomplete`");
    expect(doc).toContain("`db.opencode.unavailable`");
  });

  test("existing kinds keep their rows and the provider, verify, and db additions are present", () => {
    expect(entries.filter((entry) => entry.domainKind === "provider")).toHaveLength(13);
    expect(entries.filter((entry) => entry.domainKind === "input")).toHaveLength(1);
    expect(entries.filter((entry) => entry.domainKind === "config")).toHaveLength(10);
    expect(entries.filter((entry) => entry.domainKind === "state")).toHaveLength(9);
    expect(entries.filter((entry) => entry.domainKind === "lint")).toHaveLength(6);
    expect(entries.filter((entry) => entry.domainKind === "db")).toHaveLength(4);
    expect(entries.filter((entry) => entry.domainKind === "watchdog")).toHaveLength(4);
    expect(entries.filter((entry) => entry.domainKind === "doctor")).toHaveLength(1);
    expect(entries.filter((entry) => entry.domainKind === "merge")).toHaveLength(7);
    expect(entries.filter((entry) => entry.domainKind === "blockers")).toHaveLength(4);
    expect(entries.filter((entry) => entry.domainKind === "spend")).toHaveLength(1);
    expect(entries.filter((entry) => entry.domainKind === "daemon")).toHaveLength(8);
    expect(entries.filter((entry) => entry.domainKind === "coordinator")).toHaveLength(6);
    expect(entries.filter((entry) => entry.domainKind === "dispatch")).toHaveLength(4);
    expect(entries).toHaveLength(121);
  });
});

const DB_ROWS = [
  [
    "db.opencode.unavailable",
    "platform",
    false,
    "not_landed",
    "Install or repair the opencode CLI so opencode db path resolves.",
    "platform-provider",
    "The opencode session database is unavailable.",
  ],
  [
    "db.query.failed",
    "platform",
    true,
    "not_landed",
    "Retry the failed query and verify the session store is readable.",
    "platform-provider",
    "A session database query failed.",
  ],
  [
    "db.delete.failed",
    "transient",
    true,
    "not_landed",
    "Retry the prune; failed rows remain and are selected again.",
    "platform-provider",
    "A session delete did not land.",
  ],
  [
    "db.reboot.live",
    "transient",
    true,
    "not_landed",
    "Wait until the live window is empty or stop the opencode host, then retry.",
    "platform-provider",
    "A live session is using the database.",
  ],
] as const;

describe("TC-DB-003 four db identities round-trip and contain", () => {
  test("db is a declared multi-row kind with exactly the four pinned rows", () => {
    expect(DOMAIN_KINDS).toContain("db");
    const db = entries.filter((entry) => entry.domainKind === "db");
    expect(db.map((entry) => entry.code)).toEqual(DB_ROWS.map(([code]) => code));
    for (const [
      code,
      category,
      retryable,
      consequence,
      hint,
      projectionClass,
      summary,
    ] of DB_ROWS) {
      expect(classifyDomainKind("db", code)).toMatchObject({
        code,
        domainKind: "db",
        category,
        retryable,
        consequence,
        projectionClass,
        remediationHint: hint,
        summary,
      });
      expect(resolveAppErrorCode(code)).toEqual({
        ok: true,
        entry: classifyDomainKind("db", code),
      });
      expect(classifyThrown({ kind: "db", code })).toEqual(classifyDomainKind("db", code));
      expect(classifyThrown({ kind: "db", code, summary: "UNTRUSTED-CANARY" })).toEqual(
        classifyDomainKind("db", code),
      );
    }
    expect(entries).toHaveLength(121);
    expect(db).toHaveLength(4);
  });

  test("kind-only db is ambiguous and contains; it never selects the first row", () => {
    expect(() => classifyDomainKind("db")).toThrow();
    expect(classifyThrown({ kind: "db" }).code).toBe(FALLBACK_INTERNAL_CODE);
    const firstRowClassifier = (kind: string) =>
      (ERROR_TABLE as readonly ErrorTableEntry[]).find((entry) => entry.domainKind === kind);
    expect(firstRowClassifier("db")?.code).toBe("db.opencode.unavailable");
  });

  test("wrong, unknown, missing, mismatched and non-string db codes contain", () => {
    for (const failure of [
      { kind: "db", code: "db.other.unknown" },
      { kind: "db", code: "state.store.torn" },
      { kind: "db" },
      { kind: "db", code: 42 },
      { kind: "db", code: null },
      { kind: "state", code: "db.query.failed" },
    ]) {
      expect(classifyThrown(failure).code).toBe(FALLBACK_INTERNAL_CODE);
    }
    expect(() => classifyDomainKind("db", "input.value.rejected")).toThrow();
  });

  test("the documented db rows agree exactly once and match every column", () => {
    const doc = readFileSync(join(ROOT, "doc/spec/features/feature-result-contract.md"), "utf8");
    for (const [
      code,
      category,
      retryable,
      consequence,
      hint,
      projectionClass,
      summary,
    ] of DB_ROWS) {
      const row = `| ${code} | db | ${category} | ${String(retryable)} | ${consequence} | ${hint} | ${projectionClass} | ${summary} |`;
      expect(doc.split(row).length - 1, code).toBe(1);
    }
  });
});

const CLOSEOUT_ROWS = [
  [
    "closeout.target.unobserved",
    "user",
    false,
    "not_landed",
    "Verify the work item ref; a provider not-found means the item does not exist. A payload/parse failure is `provider.payload.invalid`, and access or credential failures keep their own identities.",
    "user-validation",
    "The closeout target work item was not observed (provider not-found).",
  ],
  [
    "closeout.target.ambiguous",
    "user",
    false,
    "not_landed",
    "Disambiguate the delivery request or local branch for the work item, then retry.",
    "user-validation",
    "More than one closeout target matched.",
  ],
  [
    "closeout.write.failed",
    "transient",
    true,
    "unknown",
    "Inspect the failed operation evidence and retry; completed operations are persisted and idempotent.",
    "platform-provider",
    "A closeout provider write did not land.",
  ],
  [
    "closeout.branch.unsafe",
    "user",
    false,
    "not_landed",
    "Resolve the named checkout, worktree, protected-ref, or merged-head condition, then retry.",
    "user-validation",
    "Branch cleanup or checkout restore was refused for safety.",
  ],
  [
    "closeout.capsule-invalid",
    "user",
    false,
    "not_landed",
    "Repair the capsule damage named in the evidence (torn tail, duplicate key, sequence gap, post-close line, or candidate schema failure) and retry; closeout never repairs or truncates the capsule.",
    "user-validation",
    "The change capsule is damaged and no promotion write landed.",
  ],
] as const;

describe("TC-CLOSE-003 five closeout identities round-trip and contain", () => {
  test("closeout is a declared multi-row kind with exactly the five pinned rows", () => {
    expect(DOMAIN_KINDS).toContain("closeout");
    const closeout = entries.filter((entry) => entry.domainKind === "closeout");
    expect(closeout.map((entry) => entry.code)).toEqual(CLOSEOUT_ROWS.map(([code]) => code));
    for (const [
      code,
      category,
      retryable,
      consequence,
      hint,
      projectionClass,
      summary,
    ] of CLOSEOUT_ROWS) {
      expect(classifyDomainKind("closeout", code)).toMatchObject({
        code,
        domainKind: "closeout",
        category,
        retryable,
        consequence,
        projectionClass,
        remediationHint: hint,
        summary,
      });
      expect(resolveAppErrorCode(code)).toEqual({
        ok: true,
        entry: classifyDomainKind("closeout", code),
      });
      expect(classifyThrown({ kind: "closeout", code })).toEqual(
        classifyDomainKind("closeout", code),
      );
      expect(classifyThrown({ kind: "closeout", code, summary: "UNTRUSTED-CANARY" })).toEqual(
        classifyDomainKind("closeout", code),
      );
    }
    expect(closeout).toHaveLength(5);
  });

  test("kind-only closeout is ambiguous and contains; it never selects the first row", () => {
    expect(() => classifyDomainKind("closeout")).toThrow();
    expect(classifyThrown({ kind: "closeout" }).code).toBe(FALLBACK_INTERNAL_CODE);
    const firstRowClassifier = (kind: string) =>
      (ERROR_TABLE as readonly ErrorTableEntry[]).find((entry) => entry.domainKind === kind);
    expect(firstRowClassifier("closeout")?.code).toBe("closeout.target.unobserved");
  });

  test("wrong, unknown, missing, mismatched and non-string closeout codes contain", () => {
    for (const failure of [
      { kind: "closeout", code: "closeout.other.unknown" },
      { kind: "closeout", code: "state.store.torn" },
      { kind: "closeout" },
      { kind: "closeout", code: 42 },
      { kind: "closeout", code: null },
      { kind: "state", code: "closeout.write.failed" },
    ]) {
      expect(classifyThrown(failure).code).toBe(FALLBACK_INTERNAL_CODE);
    }
    expect(() => classifyDomainKind("closeout", "input.value.rejected")).toThrow();
  });

  test("the documented closeout rows agree exactly once and match every column", () => {
    const doc = readFileSync(join(ROOT, "doc/spec/features/feature-result-contract.md"), "utf8");
    for (const [
      code,
      category,
      retryable,
      consequence,
      hint,
      projectionClass,
      summary,
    ] of CLOSEOUT_ROWS) {
      const row = `| ${code} | closeout | ${category} | ${String(retryable)} | ${consequence} | ${hint} | ${projectionClass} | ${summary} |`;
      expect(doc.split(row).length - 1, code).toBe(1);
    }
  });
});

const WATCHDOG_ROWS = [
  [
    "watchdog.checkout-dirty",
    "user",
    false,
    "not_landed",
    "Commit or discard the named uncommitted changes, then re-run the lane preflight.",
    "user-validation",
    "The lane checkout is dirty.",
  ],
  [
    "watchdog.checkout-non-base",
    "user",
    false,
    "not_landed",
    "Check out the lane's declared base (or correct the declaration), then re-run the lane preflight.",
    "user-validation",
    "The lane checkout is not on its declared base.",
  ],
  [
    "watchdog.signals-absent",
    "platform",
    true,
    "not_landed",
    "Restore the declared progress-signal sources, then retry; without them the answer is unknown.",
    "platform-provider",
    "No liveness signal sources are available; the answer is unknown.",
  ],
  [
    "watchdog.liveness-stalled",
    "user",
    false,
    "not_landed",
    "Inspect the corroborated stall evidence, then apply the budget-governed restart response for the lane.",
    "user-validation",
    "The lane is stalled and fully corroborated by the declared progress signals.",
  ],
] as const;

describe("TC-WATCHDOG-003 the watchdog kind has exactly four rows and round-trips", () => {
  test("watchdog is a declared multi-row kind with exactly the four pinned identities", () => {
    expect(DOMAIN_KINDS).toContain("watchdog");
    const watchdog = entries.filter((entry) => entry.domainKind === "watchdog");
    expect(watchdog).toHaveLength(4);
    expect(watchdog.map((entry) => entry.code)).toEqual(WATCHDOG_ROWS.map(([code]) => code));
    for (const [
      code,
      category,
      retryable,
      consequence,
      hint,
      projectionClass,
      summary,
    ] of WATCHDOG_ROWS) {
      expect(classifyDomainKind("watchdog", code)).toMatchObject({
        code,
        domainKind: "watchdog",
        category,
        retryable,
        consequence,
        projectionClass,
        remediationHint: hint,
        summary,
      });
      expect(String(hint).length).toBeGreaterThan(0);
    }
    expect(entries).toHaveLength(121);
  });

  test("the two refusal rows project user-validation and signals-absent platform-provider", () => {
    expect(classifyDomainKind("watchdog", "watchdog.checkout-dirty").projectionClass).toBe(
      "user-validation",
    );
    expect(classifyDomainKind("watchdog", "watchdog.checkout-non-base").projectionClass).toBe(
      "user-validation",
    );
    expect(classifyDomainKind("watchdog", "watchdog.signals-absent").projectionClass).toBe(
      "platform-provider",
    );
    expect(classifyDomainKind("watchdog", "watchdog.liveness-stalled").projectionClass).toBe(
      "user-validation",
    );
  });

  test("watchdog codes round-trip exactly through returned and thrown classification", () => {
    for (const [code] of WATCHDOG_ROWS) {
      const row = classifyDomainKind("watchdog", code);
      expect(resolveAppErrorCode(code)).toEqual({ ok: true, entry: row });
      expect(classifyThrown({ kind: "watchdog", code })).toEqual(row);
      expect(classifyThrown({ kind: "watchdog", code, summary: "UNTRUSTED-CANARY" })).toEqual(row);
    }
  });

  test("kind-only watchdog is ambiguous and contains; a wrong code contains", () => {
    expect(() => classifyDomainKind("watchdog")).toThrow();
    expect(classifyThrown({ kind: "watchdog" }).code).toBe(FALLBACK_INTERNAL_CODE);
    expect(classifyThrown({ kind: "watchdog", code: "state.store.torn" }).code).toBe(
      FALLBACK_INTERNAL_CODE,
    );
    expect(() => classifyDomainKind("watchdog", "input.value.rejected")).toThrow();
  });

  test("the documented watchdog rows agree exactly once and match every column", () => {
    const doc = readFileSync(join(ROOT, "doc/spec/features/feature-result-contract.md"), "utf8");
    for (const [
      code,
      category,
      retryable,
      consequence,
      hint,
      projectionClass,
      summary,
    ] of WATCHDOG_ROWS) {
      const row = `| ${code} | watchdog | ${category} | ${String(retryable)} | ${consequence} | ${hint} | ${projectionClass} | ${summary} |`;
      expect(doc.split(row).length - 1, code).toBe(1);
    }
    expect(doc).toContain("`watchdog` kind carries exactly the four lane-safety identities");
  });

  test("pre-existing provider, input, config, state, lint, verify, db and closeout rows are unchanged", () => {
    expect(entries.filter((entry) => entry.domainKind === "provider")).toHaveLength(13);
    expect(entries.filter((entry) => entry.domainKind === "input")).toHaveLength(1);
    expect(entries.filter((entry) => entry.domainKind === "config")).toHaveLength(10);
    expect(entries.filter((entry) => entry.domainKind === "state")).toHaveLength(9);
    expect(entries.filter((entry) => entry.domainKind === "lint")).toHaveLength(6);
    expect(entries.filter((entry) => entry.domainKind === "verify")).toHaveLength(6);
    expect(entries.filter((entry) => entry.domainKind === "merge")).toHaveLength(7);
    expect(entries.filter((entry) => entry.domainKind === "db")).toHaveLength(4);
    expect(entries.filter((entry) => entry.domainKind === "closeout")).toHaveLength(5);
  });
});

const COMMIT_ROWS = [
  [
    "commit.staging-blocked-untracked",
    "user",
    false,
    "not_landed",
    "Stage or remove the pending material outside the declared scope, or expand the change scope, then retry the commit.",
    "user-validation",
    "Nothing stageable remains for the requested commit.",
  ],
  [
    "commit.commitlint-failed",
    "user",
    false,
    "not_landed",
    "Reconcile the repository commitlint configuration with the commit type table (or correct the message), then retry.",
    "user-validation",
    "Neither the generated message nor the deterministic template satisfied commitlint.",
  ],
  [
    "commit.safety.secret-suspected",
    "user",
    false,
    "not_landed",
    "Review the named finding class and path, remove or gitignore the suspected material, then retry; never blind-retry.",
    "user-validation",
    "The secret scan flagged candidate content or a filename on suspicion.",
  ],
  [
    "commit.safety.scan-unavailable",
    "platform",
    true,
    "not_landed",
    "Restore the deterministic safety scanner and retry; nothing was staged or committed.",
    "platform-provider",
    "The deterministic safety scan could not run.",
  ],
  [
    "commit.atomic-abort",
    "platform",
    true,
    "not_landed",
    "Retry the completion; the clean abort restored both the ledger and the commit to neither-landed, and a re-run converges.",
    "platform-provider",
    "The atomic phase completion aborted and restored both sides.",
  ],
] as const;

describe("TC-TABLE-005 the commit kind declares exactly five rows", () => {
  test("the commit kind carries the five pinned identities and classifications", () => {
    expect(DOMAIN_KINDS).toContain("commit");
    const commit = entries.filter((entry) => entry.domainKind === "commit");
    expect(commit.map((entry) => entry.code)).toEqual(COMMIT_ROWS.map(([code]) => code));
    for (const [
      code,
      category,
      retryable,
      consequence,
      hint,
      projectionClass,
      summary,
    ] of COMMIT_ROWS) {
      expect(classifyDomainKind("commit", code)).toMatchObject({
        code,
        domainKind: "commit",
        category,
        retryable,
        consequence,
        remediationHint: hint,
        projectionClass,
        summary,
      });
      expect(resolveAppErrorCode(code)).toEqual({
        ok: true,
        entry: classifyDomainKind("commit", code),
      });
      expect(classifyThrown({ kind: "commit", code })).toEqual(classifyDomainKind("commit", code));
      expect(String(hint).length).toBeGreaterThan(0);
    }
    expect(commit).toHaveLength(5);
    expect(entries.some((entry) => entry.code.includes("template-fallback"))).toBe(false);
  });

  test("kind-only commit is ambiguous and contains; wrong codes contain", () => {
    expect(() => classifyDomainKind("commit")).toThrow();
    expect(classifyThrown({ kind: "commit" }).code).toBe(FALLBACK_INTERNAL_CODE);
    expect(classifyThrown({ kind: "commit", code: "state.store.torn" }).code).toBe(
      FALLBACK_INTERNAL_CODE,
    );
    expect(() => classifyDomainKind("commit", "input.value.rejected")).toThrow();
  });

  test("the documented commit rows agree exactly once and match every column", () => {
    const doc = readFileSync(join(ROOT, "doc/spec/features/feature-result-contract.md"), "utf8");
    for (const [
      code,
      category,
      retryable,
      consequence,
      hint,
      projectionClass,
      summary,
    ] of COMMIT_ROWS) {
      const row = `| ${code} | commit | ${category} | ${String(retryable)} | ${consequence} | ${hint} | ${projectionClass} | ${summary} |`;
      expect(doc.split(row).length - 1, code).toBe(1);
    }
    expect(doc).toContain("`commit` kind carries exactly the five commit-primitive identities");
  });

  test("template fallback is success evidence, never a failure identity", () => {
    const doc = readFileSync(join(ROOT, "doc/spec/features/feature-result-contract.md"), "utf8");
    expect(doc).toContain("template fallback is success evidence");
    const commit = entries.filter((entry) => entry.domainKind === "commit");
    expect(commit.every((entry) => entry.category !== "success")).toBe(true);
  });
});

describe("TC-BRIEF-013 brief adds no error identity", () => {
  test("no brief code, no brief domain kind, and no undeclared status code exists", () => {
    expect(entries.some((entry) => entry.code.startsWith("brief."))).toBe(false);
    expect(
      entries.filter((entry) => entry.code.startsWith("status.")).map((entry) => entry.code),
    ).toEqual(
      BOARD_COLLECTOR_IDS.map(
        (id) => `${BOARD_COLLECTOR_ERROR_PREFIX}${id}${BOARD_COLLECTOR_ERROR_SUFFIX}`,
      ),
    );
    expect((DOMAIN_KINDS as readonly string[]).includes("brief")).toBe(false);
  });

  test("the brief source modules reference only existing identities", () => {
    const codes = new Set<string>(entries.map((entry) => entry.code));
    for (const file of [
      "packages/core/src/contracts/brief.ts",
      "packages/core/src/domain/brief.ts",
      "packages/cli/src/commands/brief.ts",
    ]) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text.includes("status.collector.")).toBe(false);
      for (const match of text.matchAll(/\b(?:brief|status)\.[a-z][a-z0-9_.]*/g)) {
        expect(codes.has(match[0]), match[0]).toBe(false);
      }
    }
  });
});

const BLOCKERS_ROWS = [
  "blockers.invalid-type",
  "blockers.unknown-id",
  "blockers.credential-value-rejected",
  "blockers.audience-mismatch",
] as const;

describe("TC-BLK-007 blockers family is closed, synced, and exit-1 projected", () => {
  test("exactly one blockers kind and exactly four rows", () => {
    expect(DOMAIN_KINDS.filter((kind) => kind === "blockers")).toHaveLength(1);
    const blockers = entries.filter((entry) => entry.domainKind === "blockers");
    expect(blockers).toHaveLength(4);
    expect(blockers.map((entry) => entry.code)).toEqual([...BLOCKERS_ROWS]);
    for (const entry of blockers) {
      expect(entry).toMatchObject({
        domainKind: "blockers",
        category: "user",
        retryable: false,
        consequence: "not_landed",
        projectionClass: "user-validation",
      });
      expect(entry.remediationHint.length).toBeGreaterThan(0);
      expect(entry.summary?.length ?? 0).toBeGreaterThan(0);
    }
  });

  test("every blockers code resolves and classifies; near-misses do not", () => {
    for (const code of BLOCKERS_ROWS) {
      const resolved = resolveAppErrorCode(code);
      expect(resolved.ok).toBe(true);
      if (resolved.ok) expect(resolved.entry.code).toBe(code);
      expect(classifyThrown({ kind: "blockers", code }).code).toBe(code);
      expect(isValidCode(code)).toBe(true);
    }
    for (const nearMiss of [
      "blockers.invalid_type",
      "blockers.unknown",
      "blocker.invalid-type",
      "blockers.extra-code",
    ]) {
      expect(isValidCode(nearMiss), nearMiss).toBe(false);
      expect(resolveAppErrorCode(nearMiss).ok, nearMiss).toBe(false);
    }
    expect(resolveAppErrorCode("blockers.invalid-type.extra").ok).toBe(false);
    expect(() => classifyDomainKind("blockers")).toThrow();
  });

  test("the documented table carries the four blockers rows exactly once", () => {
    const doc = readFileSync(join(ROOT, "doc/spec/features/feature-result-contract.md"), "utf8");
    for (const entry of entries.filter((candidate) => candidate.domainKind === "blockers")) {
      const row = `| ${entry.code} | blockers | ${entry.category} | ${String(entry.retryable)} | ${entry.consequence} | ${entry.remediationHint} | ${entry.projectionClass} | ${entry.summary ?? ""} |`;
      expect(doc.split(row).length - 1, entry.code).toBe(1);
    }
    expect(doc).toContain("The `blockers` kind carries exactly the four typed-question-channel");
  });

  test("the reserved allowlist is the four exact blockers codes, not a wildcard", () => {
    for (const code of BLOCKERS_ROWS) expect(RESERVED_TWO_SEGMENT_CODES.has(code)).toBe(true);
    const blockersReserved = [...RESERVED_TWO_SEGMENT_CODES].filter((code) =>
      code.startsWith("blockers."),
    );
    expect(blockersReserved.sort()).toEqual([...BLOCKERS_ROWS].sort());
    expect([...RESERVED_TWO_SEGMENT_CODES]).toHaveLength(38);
  });
});

describe("TC-DOCTOR-020 the doctor kind has exactly one row and leaves the table intact", () => {
  const DOCTOR_HINT = "Resolve each named failing check using its fix hint, then re-run doctor.";
  const DOCTOR_SUMMARY = "One or more wiring checks failed.";

  test("doctor is declared exactly once and carries exactly one row", () => {
    expect((DOMAIN_KINDS as readonly string[]).filter((kind) => kind === "doctor")).toHaveLength(1);
    const doctor = entries.filter((entry) => entry.domainKind === "doctor");
    expect(doctor).toHaveLength(1);
    expect(doctor[0]).toEqual({
      code: "doctor.check.failed",
      domainKind: "doctor",
      category: "user",
      retryable: false,
      consequence: "not_landed",
      remediationHint: DOCTOR_HINT,
      projectionClass: "user-validation",
      summary: DOCTOR_SUMMARY,
    });
  });

  test("the doctor row round-trips through returned and thrown classification", () => {
    const row = classifyDomainKind("doctor", "doctor.check.failed");
    expect(row.projectionClass).toBe("user-validation");
    expect(resolveAppErrorCode("doctor.check.failed")).toEqual({ ok: true, entry: row });
    expect(classifyThrown({ kind: "doctor", code: "doctor.check.failed" })).toEqual(row);
    expect(classifyThrown({ kind: "doctor", code: "doctor.check.failed", summary: "x" })).toEqual(
      row,
    );
    expect(() => classifyDomainKind("doctor", "state.store.torn")).toThrow();
    expect(() => classifyDomainKind("doctor", "doctor.check.repo.unreachable")).toThrow();
  });

  test("a check-level cause is never promoted to an error identity", () => {
    const codes = new Set<string>(entries.map((entry) => entry.code));
    for (const condition of [
      "doctor.check.repo.unreachable",
      "doctor.check.tracker.unreachable",
      "doctor.check.provider.unreachable",
      "doctor.check.state.unreachable",
      "doctor.check.ci.unreachable",
    ]) {
      expect(codes.has(condition)).toBe(false);
    }
  });

  test("the documented doctor row appears exactly once and matches column-for-column", () => {
    const doc = readFileSync(join(ROOT, "doc/spec/features/feature-result-contract.md"), "utf8");
    const row = `| doctor.check.failed | doctor | user | false | not_landed | ${DOCTOR_HINT} | user-validation | ${DOCTOR_SUMMARY} |`;
    expect(doc.split(row).length - 1).toBe(1);
    expect(doc).toContain(
      "`status`, `blockers`, `doctor`, `merge`, `harness`, `retro`, `dispatch`, `spend`, and `queue`",
    );
  });

  test("fallback remains the reserved two-segment namespace", () => {
    expect(FALLBACK_INTERNAL_CODE).toBe("fallback.internal");
    expect(FALLBACK_INVOCATION_CODE).toBe("fallback.invocation");
    expect(entries.filter((entry) => entry.domainKind === "fallback")).toHaveLength(2);
  });
});

const RETRO_ROWS = [
  [
    "retro.evidence.malformed-entry",
    "platform",
    false,
    "not_landed",
    "Inspect the named evidence position and repair or explicitly salvage the affected artifact, then re-run the retro command; valid entries were preserved.",
    "user-validation",
    "An evidence entry is malformed and was classified in band.",
  ],
  [
    "retro.evidence.tamper-flagged",
    "platform",
    false,
    "not_landed",
    "Inspect the named domain and record positions; do not trust altered evidence. Restore the unaltered artifact or record an explicit salvage before re-running.",
    "user-validation",
    "A keyed evidence chain failed verification.",
  ],
  [
    "retro.truth.vacuous-run",
    "user",
    false,
    "not_landed",
    "Verify the declared collector sources and their windows, then re-run retro collect; a collection that executes must produce collector records.",
    "user-validation",
    "A collection run executed and produced no collector records.",
  ],
  [
    "retro.evidence.denied",
    "platform",
    false,
    "not_landed",
    "Write evidence only through the collector seam; the sidecar is collector-owned and the attempted write did not land.",
    "platform-provider",
    "A write outside the collector seam was refused.",
  ],
] as const;

describe("TC-RETRO-004 four retro identities round-trip and contain", () => {
  test("retro is a declared multi-row kind with exactly the four pinned rows", () => {
    expect(DOMAIN_KINDS).toContain("retro");
    const retro = entries.filter((entry) => entry.domainKind === "retro");
    expect(retro).toHaveLength(4);
    expect(retro.map((entry) => entry.code)).toEqual(RETRO_ROWS.map(([code]) => code));
    for (const [
      code,
      category,
      retryable,
      consequence,
      hint,
      projectionClass,
      summary,
    ] of RETRO_ROWS) {
      expect(classifyDomainKind("retro", code)).toMatchObject({
        code,
        domainKind: "retro",
        category,
        retryable,
        consequence,
        projectionClass,
        remediationHint: hint,
        summary,
      });
      expect(resolveAppErrorCode(code)).toEqual({
        ok: true,
        entry: classifyDomainKind("retro", code),
      });
      expect(classifyThrown({ kind: "retro", code })).toEqual(classifyDomainKind("retro", code));
      expect(classifyThrown({ kind: "retro", code, summary: "UNTRUSTED-CANARY" })).toEqual(
        classifyDomainKind("retro", code),
      );
    }
    expect(retro.find((entry) => entry.code === "retro.evidence.denied")?.projectionClass).toBe(
      "platform-provider",
    );
  });

  test("kind-only retro is ambiguous and contains; wrong, unknown, missing and non-string codes contain", () => {
    expect(() => classifyDomainKind("retro")).toThrow();
    expect(classifyThrown({ kind: "retro" }).code).toBe(FALLBACK_INTERNAL_CODE);
    for (const failure of [
      { kind: "retro", code: "retro.other.unknown" },
      { kind: "retro", code: "state.store.torn" },
      { kind: "retro" },
      { kind: "retro", code: 42 },
      { kind: "retro", code: null },
      { kind: "state", code: "retro.evidence.denied" },
    ]) {
      expect(classifyThrown(failure).code).toBe(FALLBACK_INTERNAL_CODE);
    }
    expect(() => classifyDomainKind("retro", "input.value.rejected")).toThrow();
  });

  test("the documented retro rows agree exactly once and match every column", () => {
    const doc = readFileSync(join(ROOT, "doc/spec/features/feature-result-contract.md"), "utf8");
    for (const [
      code,
      category,
      retryable,
      consequence,
      hint,
      projectionClass,
      summary,
    ] of RETRO_ROWS) {
      const row = `| ${code} | retro | ${category} | ${String(retryable)} | ${consequence} | ${hint} | ${projectionClass} | ${summary} |`;
      expect(doc.split(row).length - 1, code).toBe(1);
    }
    expect(doc).toContain("`retro`");
  });

  test("store-level conditions still resolve through existing state rows and no fifth retro row exists", () => {
    expect(resolveAppErrorCode("state.store.torn").ok).toBe(true);
    expect(resolveAppErrorCode("state.keys.missing").ok).toBe(true);
    expect(resolveAppErrorCode("state.permission.denied").ok).toBe(true);
    expect(entries.filter((entry) => entry.domainKind === "retro")).toHaveLength(4);
    expect(entries.filter((entry) => entry.code.startsWith("retro."))).toHaveLength(4);
  });
});

const DISPATCH_ROWS = [
  [
    "dispatch.restart-budget-exceeded",
    "user",
    false,
    "not_landed",
    "Request a fresh restart budget through the coordinator or operator, then retry the resume.",
    "user-validation",
    "The delivery's restart budget is exhausted.",
  ],
  [
    "dispatch.resume-uneconomical",
    "user",
    false,
    "not_landed",
    "Change the harness capability to attach-and-continue, or re-evaluate and accept the prefill re-pay cost, then retry the resume.",
    "user-validation",
    "The resume path would re-pay prefill and is uneconomical.",
  ],
  [
    "dispatch.session.spawn-failed",
    "user",
    false,
    "not_landed",
    "Inspect the harness selection and execution environment, then retry the dispatch; no session was created and the attempt stays recorded.",
    "user-validation",
    "The harness or process failed before a session existed.",
  ],
  [
    "dispatch.state-unverified",
    "platform",
    false,
    "not_landed",
    "Repair the named unreadable ledger, tracker, artifact, or state read and re-run the dispatch; a verdict requires readable truth.",
    "platform-provider",
    "Dispatch truth could not be read, so no verdict was derived.",
  ],
] as const;

describe("TC-ECON-003 the dispatch kind carries the two economics rows plus the two dispatch rows (GH-239)", () => {
  test("dispatch is a declared kind with exactly the four pinned identities in order", () => {
    expect(DOMAIN_KINDS).toContain("dispatch");
    // GH-241 appends the coordinator kind after daemon; dispatch itself is unchanged.
    expect(DOMAIN_KINDS[DOMAIN_KINDS.length - 3]).toBe("dispatch");
    expect(DOMAIN_KINDS[DOMAIN_KINDS.length - 2]).toBe("daemon");
    expect(DOMAIN_KINDS[DOMAIN_KINDS.length - 1]).toBe("coordinator");
    const dispatch = entries.filter((entry) => entry.domainKind === "dispatch");
    expect(dispatch.map((entry) => entry.code)).toEqual(DISPATCH_ROWS.map(([code]) => code));
    for (const [
      code,
      category,
      retryable,
      consequence,
      hint,
      projectionClass,
      summary,
    ] of DISPATCH_ROWS) {
      expect(classifyDomainKind("dispatch", code)).toEqual({
        code,
        domainKind: "dispatch",
        category,
        retryable,
        consequence,
        remediationHint: hint,
        projectionClass,
        summary,
      });
      expect(String(hint).length).toBeGreaterThan(0);
    }
  });

  test("the dispatch economics and spawn-failure rows project user-validation and the state-unverified row projects platform-provider", () => {
    for (const [code, , , , , projectionClass] of DISPATCH_ROWS) {
      expect(classifyDomainKind("dispatch", code).projectionClass).toBe(projectionClass);
    }
    expect(classifyDomainKind("dispatch", "dispatch.state-unverified").projectionClass).toBe(
      "platform-provider",
    );
    expect(classifyDomainKind("watchdog", "watchdog.liveness-stalled").projectionClass).toBe(
      "user-validation",
    );
    const newCodes = [
      "dispatch.restart-budget-exceeded",
      "dispatch.resume-uneconomical",
      "dispatch.session.spawn-failed",
      "dispatch.state-unverified",
      "watchdog.liveness-stalled",
    ];
    for (const code of newCodes) {
      const resolved = resolveAppErrorCode(code);
      expect(resolved.ok).toBe(true);
      if (resolved.ok) {
        expect(resolved.entry.consequence).not.toBe("unknown");
      }
    }
    expect(resolveAppErrorCode("dispatch.session.spawn-failed")).toMatchObject({
      ok: true,
      entry: { projectionClass: "user-validation", category: "user" },
    });
    expect(resolveAppErrorCode("dispatch.state-unverified")).toMatchObject({
      ok: true,
      entry: { projectionClass: "platform-provider", category: "platform" },
    });
  });

  test("dispatch codes round-trip and contain invalid shapes", () => {
    for (const [code] of DISPATCH_ROWS) {
      const row = classifyDomainKind("dispatch", code);
      expect(resolveAppErrorCode(code)).toEqual({ ok: true, entry: row });
      expect(classifyThrown({ kind: "dispatch", code })).toEqual(row);
      expect(classifyThrown({ kind: "dispatch", code, summary: "UNTRUSTED-CANARY" })).toEqual(row);
    }
    expect(() => classifyDomainKind("dispatch")).toThrow();
    expect(classifyThrown({ kind: "dispatch" }).code).toBe(FALLBACK_INTERNAL_CODE);
    expect(classifyThrown({ kind: "dispatch", code: "state.store.torn" }).code).toBe(
      FALLBACK_INTERNAL_CODE,
    );
    expect(classifyThrown({ kind: "watchdog", code: "dispatch.resume-uneconomical" }).code).toBe(
      FALLBACK_INTERNAL_CODE,
    );
  });

  test("the documented dispatch rows agree exactly once and match every column", () => {
    const doc = readFileSync(join(ROOT, "doc/spec/features/feature-result-contract.md"), "utf8");
    for (const [
      code,
      category,
      retryable,
      consequence,
      hint,
      projectionClass,
      summary,
    ] of DISPATCH_ROWS) {
      const row = `| ${code} | dispatch | ${category} | ${String(retryable)} | ${consequence} | ${hint} | ${projectionClass} | ${summary} |`;
      expect(doc.split(row).length - 1, code).toBe(1);
    }
    expect(doc).toContain("`dispatch` kind carries exactly four identities");
  });

  test("the three economics additions land and the delivered rows stay byte-identical", () => {
    expect(entries).toHaveLength(121);
    expect(entries.filter((entry) => entry.domainKind === "dispatch")).toHaveLength(4);
    expect(entries.filter((entry) => entry.domainKind === "watchdog")).toHaveLength(4);
    // The delivered watchdog rows retain their exact declared columns.
    expect(entries.filter((entry) => entry.domainKind === "watchdog").slice(0, 3)).toEqual(
      WATCHDOG_ROWS.slice(0, 3).map(
        ([code, category, retryable, consequence, hint, projectionClass, summary]) => ({
          code,
          domainKind: "watchdog",
          category,
          retryable,
          consequence,
          remediationHint: hint,
          projectionClass,
          summary,
        }),
      ),
    );
    expect(ALLOWLIST.allowed.some((code) => code.startsWith("dispatch."))).toBe(false);
  });
});

describe("TC-CAP-053 closeout step family", () => {
  test("every effective twelve-step slot resolves and unknown or empty slots do not", async () => {
    const { resolveAppErrorCode } = await import("../../packages/cli/src/classify");
    const { CLOSEOUT_STEP_IDS } = await import("../../packages/core/src/contracts/index");
    for (const stepId of CLOSEOUT_STEP_IDS) {
      const resolved = resolveAppErrorCode(`closeout.step.${stepId}.failed`);
      expect(resolved.ok, stepId).toBe(true);
      if (resolved.ok) {
        expect(resolved.entry.domainKind).toBe("closeout");
        expect(resolved.entry.projectionClass).toBe("user-validation");
        expect(resolved.entry.consequence).toBe("not_landed");
        expect(resolved.entry.retryable).toBe(false);
        expect(resolved.entry.summary).toBe("A closeout step failed.");
      }
    }
    expect(resolveAppErrorCode("closeout.step.unknown-step.failed").ok).toBe(false);
    expect(resolveAppErrorCode("closeout.step..failed").ok).toBe(false);
    expect(resolveAppErrorCode("closeout.step.Capsule.failed").ok).toBe(false);
    expect(resolveAppErrorCode("closeout.step.capsule_failed").ok).toBe(false);
  });
});

const SPEND_HINT =
  "Capture harness telemetry (session-group and capture-outcome records) for the selected work item at closeout, then re-run spend.";
const SPEND_SUMMARY = "No captured harness telemetry exists for the selected work item.";

describe("TC-SPEND-009 one spend row, exit projection and table sync", () => {
  const spend = entries.filter((entry) => entry.domainKind === "spend");

  test("spend declares exactly one row with the pinned identity", () => {
    expect(DOMAIN_KINDS).toContain("spend");
    expect(spend).toHaveLength(1);
    expect(spend[0]).toEqual({
      code: "spend.telemetry-absent",
      domainKind: "spend",
      category: "user",
      retryable: false,
      consequence: "not_landed",
      remediationHint: SPEND_HINT,
      projectionClass: "user-validation",
      summary: SPEND_SUMMARY,
    });
    expect(spend[0]?.projectionClass).toBe("user-validation");
  });

  test("the row round-trips through returned and thrown classification", () => {
    const row = classifyDomainKind("spend", "spend.telemetry-absent");
    expect(resolveAppErrorCode("spend.telemetry-absent")).toEqual({ ok: true, entry: row });
    expect(classifyThrown({ kind: "spend", code: "spend.telemetry-absent" })).toEqual(row);
    expect(
      classifyThrown({ kind: "spend", code: "spend.telemetry-absent", summary: "GH-236" }),
    ).toEqual(row);
  });

  test("kind-only spend is exact-code only and contains; wrong codes contain", () => {
    expect(() => classifyDomainKind("spend")).toThrow();
    expect(classifyThrown({ kind: "spend" }).code).toBe(FALLBACK_INTERNAL_CODE);
    for (const failure of [
      { kind: "spend", code: "spend.other.unknown" },
      { kind: "spend", code: "state.store.torn" },
      { kind: "state", code: "spend.telemetry-absent" },
      { kind: "spend", code: 42 },
      { kind: "spend", code: null },
    ]) {
      expect(classifyThrown(failure).code).toBe(FALLBACK_INTERNAL_CODE);
    }
    expect(() => classifyDomainKind("spend", "input.value.rejected")).toThrow();
  });

  test("no delivered row is re-projected by the spend addition", () => {
    const delivered = entries.filter((entry) => entry.domainKind !== "spend");
    expect(delivered).toHaveLength(120);
    expect(entries.filter((entry) => entry.domainKind === "state")).toHaveLength(9);
    expect(entries.filter((entry) => entry.domainKind === "input")).toHaveLength(1);
    expect(resolveAppErrorCode("state.store.torn")).toEqual({
      ok: true,
      entry: classifyDomainKind("state", "state.store.torn"),
    });
    expect(classifyDomainKind("state", "state.store.torn").projectionClass).toBe(
      "platform-provider",
    );
    expect(classifyDomainKind("state", "state.permission.denied").projectionClass).toBe(
      "user-validation",
    );
  });

  test("the documented spend row agrees exactly once and matches every column", () => {
    const doc = readFileSync(join(ROOT, "doc/spec/features/feature-result-contract.md"), "utf8");
    const row = `| spend.telemetry-absent | spend | user | false | not_landed | ${SPEND_HINT} | user-validation | ${SPEND_SUMMARY} |`;
    expect(doc.split(row).length - 1).toBe(1);
    expect(doc).toContain("121 identities");
  });

  test("the documented table is complete in both directions", () => {
    const doc = readFileSync(join(ROOT, "doc/spec/features/feature-result-contract.md"), "utf8");
    for (const entry of spend) expect(doc).toContain(`| ${entry.code} |`);
    expect(doc.split("| spend.telemetry-absent |").length - 1).toBe(1);
  });
});

/**
 * TC-VOCAB-002 (GH-237): the `queue` kind declares exactly the five Appendix F
 * rows, each synced into the documented table, and the collector-id set grew by
 * exactly one id without touching the family shape.
 */
describe("TC-VOCAB-002 the queue kind declares exactly five rows", () => {
  const QUEUE_ROWS = [
    [
      "queue.dependency-cycle",
      "user",
      false,
      "Remove the named cycle-creating dependency edge (the existing path is named) and retry; nothing was appended.",
      "The dependency edge would close a directed cycle.",
    ],
    [
      "queue.lease-conflict",
      "transient",
      true,
      "Wait for the named holder to release the repository lease or for its heartbeat age to reach the lease TTL, then retry; the live lease was not taken over.",
      "The repository is leased by another holder.",
    ],
    [
      "queue.park-condition-stuck",
      "platform",
      false,
      "Inspect the named park whose condition cleared without recovery, restore the recovery append path, then retry; reads report the same identity as a report-only finding.",
      "A cleared park stayed active without a recovery record.",
    ],
    [
      "queue.entry.unobserved",
      "user",
      false,
      "Declare the named ref with `queue add` or correct the reference, then retry; no entry was fabricated.",
      "The requested queue entry does not exist.",
    ],
    [
      "queue.precondition.unmet",
      "user",
      false,
      "Resolve the named blocking precondition (readiness, active park, outranking action, or weight class) and retry; repository exclusivity is reported as a lease conflict, never this identity.",
      "A claim precondition was not met.",
    ],
  ] as const;

  test("the five rows carry their declared classification and round-trip", () => {
    expect(DOMAIN_KINDS).toContain("queue");
    const queue = entries.filter((entry) => entry.domainKind === "queue");
    expect(queue.map((entry) => entry.code)).toEqual(QUEUE_ROWS.map(([code]) => code));
    for (const [code, category, retryable, hint, summary] of QUEUE_ROWS) {
      expect(classifyDomainKind("queue", code)).toMatchObject({
        code,
        domainKind: "queue",
        category,
        retryable,
        consequence: "not_landed",
        projectionClass: "user-validation",
        remediationHint: hint,
        summary,
      });
      expect(resolveAppErrorCode(code)).toEqual({
        ok: true,
        entry: classifyDomainKind("queue", code),
      });
      expect(classifyThrown({ kind: "queue", code })).toEqual(classifyDomainKind("queue", code));
    }
    expect(() => classifyDomainKind("queue")).toThrow();
    expect(classifyThrown({ kind: "queue" }).code).toBe(FALLBACK_INTERNAL_CODE);
    expect(classifyThrown({ kind: "queue", code: "state.store.torn" }).code).toBe(
      FALLBACK_INTERNAL_CODE,
    );
  });

  test("the documented queue rows agree exactly once and match every column", () => {
    const doc = readFileSync(join(ROOT, "doc/spec/features/feature-result-contract.md"), "utf8");
    for (const [code, category, retryable, hint, summary] of QUEUE_ROWS) {
      const row = `| ${code} | queue | ${category} | ${String(retryable)} | not_landed | ${hint} | user-validation | ${summary} |`;
      expect(doc.split(row).length - 1, code).toBe(1);
    }
  });

  test("the collector-id set extends by exactly the lanes id", () => {
    expect([...BOARD_COLLECTOR_IDS]).toEqual(["tracker", "lanes"]);
    expect(
      entries.filter((entry) => entry.code.startsWith("status.")).map((entry) => entry.code),
    ).toEqual(
      BOARD_COLLECTOR_IDS.map(
        (id) => `${BOARD_COLLECTOR_ERROR_PREFIX}${id}${BOARD_COLLECTOR_ERROR_SUFFIX}`,
      ),
    );
  });
});

/**
 * TC-COORD-081 (GH-241): the `coordinator` kind declares exactly the six
 * Appendix F rows, the two two-segment identities join the exact reserved
 * allowlist, and a near-miss is still rejected.
 */
describe("TC-COORD-081 the coordinator kind declares exactly six rows", () => {
  const COORDINATOR_ROWS = [
    ["coordinator.already-running", "user", false, "not_landed", "platform-provider"],
    ["coordinator.restart-budget-exhausted", "user", false, "not_landed", "user-validation"],
    ["coordinator.process.capability-gap", "platform", false, "not_landed", "platform-provider"],
    ["coordinator.session.kill-failed", "platform", true, "unknown", "platform-provider"],
    ["coordinator.escalation.publish-failed", "platform", true, "unknown", "platform-provider"],
    ["coordinator.wake.delivery-failed", "platform", true, "unknown", "platform-provider"],
  ] as const;

  test("exactly six rows in order with their declared class fields", () => {
    expect(DOMAIN_KINDS.filter((kind) => kind === "coordinator")).toHaveLength(1);
    const coordinator = entries.filter((entry) => entry.domainKind === "coordinator");
    expect(coordinator.map((entry) => entry.code)).toEqual(COORDINATOR_ROWS.map(([code]) => code));
    for (const [code, category, retryable, consequence, projectionClass] of COORDINATOR_ROWS) {
      expect(classifyDomainKind("coordinator", code)).toEqual({
        code,
        domainKind: "coordinator",
        category,
        retryable,
        consequence,
        remediationHint: classifyDomainKind("coordinator", code).remediationHint,
        projectionClass,
        summary: classifyDomainKind("coordinator", code).summary,
      });
    }
  });

  test("exactly two codes are two-segment and the other four are three-segment", () => {
    const coordinator = entries
      .filter((entry) => entry.domainKind === "coordinator")
      .map((entry) => entry.code);
    const twoSegment = coordinator.filter((code) => code.split(".").length === 2);
    expect(twoSegment.sort()).toEqual([
      "coordinator.already-running",
      "coordinator.restart-budget-exhausted",
    ]);
    expect(coordinator.filter((code) => code.split(".").length > 2)).toHaveLength(4);
    for (const code of twoSegment) expect(RESERVED_TWO_SEGMENT_CODES.has(code)).toBe(true);
  });

  test("a coordinator near-miss is rejected and no wildcard is admitted", () => {
    expect(isValidCode("coordinator.already-running")).toBe(true);
    expect(isValidCode("coordinator.restart-budget-exhausted")).toBe(true);
    expect(isValidCode("coordinator.alreadyrunning")).toBe(false);
    expect(isValidCode("coordinator.unknown-code")).toBe(false);
    expect(() => classifyDomainKind("coordinator", "coordinator.unknown-code")).toThrow();
    expect(
      (ERROR_TABLE as readonly ErrorTableEntry[]).some((entry) => entry.code.includes("*")),
    ).toBe(false);
  });
});
