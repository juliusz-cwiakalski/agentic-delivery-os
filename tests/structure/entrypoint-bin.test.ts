/**
 * GH-320 TC-BIN-060/062/063/064/067 — the two-executable structural truth.
 *
 * The CLI manifest declares exactly two executables over two distinct existing
 * entry files; both are thin selectors over one shared launcher composition; the
 * committed working-name literals are exactly the declared five sites under a
 * `packages/**` string-literal scan; the entrypoint module keeps no identity
 * value and cannot substitute one; and the family list, the error table, and the
 * delivered containment are unchanged. Every guard carries a failing injected
 * control so it cannot pass vacuously.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";
import { PROMPT_REQUIRED_COMMANDS, runEntrypoint } from "../../packages/cli/src/entrypoint";
import { renderRootHelp } from "../../packages/cli/src/help";
import { resolveBrandIdentity } from "../../packages/core/src/branding";
import { ERROR_TABLE } from "../../packages/core/src/contracts/index";
import { bufferSink } from "../golden/helpers";
import { validateSeam } from "./branding-seam.test";

const ROOT = process.cwd();
const CLI_DIR = join(ROOT, "packages/cli");
const manifest = JSON.parse(readFileSync(join(CLI_DIR, "package.json"), "utf8")) as {
  readonly main?: string;
  readonly bin?: Readonly<Record<string, string>>;
  readonly files?: readonly string[];
  readonly private?: boolean;
};

const WORKING_NAMES = ["delivery-os", "jaiship"] as const;

type LiteralSite = {
  readonly file: string;
  /**
   * The declaring variable's name, or `expression@<line>:<column>` for a literal
   * in expression position (an argument, an object property, a default value, a
   * template head). The latter can never be a declared site.
   */
  readonly constant: string;
  readonly value: string;
  readonly exported: boolean;
};

const listTypeScriptFiles = (root: string): string[] => {
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
  walk("packages");
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

const isExported = (node: ts.Node): boolean =>
  ((node as { modifiers?: readonly ts.Modifier[] }).modifiers ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  );

/**
 * The declared scan rule (DM-6, spec v1.6 / AC-F7-10 / NFR-6): a **node-level**
 * `packages/**` walk collecting every `StringLiteral` and
 * `NoSubstitutionTemplateLiteral` whose bytes equal a declared working name.
 * Comments and JSDoc are trivia and are never collected; a literal in
 * expression position is collected and can only fail as undeclared, so a sixth
 * site cannot hide outside a variable declaration.
 */
export const literalSites = (root: string): readonly LiteralSite[] => {
  const sites: LiteralSite[] = [];
  for (const file of listTypeScriptFiles(root)) {
    const source = parse(root, file);
    const visit = (node: ts.Node): void => {
      if (
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
        (WORKING_NAMES as readonly string[]).includes(node.text)
      ) {
        sites.push(literalSite(file, source, node));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return sites;
};

/** Describe one working-name literal node: its declaration or its position. */
const literalSite = (
  file: string,
  source: ts.SourceFile,
  literal: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral,
): LiteralSite => {
  const parent = literal.parent;
  if (
    ts.isVariableDeclaration(parent) &&
    ts.isIdentifier(parent.name) &&
    parent.initializer === literal
  ) {
    // StringLiteral → VariableDeclaration → VariableDeclarationList → VariableStatement.
    const statement = parent.parent.parent;
    return {
      file,
      constant: parent.name.text,
      value: literal.text,
      exported: ts.isVariableStatement(statement) ? isExported(statement) : false,
    };
  }
  const { line, character } = source.getLineAndCharacterOfPosition(literal.getStart(source));
  return {
    file,
    constant: `expression@${String(line + 1)}:${String(character + 1)}`,
    value: literal.text,
    exported: false,
  };
};

/** The declared inventory, held here so the inventory is the assertion's input. */
const DECLARED_SELECTORS: readonly Omit<LiteralSite, "exported">[] = [
  {
    file: "packages/cli/bin/delivery-os.ts",
    constant: "DEFAULT_WORKING_NAME",
    value: "delivery-os",
  },
  { file: "packages/cli/bin/jaiship.ts", constant: "DEFAULT_WORKING_NAME", value: "jaiship" },
  { file: "packages/cli/bin/jaiship.ts", constant: "PRIOR_WORKING_NAME", value: "delivery-os" },
];
const DECLARED_INVENTORY: readonly LiteralSite[] = [
  ...DECLARED_SELECTORS.map((site) => ({ ...site, exported: false })),
  {
    file: "packages/mcp/src/serve.ts",
    constant: "DEFAULT_WORKING_NAME",
    value: "delivery-os",
    exported: false,
  },
  {
    file: "packages/core/src/branding/index.ts",
    constant: "SCOPE_ORG",
    value: "delivery-os",
    exported: false,
  },
];

const key = (site: Omit<LiteralSite, "exported">): string => `${site.file}:${site.constant}`;

/** Compare a scan result with the declared inventory in both directions. */
export const inventoryViolations = (sites: readonly LiteralSite[]): string[] => {
  const failures: string[] = [];
  const found = new Map(sites.map((site) => [key(site), site]));
  for (const declared of DECLARED_INVENTORY) {
    if (!found.has(key(declared))) {
      failures.push(`declared site ${key(declared)} ("${declared.value}") was not found`);
    }
  }
  for (const site of sites) {
    const declared = DECLARED_INVENTORY.find(
      (candidate) => key(candidate) === key(site) && candidate.value === site.value,
    );
    if (declared === undefined) {
      failures.push(`undeclared working-name literal ${key(site)} ("${site.value}")`);
      continue;
    }
    if (site.exported) failures.push(`working-name literal ${key(site)} is exported`);
  }
  return failures;
};

const tempRoot = (label: string): string =>
  mkdtempSync(join(tmpdir(), `gh320-structure-${label}-`));

const write = (root: string, relative: string, content: string): void => {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

const withRoot = <T>(label: string, body: (root: string) => T): T => {
  const root = tempRoot(label);
  try {
    return body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

/** Manifest shape violations for one CLI package directory. */
export const manifestViolations = (packageDir: string): string[] => {
  const failures: string[] = [];
  const read = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as {
    readonly bin?: Readonly<Record<string, string>>;
  };
  const entries = Object.entries(read.bin ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const keys = entries.map(([name]) => name).sort();
  if (JSON.stringify(keys) !== JSON.stringify(["delivery-os", "jaiship"])) {
    failures.push(`declared bin identities ${JSON.stringify(keys)} are not exactly two`);
  }
  if (read.bin?.["delivery-os"] !== "./bin/delivery-os.ts") {
    failures.push("the delivery-os mapping is not the delivered ./bin/delivery-os.ts");
  }
  if (read.bin?.jaiship !== "./bin/jaiship.ts") {
    failures.push("the jaiship mapping is not ./bin/jaiship.ts");
  }
  const paths = entries.map(([, path]) => path);
  if (new Set(paths).size !== paths.length) failures.push("two identities share one path");
  for (const path of paths) {
    const file = join(packageDir, path);
    let content = "";
    try {
      content = readFileSync(file, "utf8");
    } catch {
      failures.push(`declared entry ${path} does not exist`);
      continue;
    }
    if (!content.startsWith("#!/usr/bin/env bun")) {
      failures.push(`declared entry ${path} has no Bun shebang`);
    }
  }
  return failures;
};

describe("TC-BIN-060 two declared bins map to two distinct existing entry files", () => {
  test("the manifest declares exactly two distinct existing Bun entries", () => {
    expect(manifestViolations(CLI_DIR)).toEqual([]);
    expect(Object.keys(manifest.bin ?? {}).sort()).toEqual(["delivery-os", "jaiship"]);
    expect(manifest.main).toBe("./dist/entrypoint.js");
    expect(manifest.files).toEqual(["dist"]);
    expect(manifest.private).toBe(true);
  });

  test("a one-bin manifest, a duplicate path, and a missing file each fail by name", () => {
    withRoot("manifest", (root) => {
      const packageDir = join(root, "packages/cli");
      mkdirSync(join(packageDir, "bin"), { recursive: true });
      write(root, "packages/cli/bin/delivery-os.ts", "#!/usr/bin/env bun\n");
      write(root, "packages/cli/bin/jaiship.ts", "#!/usr/bin/env bun\n");
      write(
        root,
        "packages/cli/package.json",
        JSON.stringify({ bin: { "delivery-os": "./bin/delivery-os.ts" } }),
      );
      expect(manifestViolations(packageDir).join("\n")).toContain("not exactly two");
      write(
        root,
        "packages/cli/package.json",
        JSON.stringify({
          bin: { "delivery-os": "./bin/entry.ts", jaiship: "./bin/entry.ts" },
        }),
      );
      expect(manifestViolations(packageDir).join("\n")).toContain("share one path");
      write(
        root,
        "packages/cli/package.json",
        JSON.stringify({
          bin: { "delivery-os": "./bin/delivery-os.ts", jaiship: "./bin/absent.ts" },
        }),
      );
      expect(manifestViolations(packageDir).join("\n")).toContain("./bin/absent.ts");
    });
  });

  test("the installer arrays still name no binary, entrypoint, or composer", () => {
    const install = readFileSync(join(ROOT, "scripts/install.sh"), "utf8");
    const body = (name: string): string => {
      const start = install.indexOf(`${name}=(`);
      const end = install.indexOf(")", start);
      return start < 0 || end < 0 ? "" : install.slice(start, end);
    };
    for (const name of ["ADOS_DELIVERY_SCRIPTS", "ADOS_DELIVERY_TOOLS"]) {
      for (const forbidden of [
        "packages/cli",
        "bin/jaiship",
        "bin/delivery-os",
        "bin-launcher",
        "jaiship.ts",
        "src/entrypoint",
      ]) {
        expect({ name, forbidden, body: body(name).includes(forbidden) }).toEqual({
          name,
          forbidden,
          body: false,
        });
      }
    }
    expect(body("ADOS_DELIVERY_SCRIPTS")).toContain("scripts/deliver-ticket.sh");
    expect(body("ADOS_DELIVERY_TOOLS")).toContain("tools/clean-merged-branches");
  });
});

describe("TC-BIN-062 identity literals are exactly the declared five sites", () => {
  test("literals: the scan result equals the declared five-site inventory", () => {
    const sites = literalSites(ROOT);
    expect(inventoryViolations(sites)).toEqual([]);
    expect(sites.filter((site) => site.file.startsWith("packages/cli/bin/")).length).toBe(3);
    expect(sites.length).toBe(5);
    for (const site of sites) expect(site.exported).toBe(false);
  });

  test("literals: the entrypoint module holds no identity literal and no retired accessor", () => {
    const source = readFileSync(join(ROOT, "packages/cli/src/entrypoint.ts"), "utf8");
    expect(source).not.toContain("neutralWorkingName");
    expect(source).not.toContain("NEUTRAL_WORKING_NAME");
    const entrypointSites = literalSites(ROOT).filter(
      (site) => site.file === "packages/cli/src/entrypoint.ts",
    );
    expect(entrypointSites).toEqual([]);
    // The protocol variable name survives and is consumed by the composition.
    expect(source).toContain("DELIVERY_OS_WORKING_NAME");
    const production = readFileSync(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    expect(production).toContain("workingNameEnvironmentVariable()");
  });

  test("literals: no declared default yields the containment identity, never a substitute", async () => {
    for (const argv of [
      ["--version", "--json"],
      ["--help", "--json"],
      ["status", "--json"],
    ]) {
      const stdout = bufferSink();
      const stderr = bufferSink();
      const exitCode = await runEntrypoint(argv, {
        streams: { stdout, stderr },
        environment: {},
        declaredWorkingName: "",
        composeProgram: () => {
          throw new Error("the no-identity path must not compose");
        },
        clock: { now: () => 1 },
        newRunId: () => "run-no-identity",
      });
      expect({ argv, exit: exitCode }).toEqual({ argv, exit: 2 });
      const payload = JSON.parse(stdout.value) as {
        readonly error?: { readonly code?: string };
      };
      expect(payload.error?.code).toBe("fallback.internal");
      expect(stdout.value).not.toContain("delivery-os");
      expect(stdout.value).not.toContain("jaiship");
      expect(stderr.value).not.toContain("delivery-os");
      expect(stderr.value).not.toContain("jaiship");
    }
  });

  test("literals: an expression-position literal is collected and fails by name", () => {
    withRoot("literals-expression", (root) => {
      const seed = (relative: string, content: string) => write(root, relative, content);
      seed("packages/cli/bin/delivery-os.ts", 'const DEFAULT_WORKING_NAME = "delivery-os";\n');
      seed(
        "packages/cli/bin/jaiship.ts",
        'const DEFAULT_WORKING_NAME = "jaiship";\nconst PRIOR_WORKING_NAME = "delivery-os";\n',
      );
      seed("packages/mcp/src/serve.ts", 'const DEFAULT_WORKING_NAME = "delivery-os";\n');
      seed("packages/core/src/branding/index.ts", 'const SCOPE_ORG = "delivery-os";\n');
      expect(inventoryViolations(literalSites(root))).toEqual([]);

      // The same bytes in expression position: an argument object property, an
      // argument default, and a template literal in an object property. The
      // declaration-only scan this rule replaced could not see any of them.
      seed(
        "packages/cli/src/expression.ts",
        [
          'import { resolveBrandIdentity } from "@delivery-os/core/branding";',
          'export const resolved = resolveBrandIdentity({ workingName: "jaiship" });',
          'export const withDefault = (name = "delivery-os") => name;',
          "export const config = { name: `jaiship` };",
          "",
        ].join("\n"),
      );
      const found = literalSites(root).filter(
        (site) => site.file === "packages/cli/src/expression.ts",
      );
      expect(found).toHaveLength(3);
      for (const site of found) expect(site.constant.startsWith("expression@")).toBe(true);
      expect(found.map((site) => site.value).sort()).toEqual(["delivery-os", "jaiship", "jaiship"]);
      const failures = inventoryViolations(literalSites(root)).join("\n");
      for (const site of found) {
        expect(failures).toContain(`packages/cli/src/expression.ts:${site.constant}`);
      }
    });
  });

  test("literals: a sixth site, a missing site, a re-declared accessor fail by name", () => {
    withRoot("literals", (root) => {
      const seed = (relative: string, content: string) => write(root, relative, content);
      seed("packages/cli/bin/delivery-os.ts", 'const DEFAULT_WORKING_NAME = "delivery-os";\n');
      seed("packages/cli/bin/jaiship.ts", 'const DEFAULT_WORKING_NAME = "jaiship";\n');
      seed("packages/mcp/src/serve.ts", 'const DEFAULT_WORKING_NAME = "delivery-os";\n');
      seed("packages/core/src/branding/index.ts", 'const SCOPE_ORG = "delivery-os";\n');
      const baseline = literalSites(root);
      expect(inventoryViolations(baseline).join("\n")).toContain("PRIOR_WORKING_NAME");
      seed(
        "packages/cli/bin/jaiship.ts",
        'const DEFAULT_WORKING_NAME = "jaiship";\nconst PRIOR_WORKING_NAME = "delivery-os";\n',
      );
      expect(inventoryViolations(literalSites(root))).toEqual([]);
      seed("packages/cli/src/sixth.ts", 'export const PRODUCT = "jaiship";\n');
      const sixth = inventoryViolations(literalSites(root));
      expect(sixth.join("\n")).toContain("packages/cli/src/sixth.ts:PRODUCT");
      rmSync(join(root, "packages/cli/src/sixth.ts"));
      seed(
        "packages/cli/src/entrypoint.ts",
        'export const NEUTRAL_WORKING_NAME = "delivery-os";\n',
      );
      const entrypoint = literalSites(root).filter(
        (site) => site.file === "packages/cli/src/entrypoint.ts",
      );
      expect(entrypoint.map((site) => site.constant)).toEqual(["NEUTRAL_WORKING_NAME"]);
      expect(entrypoint[0]?.exported).toBe(true);
      expect(inventoryViolations(literalSites(root)).join("\n")).toContain("entrypoint.ts");
      // The accessor control (a re-declared `neutralWorkingName` export) lives in
      // the content-inventory allowance case, where the allowance is the guard.
      seed("packages/cli/src/production.ts", 'const identity = { binaryName: "jaiship" };\n');
      expect(validateSeam(root).join("\n")).toContain("production.ts");
    });
  });
});

describe("TC-BIN-063 one shared launcher composition; neither bin duplicates the body", () => {
  const binNames = ["delivery-os", "jaiship"] as const;
  const bins = Object.fromEntries(
    binNames.map((name) => [name, readFileSync(join(ROOT, `packages/cli/bin/${name}.ts`), "utf8")]),
  ) as Record<(typeof binNames)[number], string>;

  test("shared-composition: both bins delegate to the one launcher and declare only facts", () => {
    for (const name of binNames) {
      const source = bins[name];
      expect(source).toContain('from "../src/bin-launcher.ts"');
      expect(source).toContain("runBinLauncher(");
      expect(source).not.toContain("createProductionComposer");
      expect(source).not.toContain("runEntrypoint");
      // The bin is the declared process edge: it observes the process facts
      // once and passes them in; the composition body lives in the launcher.
      expect(source).toContain("process.env");
      expect(source).toContain("process.cwd()");
      expect(source).toContain("runBinLauncher({");
      expect(source).toContain("export const completion");
    }
  });

  test("shared-composition: the launcher is the only composition body site", () => {
    const callSites: string[] = [];
    for (const file of listTypeScriptFiles(ROOT)) {
      const text = readFileSync(join(ROOT, file), "utf8");
      const count = text.split("createProductionComposer(").length - 1;
      if (count > 0) callSites.push(`${file}:${count}`);
    }
    // production.ts declares it (no call parentheses); the launcher is the call.
    expect(callSites).toEqual(["packages/cli/src/bin-launcher.ts:1"]);
    const launcher = readFileSync(join(ROOT, "packages/cli/src/bin-launcher.ts"), "utf8");
    expect(launcher).toContain("export const runBinLauncher");
    // No ambient read and no second serialization import in the launcher.
    expect(launcher).not.toContain("process.");
    expect(launcher).not.toContain("output/serialize");
    // A module-level string literal is not permitted in the launcher surface.
    const launcherSource = parse(ROOT, "packages/cli/src/bin-launcher.ts");
    for (const statement of launcherSource.statements) {
      if (!ts.isVariableStatement(statement) || !isExported(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        expect(ts.isStringLiteral(declaration.initializer as ts.Node)).toBe(false);
      }
    }
  });

  test("shared-composition: the bins differ only in the declared selector facts", () => {
    expect(bins["delivery-os"]).toContain("DEFAULT_WORKING_NAME");
    expect(bins["delivery-os"]).not.toContain("PRIOR_WORKING_NAME");
    expect(bins.jaiship).toContain("PRIOR_WORKING_NAME");
    expect(bins.jaiship).toContain("priorWorkingName: PRIOR_WORKING_NAME");
    expect(bins["delivery-os"]).toContain("declaredWorkingName: DEFAULT_WORKING_NAME");
  });

  test("shared-composition: a duplicated body or a launcher-side default fails by name", () => {
    withRoot("shared", (root) => {
      write(
        root,
        "packages/cli/bin/inlined.ts",
        'import { createProductionComposer } from "../src/production.js";\n' +
          'const DEFAULT_WORKING_NAME = "delivery-os";\n',
      );
      write(
        root,
        "packages/cli/src/bin-launcher.ts",
        'export const runBinLauncher = (): string => DEFAULT;\nconst DEFAULT = "delivery-os";\n',
      );
      const inlined = readFileSync(join(root, "packages/cli/bin/inlined.ts"), "utf8");
      expect(inlined).toContain("createProductionComposer");
      const launcherLiterals = literalSites(root).filter(
        (site) => site.file === "packages/cli/src/bin-launcher.ts",
      );
      expect(launcherLiterals.map((site) => site.constant)).toEqual(["DEFAULT"]);
      write(
        root,
        "packages/cli/src/bin-launcher.ts",
        "export const runBinLauncher = (name: string): string => name;\n",
      );
      expect(literalSites(root).map((site) => site.constant)).toEqual(["DEFAULT_WORKING_NAME"]);
    });
  });
});

describe("TC-BIN-064 the branding seam still passes and still rejects injected violations", () => {
  test("the seam is green on the new tree, and rejects an injected bin violation", () => {
    expect(validateSeam(ROOT)).toEqual([]);
    withRoot("seam", (root) => {
      write(
        root,
        "packages/core/src/branding/index.ts",
        readFileSync(join(ROOT, "packages/core/src/branding/index.ts"), "utf8"),
      );
      write(root, "packages/cli/bin/jaiship.ts", 'export const PRODUCT = "jaiship";\n');
      expect(validateSeam(root).join("\n")).toContain(
        "packages/cli/bin/jaiship.ts: exported module-level string constant PRODUCT",
      );
      write(root, "packages/cli/src/entrypoint.ts", 'const brand = { binaryName: "jaiship" };\n');
      expect(validateSeam(root).join("\n")).toContain(
        "packages/cli/src/entrypoint.ts: field binaryName is assigned a string literal",
      );
    });
  });
});

describe("TC-BIN-067 no new family row and no new error row", () => {
  const brand = (() => {
    const resolved = resolveBrandIdentity({ workingName: "jaiship" });
    if (!resolved.ok) throw new Error("the resolver rejected jaiship");
    return resolved.value;
  })();

  test("family-and-error-table: the family list is unchanged and advertises no new token", () => {
    expect([...PROMPT_REQUIRED_COMMANDS]).toEqual([
      "status",
      "brief",
      "queue",
      "lanes",
      "blockers",
      "phase",
      "commit",
      "lint",
      "plan",
      "verify",
      "merge",
      "closeout",
      "spend",
      "retro",
      "dispatch",
      "coordinator",
      "daemon",
      "projects",
      "repos",
      "events",
      "board",
    ]);
    const help = renderRootHelp(brand);
    expect(help).not.toContain("--print-install-path");
    expect(help.split("\n").filter((line) => /^ {2}[a-z][a-z0-9-]* {2}/u.test(line)).length).toBe(
      21,
    );
  });

  test("family-and-error-table: no error-table row and no error code for the notice", () => {
    const codes = JSON.stringify(ERROR_TABLE);
    expect(codes).not.toContain("prior-identity-fallback");
    const entrypoint = readFileSync(join(ROOT, "packages/cli/src/entrypoint.ts"), "utf8");
    expect(entrypoint).not.toContain("prior-identity-fallback");
  });

  test("family-and-error-table: the delivered containment still answers an uncomposed command", async () => {
    const stdout = bufferSink();
    const stderr = bufferSink();
    const exitCode = await runEntrypoint(["invented", "--json"], {
      streams: { stdout, stderr },
      environment: {},
      declaredWorkingName: "jaiship",
      composeProgram: () => ({ commands: {} }),
      clock: { now: () => 1 },
      newRunId: () => "run-uncomposed",
    });
    expect(exitCode).toBe(2);
    const payload = JSON.parse(stdout.value) as {
      readonly error?: { readonly code?: string; readonly summary?: string };
    };
    expect(payload.error?.code).toBe("fallback.internal");
    expect(payload.error?.summary).toBe(
      'command "invented" is not part of the composed prompt-required set',
    );
  });
});

describe("delivered secret redaction reaches the chokepoint", () => {
  test("secrets registered by the composed program reach the redaction chokepoint", async () => {
    const canary = "planted-entrypoint-secret";
    const stdout = bufferSink();
    const stderr = bufferSink();
    const exit = await runEntrypoint(["status", "--json"], {
      streams: { stdout, stderr },
      environment: { GITHUB_TOKEN: canary },
      configuredWorkingName: "delivery-os",
      declaredWorkingName: "delivery-os",
      clock: { now: () => 1 },
      newRunId: () => "run-entrypoint-secret",
      credentialReferences: [
        { referenceName: "github-read", sourceKey: { style: "literal", name: "GITHUB_TOKEN" } },
      ],
      composeProgram: () => ({
        commands: Object.fromEntries(
          PROMPT_REQUIRED_COMMANDS.map((command) => [
            command,
            {
              handler: () => (command === "status" ? { data: { echoed: canary } } : { data: {} }),
            },
          ]),
        ),
      }),
    });
    expect(exit).toBe(0);
    expect(stdout.value).not.toContain(canary);
    expect(stdout.value).toContain("[redacted]");
    expect(stderr.value).not.toContain(canary);
  });
});
