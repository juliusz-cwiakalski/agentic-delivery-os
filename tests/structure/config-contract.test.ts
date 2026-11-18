import { describe, expect, test } from "bun:test";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { generateConfigSchema, PRODUCTION_CATALOG, resolveConfig } from "@delivery-os/core";

describe("TC-CONFIG-023 pure root API and unchanged composition declaration", () => {
  test("root exports the one production resolver and canonical schema without a public config subpath", () => {
    expect(typeof resolveConfig).toBe("function");
    expect(typeof generateConfigSchema).toBe("function");
    expect(Object.keys(PRODUCTION_CATALOG)).toEqual([
      "provider",
      "commit",
      "merge",
      "harness",
      "verify",
      "metrics",
      "lane",
      "queue",
      "daemon",
      "coordinator",
      "poll",
    ]);
    expect(PRODUCTION_CATALOG.provider.type).toBe("object");
    expect(PRODUCTION_CATALOG.commit.type).toBe("object");
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "packages/core/package.json"), "utf8"),
    ) as { exports: Record<string, unknown> };
    expect(Object.keys(manifest.exports)).not.toContain("./config");
    const root = readFileSync(join(process.cwd(), "packages/core/src/index.ts"), "utf8");
    expect(root).toContain("export declare function createRuntime");
  });

  test("repeated pure resolution neither reads environment nor alters injected facts", () => {
    const environment = Object.freeze({ SOME_HOST_VALUE: "not a config input" });
    const options = Object.freeze({ environment });
    const first = resolveConfig(options);
    for (let i = 0; i < 20; i++) expect(resolveConfig(options)).toEqual(first);
    expect(environment).toEqual({ SOME_HOST_VALUE: "not a config input" });
  });
});

const GITHUB_SOURCE = "packages/adapters/src/github";
const FORBIDDEN_CONFIG_SURFACES = [
  "process.env",
  "github.workflow",
  "PRODUCTION_CATALOG",
  "ConfigErrorCode",
  "settingsType",
];

const listSourceFiles = (relative: string): string[] => {
  const entries = readdirSync(join(process.cwd(), relative), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const next = `${relative}/${entry.name}`;
    if (entry.isDirectory()) files.push(...listSourceFiles(next));
    else if (entry.name.endsWith(".ts")) files.push(next);
  }
  return files;
};

/** The construction-data scan: also used against a mutated temp copy. */
export const githubConfigSurfaceFailures = (root: string): string[] => {
  const failures: string[] = [];
  const directory = join(root, GITHUB_SOURCE);
  const walk = (relative: string): string[] => {
    const entries = readdirSync(join(root, relative), { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) files.push(...walk(next));
      else if (entry.name.endsWith(".ts")) files.push(next);
    }
    return files;
  };
  for (const relative of walk(GITHUB_SOURCE)) {
    const text = readFileSync(join(root, relative), "utf8");
    for (const forbidden of FORBIDDEN_CONFIG_SURFACES) {
      if (text.includes(forbidden)) {
        failures.push(`${relative}: forbidden configuration surface ${forbidden}`);
      }
    }
  }
  if (!existsSync(directory)) failures.push(`${GITHUB_SOURCE}: directory is missing`);
  return failures;
};

describe("TC-BACKLOG-009 no configuration surface is added for the mapping or the transport", () => {
  test("the config contract's declared key inventory is unchanged", () => {
    expect(Object.keys(PRODUCTION_CATALOG)).toEqual([
      "provider",
      "commit",
      "merge",
      "harness",
      "verify",
      "metrics",
      "lane",
      "queue",
      "daemon",
      "coordinator",
      "poll",
    ]);
    expect(Object.keys(PRODUCTION_CATALOG).filter((key) => /github|adapter/iu.test(key))).toEqual(
      [],
    );
  });

  test("the GitHub subpath carries the map and the policy as construction data only", () => {
    expect(githubConfigSurfaceFailures(process.cwd())).toEqual([]);
    const client = readFileSync(join(process.cwd(), `${GITHUB_SOURCE}/client.ts`), "utf8");
    expect(client).toContain("readonly workflowMap?: WorkflowMap");
    expect(listSourceFiles(GITHUB_SOURCE).some((file) => file.endsWith("workflow-map.ts"))).toBe(
      true,
    );
  });

  test("a github-named configuration node fails the scan naming the file", () => {
    mkdirSync(join(process.cwd(), "tmp", "tmpdir"), { recursive: true });
    const root = mkdtempSync(join(process.cwd(), "tmp", "tmpdir", "github-config-"));
    try {
      cpSync(join(process.cwd(), GITHUB_SOURCE), join(root, GITHUB_SOURCE), { recursive: true });
      writeFileSync(
        join(root, GITHUB_SOURCE, "config.ts"),
        'export const anyConfig = { "github.workflow": "mapped" };\n',
      );
      const failures = githubConfigSurfaceFailures(root);
      expect(failures.some((message) => message.includes("github.workflow"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
