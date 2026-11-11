/**
 * GH-288 TC-PROJ-020 (and the structural halves of TC-PROJ-023/024) — exactly one
 * state-scope policy, consumed by every surface.
 *
 * The scan is AST-based, so comments, strings, and documentation examples cannot
 * trip it and a legitimate rename never needs a line-number edit. The single
 * home-plus-brand composition, the single `_STATE_DIR` read, and the single
 * settings call site are each pinned by name, and two seeded negative controls
 * prove the scan detects a re-derived path.
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { resolveHostStateRoot } from "../../packages/core/src/app/state-scope";

const ROOT = process.cwd();
const PACKAGES = ["core", "adapters", "cli", "mcp", "opencode", "testkit"] as const;
const POLICY = "packages/core/src/app/state-scope.ts";
const SETTINGS_SITE = "packages/cli/src/daemon-compose.ts";
const SHELL_FALLBACK = "scripts/lib/dispatch-authority.sh";

/**
 * The files that consume the state-scope policy (GH-288 F-6). Four files hold
 * every consumer: the CLI production composition (which composes the store, the
 * dispatch state root, the retro sidecar, the coordinator state directory and
 * the owner-hold read), the MCP serve composition, the runtime-aware edge's
 * audit store, and the daemon settings composing site. Adding a surface that
 * derives a state path requires editing this list, which is the anti-recurrence
 * intent; the whole-tree AST scan below is the guard that no re-derived path or
 * duplicate override read appears anywhere in `packages/**`.
 */
const STATE_CONSUMERS = [
  "packages/cli/src/production.ts",
  "packages/mcp/src/serve.ts",
  "packages/cli/src/edge.ts",
  SETTINGS_SITE,
] as const;

type Site = { readonly file: string; readonly line: number; readonly detail: string };

const listSources = (): string[] => {
  const results: string[] = [];
  const walk = (relativeDir: string): void => {
    for (const entry of readdirSync(join(ROOT, relativeDir), { withFileTypes: true })) {
      const next = `${relativeDir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules") continue;
        walk(next);
        continue;
      }
      if (entry.name.endsWith(".ts")) results.push(next);
    }
  };
  for (const pkg of PACKAGES) walk(`packages/${pkg}/src`);
  return results.sort();
};

const parse = (file: string): ts.SourceFile =>
  ts.createSourceFile(
    file,
    readFileSync(join(ROOT, file), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

/**
 * A home-plus-brand derivation: any expression whose text composes
 * `stateDirectoryName` with a home/environment-derived operand.
 */
export const homeBrandSites = (files: readonly string[], root = ROOT): Site[] => {
  const sites: Site[] = [];
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(join(root, file), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node): void => {
      const isTemplate = ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node);
      const isPlus =
        ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken;
      if (isTemplate || isPlus) {
        const text = node.getText(source);
        // A composition, not a bare reference: a template with a substitution or
        // a concatenation that joins the brand name to another path operand.
        const composes =
          (ts.isTemplateExpression(node) && node.templateSpans.length > 0) ||
          ts.isBinaryExpression(node);
        if (composes && text.includes("stateDirectoryName")) {
          sites.push({
            file,
            line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
            detail: text.replace(/\s+/gu, " ").slice(0, 120),
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return sites;
};

/** Every read of the brand-derived `<PREFIX>_STATE_DIR` override. */
export const overrideSites = (files: readonly string[], root = ROOT): Site[] => {
  const sites: Site[] = [];
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(join(root, file), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node): void => {
      const text = node.getText(source);
      if (!text.includes("_STATE_DIR")) return;
      // Report the leaf-most node, so one read is one site and two reads are two.
      let childHasIt = false;
      ts.forEachChild(node, (child) => {
        if (child.getText(source).includes("_STATE_DIR")) childHasIt = true;
      });
      if (!childHasIt) {
        sites.push({
          file,
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          detail: text.replace(/\s+/gu, " ").slice(0, 120),
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return sites;
};

const countCallSites = (files: readonly string[], callee: string): Site[] => {
  const sites: Site[] = [];
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(join(ROOT, file), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && node.expression.getText(source) === callee) {
        sites.push({
          file,
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          detail: node.getText(source).replace(/\s+/gu, " ").slice(0, 160),
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return sites;
};

describe("TC-PROJ-020 exactly one state-scope policy", () => {
  it("the only home-plus-brand composition site is the app-tier policy", () => {
    const sites = homeBrandSites(listSources());
    expect(sites.map((site) => site.file)).toEqual([POLICY]);
  });

  it("the override suffix and its precedence exist in exactly one place", () => {
    const sites = overrideSites(listSources());
    expect(sites.map((site) => site.file)).toEqual([POLICY]);
  });

  it("the policy is exported from the existing root entry and declares no new subpath", () => {
    const rootEntry = readFileSync(join(ROOT, "packages/core/src/index.ts"), "utf8");
    expect(rootEntry).toContain("resolveHostStateRoot");
    expect(rootEntry).toContain("resolveProjectScope");
    expect(rootEntry).toContain("stateScopeRoots");
    const manifest = JSON.parse(readFileSync(join(ROOT, "packages/core/package.json"), "utf8")) as {
      exports: Record<string, unknown>;
    };
    expect(Object.keys(manifest.exports).sort()).toEqual(
      [".", "./contracts", "./state", "./branding", "./provider"].sort(),
    );
    for (const pkg of ["cli", "mcp"]) {
      const consumer = JSON.parse(
        readFileSync(join(ROOT, `packages/${pkg}/package.json`), "utf8"),
      ) as { workspaceImports?: Record<string, string[]> };
      expect(consumer.workspaceImports?.["@delivery-os/core"] ?? []).toContain(".");
    }
  });

  it("every declared consumer consumes the policy and none composes a state path inline", () => {
    const failures: string[] = [];
    for (const consumer of STATE_CONSUMERS) {
      const source = readFileSync(join(ROOT, consumer), "utf8");
      const consumes =
        source.includes("resolveProjectScope") ||
        source.includes("stateScopeRoots") ||
        source.includes("resolveHostStateRoot") ||
        source.includes("resolveProjectDaemonSettings");
      if (!consumes) failures.push(`${consumer}: does not consume the policy`);
      if (/\$\{[^}]*stateDirectoryName\}/u.test(source)) {
        failures.push(`${consumer}: composes a state directory inline`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("the in-file surfaces inside the composition select the declared roots", () => {
    const production = readFileSync(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    // The dispatch state root.
    expect(production).toMatch(/stateRoot: stateDirectory,/u);
    // The retro sidecar location.
    expect(production).toMatch(/retro:\s*\{[\s\S]*?stateDirectory,/u);
    // The owner-hold read, at the host root only.
    expect(production).toMatch(/storeDirectory: hostRoot/u);
    expect(production).not.toMatch(/storeDirectory: stateDirectory/u);
    // The MCP equivalent.
    const mcp = readFileSync(join(ROOT, "packages/mcp/src/serve.ts"), "utf8");
    expect(mcp).toMatch(/storeDirectory: roots\.hostRoot/u);
  });

  it("the owner hold is read at the host root and every store path at the project root", () => {
    const production = readFileSync(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    const mcp = readFileSync(join(ROOT, "packages/mcp/src/serve.ts"), "utf8");
    expect(production).toContain("stateScopeRoots");
    expect(production).toContain("stateDirectory = roots.projectRoot");
    expect(production).toContain("storeDirectory: hostRoot");
    expect(mcp).toContain("stateScopeRoots");
    expect(mcp).toContain("storeDirectory: roots.hostRoot");
    expect(mcp).toContain("stateDirectory: roots.projectRoot");
    const edge = readFileSync(join(ROOT, "packages/cli/src/edge.ts"), "utf8");
    expect(edge).toContain("resolveProjectScope");
    expect(edge).toContain("stateScopeRoots");
    expect(edge).toContain("readCheckoutIdentity");
  });

  it("the shell fallback resolves the project root and keeps its search bound", () => {
    const shell = readFileSync(join(ROOT, SHELL_FALLBACK), "utf8");
    expect(shell).toContain("_dispatch_authority_project_root");
    expect(shell).toContain("project-identity.json");
    expect(shell).toContain("-maxdepth 2");
    expect(shell).not.toMatch(/-maxdepth [3-9]/u);
  });

  it("the pure override branch returns the override, the fallback, and a refusal", () => {
    expect(
      resolveHostStateRoot({
        environment: { EXAMPLE_PRODUCT_STATE_DIR: "/srv/one" },
        environmentPrefix: "EXAMPLE_PRODUCT_",
        stateDirectoryName: ".example-product-state",
        homeDirectory: "/srv/me",
      }),
    ).toEqual({ ok: true, value: "/srv/one" });
    expect(
      resolveHostStateRoot({
        environment: {},
        environmentPrefix: "EXAMPLE_PRODUCT_",
        stateDirectoryName: ".example-product-state",
        homeDirectory: "/srv/me",
      }),
    ).toEqual({ ok: true, value: "/srv/me/.example-product-state" });
    const relative = resolveHostStateRoot({
      environment: { EXAMPLE_PRODUCT_STATE_DIR: "relative/path" },
      environmentPrefix: "EXAMPLE_PRODUCT_",
      stateDirectoryName: ".example-product-state",
      homeDirectory: "/srv/me",
    });
    expect(relative.ok).toBe(false);
    if (!relative.ok) expect(relative.error.code).toBe("config.value.invalid");
  });
});

describe("TC-PROJ-023 the settings resolution has one call site, taking the project root", () => {
  it("exactly one call site exists and it lives at the composing site", () => {
    const sites = countCallSites(listSources(), "resolveDaemonSettings");
    expect(sites.map((site) => site.file)).toEqual([SETTINGS_SITE]);
    const site = readFileSync(join(ROOT, SETTINGS_SITE), "utf8");
    const helper = site.slice(site.indexOf("export const resolveProjectDaemonSettings"));
    const body = helper.slice(0, helper.indexOf(";\n"));
    expect(body).toContain("stateDirectory: projectStateRoot");
    expect(body).not.toContain("homeDirectory");
    expect(body).not.toContain("stateDirectoryName");
  });

  it("the composing site's only caller supplies the policy-derived project root", () => {
    const callers = countCallSites(listSources(), "resolveProjectDaemonSettings");
    expect(callers.map((site) => site.file)).toEqual(["packages/cli/src/production.ts"]);
    const production = readFileSync(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    expect(production).toContain("resolveProjectDaemonSettings(stateLocation)");
    expect(production).toContain(
      "const stateLocation = projectStateRoot(hostRoot, entry.projectKey)",
    );
  });

  it("the scan detects and names an injected inline composition", () => {
    const probe = mkdtempSync(join(ROOT, "tmp", "tmpdir", "gh288-policy-probe-"));
    try {
      const file = join(probe, "rogue.ts");
      writeFileSync(file, "const root = `${homeDirectory}/${brand.stateDirectoryName}`;\n");
      const sites = homeBrandSites([relative(ROOT, file)]);
      expect(sites.map((site) => site.file)).toEqual([relative(ROOT, file)]);
      expect(sites[0]?.line).toBe(1);
    } finally {
      rmSync(probe, { recursive: true, force: true });
    }
  });

  it("the scan detects a duplicated override read", () => {
    const probe = mkdtempSync(join(ROOT, "tmp", "tmpdir", "gh288-override-probe-"));
    try {
      const file = join(probe, "dup.ts");
      writeFileSync(
        file,
        "const name = `${prefix}_STATE_DIR`;\nconst other = `${prefix}_STATE_DIR`;\n",
      );
      const sites = overrideSites([relative(ROOT, file)]);
      expect(sites).toHaveLength(2);
      for (const site of sites) expect(site.file).toBe(relative(ROOT, file));
    } finally {
      rmSync(probe, { recursive: true, force: true });
    }
  });
});
