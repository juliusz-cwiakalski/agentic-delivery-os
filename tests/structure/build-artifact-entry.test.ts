/**
 * GH-346 TC-BIN-060 / TC-BIN-071 — the additive artifact build entry.
 *
 * `build:binary` is one root script beside an unchanged package build, it names
 * the one declared build-side identity-literal site, that site derives the
 * artifact name from the same identity the primary bin declares, and neither
 * delivery array nor any second entry ships a legacy-named artifact. Every
 * scanner is exported and driven over a temporary tree so a mutant fails by
 * name rather than being asserted in prose.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const WORKING_NAMES = ["delivery-os", "jaiship"] as const;
const BUILD_ENTRY = "scripts/build-binary.ts";

type Manifest = {
  readonly scripts?: Readonly<Record<string, string>>;
};

const readManifest = (root: string): Manifest =>
  JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as Manifest;

/** The two delivered installer arrays, when the tree carries the installer. */
const installerArrays = (root: string): Readonly<Record<string, string>> => {
  const path = join(root, "scripts/install.sh");
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const arrays: Record<string, string> = {};
  for (const name of ["ADOS_DELIVERY_SCRIPTS", "ADOS_DELIVERY_TOOLS"]) {
    const start = text.indexOf(`${name}=(`);
    const end = start < 0 ? -1 : text.indexOf(")", start);
    arrays[name] = start < 0 || end < 0 ? "" : text.slice(start, end);
  }
  return arrays;
};

/**
 * The declared build-entry invariants (TC-BIN-060 step 1 and step 2): the
 * artifact entry is additive, the package build and the aggregate gate are
 * unchanged, and neither delivery array names the artifact, the CLI, or the
 * build entry.
 */
export const buildEntryViolations = (root: string): string[] => {
  const failures: string[] = [];
  const manifest = readManifest(root);
  const build = manifest.scripts?.build;
  const binary = manifest.scripts?.["build:binary"];
  const aggregate = manifest.scripts?.check;
  if (binary === undefined || !binary.includes(BUILD_ENTRY)) {
    failures.push(`build:binary must exist and invoke ${BUILD_ENTRY}`);
  }
  if (build !== "pnpm -r build") {
    failures.push(`the package build chain must stay "pnpm -r build" (found ${String(build)})`);
  }
  if (aggregate !== undefined && aggregate.includes("build:binary")) {
    failures.push("the aggregate check must not chain the artifact build");
  }
  for (const [name, script] of Object.entries(manifest.scripts ?? {})) {
    if (name === "build:binary") continue;
    if (script.includes("build-binary") || script.includes("--compile")) {
      failures.push(`script ${name} declares a second artifact build path`);
    }
  }
  const arrays = installerArrays(root);
  for (const [name, body] of Object.entries(arrays)) {
    for (const forbidden of [
      BUILD_ENTRY,
      "build-binary",
      "packages/cli",
      "bin/jaiship",
      "bin/delivery-os",
      "dist/jaiship",
    ]) {
      if (body.includes(forbidden)) failures.push(`${name} names ${forbidden}`);
    }
  }
  return failures;
};

type LiteralSite = { readonly file: string; readonly constant: string; readonly value: string };

const listTypeScriptFiles = (root: string, relative: string): string[] => {
  const results: string[] = [];
  const walk = (current: string): void => {
    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(join(root, current), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const next = `${current}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules") continue;
        walk(next);
      } else if (entry.name.endsWith(".ts")) results.push(next);
    }
  };
  walk(relative);
  return results.sort();
};

/** The declared build-side scan root: `scripts/`, outside the `packages/**` walk. */
export const buildSideLiteralSites = (root: string): readonly LiteralSite[] => {
  const sites: LiteralSite[] = [];
  for (const file of listTypeScriptFiles(root, "scripts")) {
    const source = ts.createSourceFile(
      file,
      readFileSync(join(root, file), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node): void => {
      if (
        (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
        (WORKING_NAMES as readonly string[]).includes(node.text)
      ) {
        const parent = node.parent;
        const constant =
          ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)
            ? parent.name.text
            : "expression";
        sites.push({ file, constant, value: node.text });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return sites;
};

/** The declared build-side inventory: exactly one site, on the build entry. */
const DECLARED_BUILD_SIDE_SITES: readonly LiteralSite[] = [
  { file: BUILD_ENTRY, constant: "PRIMARY_WORKING_NAME", value: "jaiship" },
];

/** Compare the build-side scan with its declared inventory in both directions. */
export const buildSideViolations = (root: string): string[] => {
  const failures: string[] = [];
  const found = buildSideLiteralSites(root);
  for (const declared of DECLARED_BUILD_SIDE_SITES) {
    if (!found.some((site) => site.file === declared.file && site.constant === declared.constant)) {
      failures.push(`declared build-side site ${declared.file}:${declared.constant} is missing`);
    }
  }
  for (const site of found) {
    if (
      !DECLARED_BUILD_SIDE_SITES.some(
        (declared) =>
          declared.file === site.file &&
          declared.constant === site.constant &&
          declared.value === site.value,
      )
    ) {
      failures.push(
        `undeclared build-side literal ${site.file}:${site.constant} ("${site.value}")`,
      );
    }
  }
  return failures;
};

/** The primary bin's declared identity, read from its one process-edge constant. */
const declaredPrimaryName = (root: string): string | undefined => {
  const source = ts.createSourceFile(
    "packages/cli/bin/jaiship.ts",
    readFileSync(join(root, "packages/cli/bin/jaiship.ts"), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let name: string | undefined;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "DEFAULT_WORKING_NAME" &&
      node.initializer !== undefined &&
      ts.isStringLiteral(node.initializer)
    ) {
      name = node.initializer.text;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return name;
};

/** The artifact name the build entry derives, read from its one declared site. */
const derivedArtifactName = (root: string): string | undefined =>
  buildSideLiteralSites(root).find((site) => site.file === BUILD_ENTRY)?.value;

/**
 * TC-BIN-060 step 6 and TC-BIN-071: the two identity declarations agree, and no
 * second (alias-named) artifact entry exists anywhere.
 */
export const artifactSetViolations = (root: string): string[] => {
  const failures: string[] = [];
  const primary = declaredPrimaryName(root);
  const derived = derivedArtifactName(root);
  if (primary === undefined) failures.push("the primary bin declares no working name");
  if (derived === undefined) failures.push("the build entry derives no artifact name");
  if (primary !== undefined && derived !== undefined && primary !== derived) {
    failures.push(`artifact name ${derived} disagrees with the primary identity ${primary}`);
  }
  const manifest = readManifest(root);
  for (const [name, script] of Object.entries(manifest.scripts ?? {})) {
    if (name === "build:binary") continue;
    if (/--compile|--outfile/u.test(script) && /jaiship|delivery-os/u.test(script)) {
      failures.push(`script ${name} declares a second artifact-producing entry`);
    }
  }
  const buildSource = readFileSync(join(root, BUILD_ENTRY), "utf8");
  if (buildSource.includes("delivery-os")) {
    failures.push("the build entry names the compatibility alias");
  }
  return failures;
};

const withTempTree = <T>(body: (root: string) => T): T => {
  const root = mkdtempSync(join(ROOT, "tmp/tmpdir/gh346-build-entry-"));
  try {
    return body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const write = (root: string, relative: string, content: string): void => {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

const seedTree = (root: string): void => {
  write(
    root,
    "package.json",
    JSON.stringify({
      scripts: { build: "pnpm -r build", "build:binary": "bun run scripts/build-binary.ts" },
    }),
  );
  write(
    root,
    BUILD_ENTRY,
    'const PRIMARY_WORKING_NAME = "jaiship";\nexport const out = PRIMARY_WORKING_NAME;\n',
  );
  write(root, "packages/cli/bin/jaiship.ts", 'const DEFAULT_WORKING_NAME = "jaiship";\n');
  write(root, "packages/cli/bin/delivery-os.ts", 'const DEFAULT_WORKING_NAME = "delivery-os";\n');
  write(
    root,
    "scripts/install.sh",
    "ADOS_DELIVERY_SCRIPTS=(scripts/deliver-ticket.sh)\nADOS_DELIVERY_TOOLS=(tools/clean-merged-branches)\n",
  );
};

describe("TC-BIN-060 the additive artifact build entry", () => {
  test("the root declares build:binary beside an unchanged package build", () => {
    expect(buildEntryViolations(ROOT)).toEqual([]);
    const manifest = readManifest(ROOT);
    expect(manifest.scripts?.["build:binary"]).toBe("bun run scripts/build-binary.ts");
    expect(manifest.scripts?.build).toBe("pnpm -r build");
    expect(manifest.scripts?.pretest).toBe("pnpm build");
    expect(manifest.scripts?.pretypecheck).toBe("pnpm build");
  });

  test("the build entry is the one declared build-side identity-literal site", () => {
    const sites = buildSideLiteralSites(ROOT);
    expect(sites.map((site) => `${site.file}:${site.constant}=${site.value}`)).toEqual([
      `${BUILD_ENTRY}:PRIMARY_WORKING_NAME=jaiship`,
    ]);
    expect(buildSideViolations(ROOT)).toEqual([]);
    // The product-surface walk stays at its delivered five: the build-side root
    // is a separate declared scan root.
    const packagesWalk = listTypeScriptFiles(ROOT, "packages").filter((file) =>
      readFileSync(join(ROOT, file), "utf8").includes('"jaiship"'),
    );
    expect(packagesWalk).not.toContain(BUILD_ENTRY);
  });

  test("the artifact name agrees with the primary bin's declared identity", () => {
    expect(declaredPrimaryName(ROOT)).toBe("jaiship");
    expect(derivedArtifactName(ROOT)).toBe("jaiship");
    expect(artifactSetViolations(ROOT)).toEqual([]);
  });

  test("a missing entry, a chained gate, and an installer array entry each fail by name", () => {
    withTempTree((root) => {
      seedTree(root);
      expect(buildEntryViolations(root)).toEqual([]);
      write(root, "package.json", JSON.stringify({ scripts: { build: "pnpm -r build" } }));
      expect(buildEntryViolations(root).join("\n")).toContain("build:binary must exist");
      write(
        root,
        "package.json",
        JSON.stringify({
          scripts: {
            build: "pnpm -r build",
            "build:binary": "bun run scripts/build-binary.ts",
            check: "pnpm test && bun run build:binary",
          },
        }),
      );
      expect(buildEntryViolations(root).join("\n")).toContain("must not chain");
      write(
        root,
        "package.json",
        JSON.stringify({
          scripts: {
            build: "pnpm -r build",
            "build:binary": "bun run scripts/build-binary.ts",
            "build:alias":
              "bun build --compile --outfile dist/delivery-os packages/cli/bin/delivery-os.ts",
          },
        }),
      );
      expect(buildEntryViolations(root).join("\n")).toContain("build:alias");
      write(root, "scripts/install.sh", "ADOS_DELIVERY_SCRIPTS=(scripts/build-binary.ts)\n");
      expect(buildEntryViolations(root).join("\n")).toContain("ADOS_DELIVERY_SCRIPTS names");
    });
  });
});

describe("TC-BIN-071 only the primary identity ships an artifact", () => {
  test("the delivered tree ships one artifact name and no alias-named entry", () => {
    expect(artifactSetViolations(ROOT)).toEqual([]);
    const manifest = readManifest(ROOT);
    for (const script of Object.values(manifest.scripts ?? {})) {
      expect(script).not.toContain("dist/delivery-os");
    }
    const buildSource = readFileSync(join(ROOT, BUILD_ENTRY), "utf8");
    expect(buildSource).not.toContain("delivery-os");
    expect(buildSource).toContain("PRIMARY_ENTRY");
  });

  test("an alias-named artifact entry, a name drift, and a build-side alias fail by name", () => {
    withTempTree((root) => {
      seedTree(root);
      expect(artifactSetViolations(root)).toEqual([]);
      write(root, "scripts/build-binary.ts", 'const OTHER_NAME = "delivery-os";\n');
      expect(artifactSetViolations(root).join("\n")).toContain("compatibility alias");
      expect(buildSideViolations(root).join("\n")).toContain("undeclared build-side literal");
      write(
        root,
        BUILD_ENTRY,
        'const PRIMARY_WORKING_NAME = "delivery-os";\nexport const out = PRIMARY_WORKING_NAME;\n',
      );
      expect(artifactSetViolations(root).join("\n")).toContain(
        "disagrees with the primary identity",
      );
      write(
        root,
        "package.json",
        JSON.stringify({
          scripts: {
            build: "pnpm -r build",
            "build:binary": "bun run scripts/build-binary.ts",
            "ship:alias":
              "bun build --compile --outfile dist/delivery-os packages/cli/bin/delivery-os.ts",
          },
        }),
      );
      expect(artifactSetViolations(root).join("\n")).toContain("ship:alias");
    });
  });
});
