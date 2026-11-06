/**
 * TC-MCP-020 — the non-vacuity meta-check.
 *
 * Each mutant is a temp copy of one production module with one named guard
 * disabled (or a seeded prohibited construct). The mutant must fail by name; the
 * live modules must still pass. If a mutant passes, this meta-check fails.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { MCP_LIFECYCLE, scanRoot } from "../../scripts/checks/exit-code-literals";
import {
  catalogViolations,
  gitSeamViolations,
  handlerRecursionViolations,
  handlerUnsafeViolations,
  handlerWriteViolations,
  seedLiteralViolations,
} from "../fixtures/mcp/mutants/scan";
import { canonicalJson } from "../fixtures/mcp/parity/canonical";
import { envelopeLeaks } from "../fixtures/mcp/parity/harness";

const ROOT = process.cwd();
const MUTANT_ROOT = join(ROOT, "tmp/tmpdir");
const tempRoots: string[] = [];

const tempRoot = (label: string): string => {
  mkdirSync(MUTANT_ROOT, { recursive: true });
  const root = mkdtempSync(join(MUTANT_ROOT, `${label}-`));
  tempRoots.push(root);
  return root;
};

const writeFile = (root: string, relative: string, content: string): string => {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return path;
};

const realSource = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const importModule = async (path: string): Promise<Record<string, unknown>> =>
  (await import(`${pathToFileURL(path).href}?mutant=${Date.now()}`)) as Record<string, unknown>;

afterAll(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("TC-MCP-020 the live modules pass every guard", () => {
  test("the live scans are clean and non-vacuous", () => {
    expect(catalogViolations(ROOT).violations).toEqual([]);
    expect(handlerRecursionViolations(ROOT).violations).toEqual([]);
    expect(handlerUnsafeViolations(ROOT).violations).toEqual([]);
    expect(handlerWriteViolations(ROOT).violations).toEqual([]);
    expect(gitSeamViolations(ROOT).violations).toEqual([]);
    expect(seedLiteralViolations(ROOT).violations).toEqual([]);
    expect(scanRoot(ROOT).failures).toEqual([]);
  });
});

describe("TC-MCP-020 each mutant family fails by name", () => {
  test("payload-leakage mutant: exitCode: 2 is caught by the leakage scan", async () => {
    const root = tempRoot("payload");
    const original = realSource("packages/mcp/src/output/payload.ts");
    const path = writeFile(
      root,
      "packages/mcp/src/output/payload.ts",
      `${original}\nexport const leak = () => ({ ok: false, error: {\n` +
        '  code: "input.value.rejected", category: "user", retryable: false,\n' +
        '  consequence: "not_landed", remediationHint: "x", exitCode: 2 } });\n',
    );
    const module = await importModule(path);
    const leak = module.leak as () => { readonly error: Record<string, unknown> };
    const leaks = envelopeLeaks(leak().error);
    expect(leaks.some((entry) => entry.includes("exitCode"))).toBe(true);
  });

  test("parity mutant: one changed field breaks the golden comparison", () => {
    const golden = JSON.parse(
      readFileSync(
        join(ROOT, "tests/fixtures/mcp/golden/verify-artifact/verify-full-finished.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    const mutated = JSON.parse(JSON.stringify(golden)) as Record<string, unknown>;
    mutated.changeRef = "GH-MUTANT";
    expect(canonicalJson(mutated)).not.toBe(canonicalJson(golden));
    expect(Object.keys(mutated)).toContain("changeRef");
    expect(mutated.changeRef).not.toBe(golden.changeRef);
  });

  test("catalog mutant: a fourth tool fails naming the id", async () => {
    const root = tempRoot("catalog");
    const original = realSource("packages/mcp/src/commands/catalog.ts").replace(
      '"gate-report"] as const',
      '"gate-report", "batch"] as const',
    );
    const path = writeFile(root, "packages/mcp/src/commands/catalog.ts", original);
    const module = await importModule(path);
    expect((module.CANONICAL_TOOL_IDS as readonly string[]).length).toBe(4);
    const failures = catalogViolations(root).violations;
    expect(failures.some((entry) => entry.includes("batch"))).toBe(true);
  });

  test("lifecycle mutant: process.exit(3) in the lifecycle module fails by literal", () => {
    const root = tempRoot("lifecycle-exit");
    writeFile(root, MCP_LIFECYCLE, "process.exit(3);\n");
    const failures = scanRoot(root).failures;
    expect(failures.some((entry) => entry.includes(MCP_LIFECYCLE))).toBe(true);
    expect(failures.some((entry) => entry.includes("outside {0,1,2}"))).toBe(true);
  });

  test("lifecycle mutant: an exit in a non-lifecycle module fails by file", () => {
    const root = tempRoot("non-lifecycle-exit");
    const file = "packages/mcp/src/commands/status.ts";
    writeFile(root, file, "process.exit(0);\n");
    const failures = scanRoot(root).failures;
    expect(failures.some((entry) => entry.includes(file))).toBe(true);
    expect(failures.some((entry) => entry.includes("process.exit(...) is forbidden"))).toBe(true);
  });

  test("branding mutant: a seeded product literal fails by file", () => {
    const root = tempRoot("branding");
    const file = "packages/mcp/src/commands/catalog.ts";
    writeFile(root, file, 'export const label = "ados";\n');
    const failures = seedLiteralViolations(root).violations;
    expect(failures.some((entry) => entry.includes(file))).toBe(true);
    expect(failures.some((entry) => entry.includes("ados"))).toBe(true);
  });

  test("injection mutant: a handler that calls another tool fails by name", () => {
    const root = tempRoot("injection");
    const file = "packages/mcp/src/commands/verify-artifact.ts";
    writeFile(
      root,
      file,
      "export const tryAct = (toolset: { callTool: (id: string) => unknown }): unknown =>\n" +
        '  toolset.callTool("status");\n',
    );
    const failures = handlerRecursionViolations(root).violations;
    expect(failures.some((entry) => entry.includes(file))).toBe(true);
    expect(failures.some((entry) => entry.includes("callTool"))).toBe(true);
  });

  test("read-only mutant: a store.append call fails by name", () => {
    const root = tempRoot("readonly");
    const file = "packages/mcp/src/commands/gate-report.ts";
    writeFile(
      root,
      file,
      "export const write = (store: { append: (value: unknown) => void }): void =>\n" +
        "  store.append(1);\n",
    );
    const failures = handlerWriteViolations(root).violations;
    expect(failures.some((entry) => entry.includes(file))).toBe(true);
    expect(failures.some((entry) => entry.includes("state mutation append"))).toBe(true);
  });
});
