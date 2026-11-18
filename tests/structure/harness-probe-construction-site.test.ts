/**
 * TC-HARNESS-046 / spec §17.2 clause 6 — exactly ONE production construction site
 * of the version-probe seam and exactly ONE production invocation site.
 *
 * The two counts are different numbers and are asserted separately: a naive
 * reference count finds the construction (the composition builds the probe) and
 * the invocation (the registry calls the injected function once per resolution)
 * and would either fail spuriously or be loosened until it proves nothing.
 */
import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();
const CONSTRUCTION = "createHarnessVersionProbe(";
const INVOCATION = "input.versionProbe(";

const listTypeScript = (root: string, relative = "packages"): string[] => {
  const files: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
      const child = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(child);
      else if (entry.name.endsWith(".ts")) files.push(child);
    }
  };
  walk(relative);
  return files;
};

/** Count construction sites: a call of the factory, never its declaration. */
export const constructionSites = (root: string): string[] =>
  listTypeScript(root).filter((file) => {
    const text = readFileSync(join(root, file), "utf8");
    return text
      .split("\n")
      .some(
        (line) =>
          line.includes(CONSTRUCTION) && !line.includes("export const createHarnessVersionProbe"),
      );
  });

/** Count invocation sites of the injected probe. */
export const invocationSites = (root: string): string[] =>
  listTypeScript(root).filter((file) =>
    readFileSync(join(root, file), "utf8").includes(INVOCATION),
  );

describe("TC-HARNESS-046 the single probe seam", () => {
  test("exactly one production construction site, in the composition", () => {
    const sites = constructionSites(ROOT);
    expect(sites).toEqual(["packages/cli/src/production.ts"]);
  });

  test("exactly one production invocation site, in the registry", () => {
    const sites = invocationSites(ROOT);
    expect(sites).toEqual(["packages/core/src/domain/harness-registry.ts"]);
  });

  test("a second CONSTRUCTION site fails the check and names the file", () => {
    const copy = mkdtempSync(join(tmpdir(), "gh335-probe-site-"));
    try {
      cpSync(join(ROOT, "packages"), join(copy, "packages"), { recursive: true });
      const extra = join(copy, "packages/core/src/domain/harness-second-probe.ts");
      writeFileSync(
        extra,
        'import { createHarnessVersionProbe } from "../../cli/src/production";\nexport const second = () => createHarnessVersionProbe({} as never);\n',
      );
      const sites = constructionSites(copy);
      expect(sites).toContain("packages/core/src/domain/harness-second-probe.ts");
      expect(sites.length).toBe(2);
      expect(constructionSites(ROOT).length).toBe(1);
    } finally {
      rmSync(copy, { recursive: true, force: true });
    }
  });

  test("a second REFERENCE to the already-injected probe is not a construction", () => {
    const registry = readFileSync(
      join(ROOT, "packages/core/src/domain/harness-registry.ts"),
      "utf8",
    );
    // The invocation is a call of the injected parameter, not a factory call.
    expect(registry).toContain(INVOCATION);
    expect(registry).not.toContain(CONSTRUCTION);
  });
});
