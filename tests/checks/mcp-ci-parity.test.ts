/**
 * TC-MCP-019 — CI wiring parity: the ts-test job discovers the MCP suites and
 * declares the Node host the portability smoke requires.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const ROOT = process.cwd();

type Step = { readonly uses?: string; readonly run?: string; readonly name?: string };
type Job = { readonly steps?: readonly Step[] };
type Workflow = { readonly jobs?: Record<string, Job> };

const workflow = (): Workflow =>
  parse(readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8")) as Workflow;

const tsTestSteps = (): readonly Step[] => workflow().jobs?.["ts-test"]?.steps ?? [];

describe("TC-MCP-019 CI Node wiring", () => {
  test("the ts-test job runs the Bun test entrypoint", () => {
    const steps = tsTestSteps();
    expect(steps.some((step) => (step.run ?? "").includes("pnpm test"))).toBe(true);
  });

  test("the ts-test job declares or records a Node host", () => {
    const steps = tsTestSteps();
    const recordsNode = steps.some((step) => (step.run ?? "").includes("node --version"));
    const pinnedSetup = steps.some(
      (step) => typeof step.uses === "string" && step.uses.startsWith("actions/setup-node@"),
    );
    expect(recordsNode || pinnedSetup).toBe(true);
  });

  test("Bun discovery still covers the MCP suites", () => {
    const bunfig = readFileSync(join(ROOT, "bunfig.toml"), "utf8");
    expect(bunfig).toContain('root = "."');
    expect(bunfig).not.toContain("tests/behaviour");
  });
});
