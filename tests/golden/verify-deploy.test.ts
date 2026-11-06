/** TC-DEPLOY-010 — byte-pinned deploy verdict goldens and 20-run determinism. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import {
  createDeployHarness,
  type DeployHarnessOptions,
  verifiedTrace,
} from "../fixtures/verify-deploy/harness";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/verify-deploy/golden");

const goldenText = (name: string): string => readFileSync(join(GOLDEN, name), "utf8");

const scenario = (name: string): DeployHarnessOptions => {
  switch (name) {
    case "verified":
      return {};
    case "unknown-never-ran":
      return {
        trace: { ok: true, trace: verifiedTrace({ steps: [], artifacts: [], status: "success" }) },
      };
    case "unknown-status-stale":
      return {
        trace: {
          ok: true,
          trace: verifiedTrace({ located: false, steps: [], artifacts: [], status: "success" }),
        },
      };
    case "failed":
      return {
        trace: {
          ok: true,
          trace: verifiedTrace({
            status: undefined,
            steps: [
              { name: "build", status: "succeeded" },
              { name: "publish", status: "succeeded" },
              { name: "smoke", status: "failed" },
            ],
          }),
        },
      };
    case "missing":
      return { resolve: { ok: false, kind: "no-target" } };
    default:
      throw new Error(`unknown scenario ${name}`);
  }
};

const run = async (name: string, mode: { readonly json: boolean; readonly scripted?: boolean }) => {
  const harness = createDeployHarness(scenario(name));
  return harness.run(undefined, {
    json: mode.json,
    ...(mode.scripted === true ? { mode: "scripted" as const } : {}),
  });
};

const textOf = (value: { stdout: string; stderr: string }): string =>
  value.stdout.length > 0 ? value.stdout : value.stderr;

describe("TC-DEPLOY-010 deploy verdict goldens", () => {
  test("the verified machine data equals the committed golden", async () => {
    const result = await run("verified", { json: true });
    expect(assertEnvelopeContract(result.envelope)).toEqual([]);
    expect(result.envelope?.data).toEqual(JSON.parse(goldenText("verified-data.json")));
  });

  test("the verified human output equals the committed golden", async () => {
    const result = await run("verified", { json: false });
    expect(textOf(result)).toBe(goldenText("verified-human.txt"));
    expect(textOf(result)).toContain("verdict=verified");
  });

  for (const name of ["unknown-never-ran", "unknown-status-stale", "failed", "missing"] as const) {
    test(`${name}: scripted output equals the committed one-line golden`, async () => {
      const result = await run(name, { json: true, scripted: true });
      expect(result.stdout).toBe(goldenText(`${name}-scripted.json`));
      const parsed = JSON.parse(result.stdout.trim()) as Record<string, unknown>;
      expect(Object.keys(parsed).sort()).toEqual(["error", "runId"]);
      expect(Object.hasOwn(parsed, "data")).toBe(false);
      expect(Object.hasOwn(parsed, "schemaVersion")).toBe(false);
      expect(Object.hasOwn(parsed, "timing")).toBe(false);
    });

    test(`${name}: text output equals the committed golden and never claims verified`, async () => {
      const result = await run(name, { json: false });
      expect(textOf(result)).toBe(goldenText(`${name}-human.txt`));
      expect(textOf(result)).not.toContain("verdict=verified");
    });
  }

  test("twenty repeated runs are byte-identical and a changed fact differs", async () => {
    const first = await run("verified", { json: false });
    for (let index = 0; index < 19; index += 1) {
      const next = await run("verified", { json: false });
      expect(next.stdout).toBe(first.stdout);
      expect(next.stderr).toBe(first.stderr);
      expect(next.exitCode).toBe(first.exitCode);
    }
    const changed = createDeployHarness({
      trace: { ok: true, trace: verifiedTrace({ steps: [], artifacts: [] }) },
    });
    const changedRun = await changed.run(undefined, { json: false });
    expect(textOf(changedRun)).not.toBe(textOf(first));
  });

  test("a changed golden byte fails the comparison", () => {
    const golden = goldenText("verified-human.txt");
    expect(golden.replace("verdict=verified", "verdict=unknown")).not.toBe(golden);
  });
});
