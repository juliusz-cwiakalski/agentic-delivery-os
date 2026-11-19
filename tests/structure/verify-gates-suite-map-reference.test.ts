/**
 * TC-SMAP-004 — this repository's pinned reference declaration resolves to
 * equality against the real workflow job-name set, and the shipped composition
 * supplies the map read end-to-end.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  nodeFileSystemFacts,
  readCiWorkflowJobNames,
  readCommittedConfigDocument,
} from "../../packages/adapters/src/file/index";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
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
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

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

// The reference document is read fresh per assertion: no memoized test-built
// read stands in for a composition.
const referenceMap = () => suiteMapReadOfDocument(repositoryRead());

const WORKFLOW = `name: CI
jobs:
  ts-aggregate:
    name: TS aggregate check
    runs-on: ubuntu-latest
    steps: [{ run: echo ok }]
`;

const SUITES_YAML = REFERENCE_SUITES.map((id) => `          - ${id}`).join("\n");
const LOCAL_YAML = (local: readonly string[]): string =>
  local.map((id) => `      - ${id}`).join("\n");
const documentYaml = (local: readonly string[], job = "TS aggregate check"): string => `verify:
  suite-map:
    schemaVersion: "delivery.verify.suite-map.v1"
    jobs:
      - job: "${job}"
        suites:
${SUITES_YAML}
    local:
${LOCAL_YAML(local)}
`;

const credentialFailure = {
  ok: false as const,
  code: "config.credential.missing" as const,
  domainKind: "config" as const,
  category: "user" as const,
  retryable: false as const,
  consequence: "not_landed" as const,
  projectionClass: "user-validation" as const,
};

type CheckoutOptions = {
  readonly document?: string;
  readonly documentAsDirectory?: boolean;
  readonly overlay?: string;
  readonly origin?: boolean;
};

type Checkout = {
  readonly root: string;
  readonly cwd: string;
  readonly home: string;
  cleanup(): void;
};

const checkout = (label: string, options: CheckoutOptions = {}): Checkout => {
  const root = makeTempRoot(`gh300-suite-map-reference-${label}`);
  const cwd = join(root, "checkout");
  const home = join(root, "home");
  mkdirSync(join(cwd, ".git"), { recursive: true });
  mkdirSync(join(cwd, ".github/workflows"), { recursive: true });
  mkdirSync(join(cwd, "doc/changes"), { recursive: true });
  mkdirSync(home, { recursive: true });
  writeFileSync(join(cwd, ".github/workflows/ci.yml"), WORKFLOW);
  if (options.origin === true) {
    writeFileSync(
      join(cwd, ".git/config"),
      `[remote "origin"]\n  url = https://github.com/example/repo.git\n`,
    );
    writeFileSync(join(cwd, ".git/HEAD"), "ref: refs/heads/main\n");
    mkdirSync(join(cwd, ".git/refs/heads"), { recursive: true });
    writeFileSync(join(cwd, ".git/refs/heads/main"), `${"1".repeat(40)}\n`);
  }
  if (options.document !== undefined) {
    mkdirSync(join(cwd, brand.configDirectoryName), { recursive: true });
    writeFileSync(join(cwd, brand.configDirectoryName, "config.yaml"), options.document);
  }
  if (options.documentAsDirectory === true) {
    mkdirSync(join(cwd, brand.configDirectoryName, "config.yaml"), { recursive: true });
  }
  if (options.overlay !== undefined) {
    mkdirSync(join(cwd, brand.configDirectoryName), { recursive: true });
    writeFileSync(join(cwd, brand.configDirectoryName, "config.local.yaml"), options.overlay);
  }
  return { root, cwd, home, cleanup: () => removeRoot(root) };
};

const runComposed = async (
  target: Checkout,
  options: { readonly selectedConfig?: string; readonly origin?: boolean } = {},
): Promise<{
  exitCode: number;
  envelope: Record<string, unknown> | undefined;
  stderr: string;
  transportCalls: string[];
  credentialCalls: string[];
}> => {
  const transportCalls: string[] = [];
  const credentialCalls: string[] = [];
  const stdout = bufferSink();
  const stderr = bufferSink();
  const environment: Record<string, string | undefined> = {
    HOME: target.home,
    PATH: "/usr/bin",
    ...(options.selectedConfig === undefined
      ? {}
      : { [`${brand.environmentPrefix}CONFIG`]: options.selectedConfig }),
  };
  const composer = createProductionComposer({
    harnessVersionProbe: async () => ({ status: "answered" as const, stdout: "opencode v2.3.2" }),
    environment,
    cwd: target.cwd,
    homeDirectory: target.home,
    workingName: brand.binaryName,
    ...(options.origin === true
      ? {
          githubTransport: {
            send: async (request: { readonly url: string }) => {
              transportCalls.push(request.url);
              return { status: 500, body: {} };
            },
          },
          credentials: {
            resolve: () => {
              credentialCalls.push("resolve");
              return credentialFailure;
            },
          },
        }
      : {}),
  });
  const exitCode = await runEntrypoint(["verify", "gates", "GH-300", "--json"], {
    streams: { stdout, stderr },
    environment,
    configuredWorkingName: brand.binaryName,
    composeProgram: composer,
    clock: { now: () => 1 },
    newRunId: () => "run-gh300-reference",
  });
  return {
    exitCode,
    envelope:
      stdout.value.length === 0 ? undefined : (JSON.parse(stdout.value) as Record<string, unknown>),
    stderr: stderr.value,
    transportCalls,
    credentialCalls,
  };
};

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
    const read = referenceMap();
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
    const read = referenceMap();
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

// Handler-level proof over the real document: provider facts are injected here,
// so this is not the shipped-composition proof. The production composer suite
// that follows is the composition proof; its ceiling is the declared P-9
// residual (the composer is not injectable at its provider-read boundary).
describe("TC-SMAP-004 the real reference document drives the handler", () => {
  test("it reports exit 0 with both fields when provider facts are injected", async () => {
    const result = await runVerify(
      combinedRuntime({ facts: realFacts(), suiteMap: referenceMap }),
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

const errorOf = (
  envelope: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined => envelope?.error as Record<string, unknown> | undefined;

describe("TC-SMAP-004 the shipped production composer supplies the map seam", () => {
  const defectiveStates: readonly { readonly label: string; readonly options: CheckoutOptions }[] =
    [
      {
        label: "defective-node",
        options: { document: documentYaml(["tests"], "TS\u2028aggregate check"), origin: true },
      },
      { label: "unreadable", options: { documentAsDirectory: true, origin: true } },
      { label: "unparseable", options: { document: "verify: [\n", origin: true } },
    ];

  for (const state of defectiveStates) {
    test(`a ${state.label} committed document refuses config.value.invalid before any provider read`, async () => {
      const target = checkout(state.label, state.options);
      try {
        const result = await runComposed(target, { origin: true });
        expect(result.exitCode).toBe(1);
        expect(result.envelope?.data).toBeUndefined();
        expect(errorOf(result.envelope)?.code).toBe("config.value.invalid");
        expect(result.envelope?.detail).toBeUndefined();
        expect(result.transportCalls).toEqual([]);
        expect(result.credentialCalls).toEqual([]);
      } finally {
        target.cleanup();
      }
    });
  }

  test("a narrowed committed declaration refuses verify.narrowed-scope with detail.suiteBreadth", async () => {
    const target = checkout("narrowed", { document: documentYaml(["tests"]) });
    try {
      const result = await runComposed(target, { origin: true });
      expect(result.exitCode).toBe(1);
      expect(result.envelope?.data).toBeUndefined();
      expect(errorOf(result.envelope)?.code).toBe("verify.narrowed-scope");
      expect(result.envelope?.detail).toEqual({ suiteBreadth: ["tests"] });
      const summary = String(errorOf(result.envelope)?.summary ?? "");
      expect(summary.split("\n")[0]).toContain(
        "scope=narrowed mirror=TS aggregate check breadth=tests",
      );
      expect(result.transportCalls).toEqual([]);
      expect(result.credentialCalls).toEqual([]);
    } finally {
      target.cleanup();
    }
  });

  test("a selector naming a missing path is the unusable-selector refusal, never undeclared", async () => {
    const target = checkout("selected-missing", { origin: true });
    try {
      const result = await runComposed(target, {
        origin: true,
        selectedConfig: join(target.root, "missing.yaml"),
      });
      expect(result.exitCode).toBe(1);
      expect(result.envelope?.data).toBeUndefined();
      expect(errorOf(result.envelope)?.code).toBe("config.value.invalid");
      expect(result.transportCalls).toEqual([]);
      expect(result.credentialCalls).toEqual([]);
    } finally {
      target.cleanup();
    }
  });

  test("an overlay narrowing declaration has no effect with the committed document absent", async () => {
    const target = checkout("overlay", { overlay: documentYaml(["tests"]) });
    try {
      const result = await runComposed(target, { origin: true });
      expect(result.exitCode).toBe(1);
      expect(errorOf(result.envelope)?.code).not.toBe("verify.narrowed-scope");
      expect(errorOf(result.envelope)?.code).not.toBe("config.value.invalid");
      expect(JSON.stringify(result.envelope)).not.toContain("scope=narrowed");
      expect(JSON.stringify(result.envelope)).not.toContain("suiteBreadth");
    } finally {
      target.cleanup();
    }
  });

  test("an equality committed declaration is consumed without a narrowed or config refusal", async () => {
    const target = checkout("equality", { document: documentYaml(REFERENCE_SUITES) });
    try {
      const result = await runComposed(target, { origin: true });
      expect(result.exitCode).toBe(1);
      expect(errorOf(result.envelope)?.code).not.toBe("verify.narrowed-scope");
      expect(errorOf(result.envelope)?.code).not.toBe("config.value.invalid");
      expect(JSON.stringify(result.envelope)).not.toContain("scope=narrowed");
    } finally {
      target.cleanup();
    }
  });

  test("supplement (not the proof): the source wires the committed-slot read and no gate set", () => {
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
    const target = checkout("registration");
    try {
      const composer = createProductionComposer({
        harnessVersionProbe: async () => ({
          status: "answered" as const,
          stdout: "opencode v2.3.2",
        }),
        environment: { HOME: target.home },
        cwd: target.cwd,
        homeDirectory: target.home,
        workingName: SYNTHETIC_BRAND.binaryName,
      });
      const program = composer(SYNTHETIC_BRAND);
      expect(program.commands.verify).toBeDefined();
      expect(program.commands.verify?.positionals?.max).toBe(2);
    } finally {
      target.cleanup();
    }
  });
});
