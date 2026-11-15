/**
 * TC-SMAP-004 — this repository's pinned reference declaration resolves to
 * equality against the real workflow job-name set, and the shipped composition
 * supplies the map read end-to-end.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  nodeFileSystemFacts,
  readCiWorkflowJobNames,
  readCommittedConfigDocument,
} from "../../packages/adapters/src/file/index";
import { createProductionComposer } from "../../packages/cli/src/production";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import {
  resolveVerifySuiteBreadth,
  resolveVerifySuiteMap,
  suiteMapReadOfDocument,
} from "../../packages/core/src/domain/index";
import { makeTempRoot, removeRoot } from "../fixtures/state/harness";
import { baseFacts, clone, EXPECTED_JOBS, run } from "../fixtures/verify-gates/cases/facts";
import { combinedRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const ROOT = process.cwd();
const REFERENCE_SUITES = [
  "tests",
  "lint",
  "format",
  "typecheck",
  "boundaries",
  "prompt-conformance",
  "help-guide-coverage",
  "exports-parity",
] as const;

const brand = (() => {
  const resolved = resolveBrandIdentity({ workingName: "delivery-os" });
  if (!resolved.ok) throw new Error("the working name must resolve");
  return resolved.value;
})();

const repositoryRead = () =>
  readCommittedConfigDocument({
    platform: "linux",
    homeDirectory: process.env.HOME ?? "",
    environment: {},
    gitRoot: ROOT,
    enableSystemConfig: false,
    enableUserConfig: false,
    enableProjectLocalConfig: false,
    configurationDirectoryName: brand.configDirectoryName,
    fs: nodeFileSystemFacts(),
  });

const readSuiteMap = (() => {
  let memo: ReturnType<typeof repositoryRead> | undefined;
  return () => {
    if (memo === undefined) memo = repositoryRead();
    return suiteMapReadOfDocument(memo);
  };
})();

const realFacts = () => {
  const facts = clone(baseFacts());
  const names = [...EXPECTED_JOBS, "TS aggregate check"];
  facts.workflow = { outcome: "read", names };
  facts.checkRuns = {
    ok: true,
    value: { items: names.map((name) => run(name, "succeeded")), pageItemCount: names.length },
  };
  return facts;
};

describe("TC-SMAP-004 the reference declaration is pinned literal data", () => {
  test("the document path is derived from the branding seam, never a hardcoded name", () => {
    expect(brand.configDirectoryName).toBe(".delivery-os");
    expect(readFileSync(join(ROOT, brand.configDirectoryName, "config.yaml"), "utf8")).toContain(
      "verify.suite-map",
    );
  });

  test("the declaration is the closed shape with every pinned literal", () => {
    const read = readSuiteMap();
    expect(read.ok).toBe(true);
    if (!read.ok || !read.declared) throw new Error("expected the declared reference map");
    expect(read.value.schemaVersion).toBe("delivery.verify.suite-map.v1");
    expect(read.value.jobs).toHaveLength(1);
    expect(read.value.jobs[0]?.job).toBe("TS aggregate check");
    expect(read.value.jobs[0]?.suites).toEqual([...REFERENCE_SUITES]);
    expect(read.value.local).toEqual([...REFERENCE_SUITES]);
    expect(resolveVerifySuiteMap(read.value)).toEqual({
      ok: true,
      declared: true,
      value: read.value,
    });
  });

  test("the real workflow job-name set contains the mirror and resolves to equality", () => {
    const workflow = readCiWorkflowJobNames({
      baseDirectory: ROOT,
      fs: nodeFileSystemFacts(),
    });
    expect(workflow.outcome).toBe("read");
    expect(workflow.names).toContain("TS aggregate check");
    expect(new Set(workflow.names).size).toBe(workflow.names.length);
    const read = readSuiteMap();
    if (!read.ok || !read.declared) throw new Error("expected the declared reference map");
    const breadth = resolveVerifySuiteBreadth({
      map: read.value,
      workflow: { outcome: "read", names: workflow.names },
    });
    expect(breadth.kind).toBe("equal");
    if (breadth.kind !== "equal") return;
    expect(breadth.mirrorsJob).toBe("TS aggregate check");
    expect(breadth.suiteBreadth).toEqual([...REFERENCE_SUITES]);
    expect([...breadth.suiteBreadth].sort()).toEqual([...read.value.local].sort());
  });
});

describe("TC-SMAP-004 the composed surface cites breadth and does not refuse", () => {
  test("an in-process run over the real document reports exit 0 with both fields", async () => {
    const result = await runVerify(
      combinedRuntime({ facts: realFacts(), suiteMap: readSuiteMap }),
      ["gates", "GH-300"],
    );
    expect(result.exitCode).toBe(0);
    expect(result.envelope?.error).toBeUndefined();
    const data = result.envelope?.data as Record<string, unknown>;
    expect(data.overall).toBe("pass");
    expect(data.mirrorsJob).toBe("TS aggregate check");
    expect(data.suiteBreadth).toEqual([...REFERENCE_SUITES]);
    expect(JSON.stringify(result.envelope)).not.toContain("verify.narrowed-scope");
  });

  test("the shipped compositions supply the map read and never source the gate set", () => {
    const production = readFileSync(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    expect(production).toContain("readCommittedConfigDocument");
    expect(production).toContain("readSuiteMap");
    expect(production).toContain("suiteMapReadOfDocument");
    expect(production).not.toContain("resolveMergeGateSetFromConfig");
    const serve = readFileSync(join(ROOT, "packages/mcp/src/serve.ts"), "utf8");
    expect(serve).toContain("readSuiteMap: buildSuiteMapRead");
    expect(serve).toContain("readCommittedConfigDocument");
    expect(serve).not.toContain("resolveMergeGateSetFromConfig");
  });

  test("the production composer still registers the verify command family", () => {
    const root = makeTempRoot("gh300-suite-map-reference");
    try {
      const home = join(root, "home");
      const checkout = join(root, "checkout");
      mkdirSync(join(checkout, ".git"), { recursive: true });
      mkdirSync(home, { recursive: true });
      const composer = createProductionComposer({
        environment: { HOME: home },
        cwd: checkout,
        homeDirectory: home,
        workingName: SYNTHETIC_BRAND.binaryName,
      });
      const program = composer(SYNTHETIC_BRAND);
      expect(program.commands.verify).toBeDefined();
      expect(program.commands.verify?.positionals?.max).toBe(2);
    } finally {
      removeRoot(root);
    }
  });

  test("a declaration drift breaks the pinned literals rather than passing silently", () => {
    const drifted = {
      schemaVersion: "delivery.verify.suite-map.v1",
      jobs: [{ job: "TS aggregate check", suites: [...REFERENCE_SUITES, "e2e"] }],
      local: [...REFERENCE_SUITES],
    };
    const read = resolveVerifySuiteMap(drifted);
    expect(read.ok).toBe(true);
    if (!read.ok || !read.declared) return;
    const breadth = resolveVerifySuiteBreadth({
      map: read.value,
      workflow: { outcome: "read", names: ["TS aggregate check"] },
    });
    expect(breadth.kind).toBe("narrower");
  });
});
