/**
 * GH-350 TC-SIM-010 — both simulation renderings disclose what was simulated:
 * the machine payload carries the fixture path, schema version, instant,
 * `stateWrites: 0`, the answered seams and the bounded decision summary, and the
 * human rendering states the same facts beside the delivered decision line.
 *
 * The machine golden is captured as text so the byte-for-byte assertion holds
 * under the repository formatter''s JSON array collapsing.
 *
 * Regenerate the committed goldens explicitly:
 *   SIMULATE_GOLDEN_UPDATE=1 bun test tests/golden/provider-simulate-golden.test.ts
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ProviderComposition } from "@delivery-os/core/contracts";
import { PROVIDER_SIMULATE_SCHEMA_VERSION } from "@delivery-os/core/provider";
import { createConfigProgram } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const ROOT = process.cwd();
const GOLDEN = "tests/fixtures/provider/golden";
const MACHINE = "simulate-machine.txt";
const HUMAN = "simulate-human.txt";
const CONFIG_PATH = "/repo/.jaiship/config.yaml";
const FIXTURE_PATH = "/repo/simulate.json";
const NOW_ISO = "2026-01-01T12:00:00Z";
const NOW = Date.parse(NOW_ISO);

const CONFIG = `provider:
  defaultChain: ch
  credentials:
    c:
      sourceKey:
        style: literal
        name: SIM_KEY
  entries:
    sub:
      class: subscription
  chains:
    ch:
      entries:
        - sub
  budgets:
    daily:
      scope: window
      basis: cost
      ceiling: 40
      windowSeconds: 3600
      entries:
        - sub
`;

const FIXTURE = JSON.stringify({
  schemaVersion: PROVIDER_SIMULATE_SCHEMA_VERSION,
  now: NOW_ISO,
  workItemRef: "GH-350",
  credentials: { c: "resolved" },
  spend: {
    telemetryState: "present",
    points: [{ atMs: NOW - 60_000, cost: 40, tokens: 120 }],
  },
});

const runSimulation = async (): Promise<{ data: unknown; human: string }> => {
  const root = makeTempRoot("gh350-simulate-golden");
  try {
    const { store } = openStore(makeIdentity(root));
    const provider: ProviderComposition = {
      clock: { nowMs: () => NOW },
      credentialPort: { resolve: () => ({ ok: true, material: { value: "" } }) },
      transport: { send: async () => ({ status: 200, bodyText: "{}" }) },
      sleep: { sleep: async () => undefined },
      stateStore: store,
      newFenceToken: () => "fence-simulate-golden",
      fixtureFs: {
        exists: (path) => path === FIXTURE_PATH,
        readText: (path) => {
          if (path !== FIXTURE_PATH) throw new Error("missing file");
          return FIXTURE;
        },
      },
    };
    const program = createConfigProgram({
      workingName: "jaiship",
      environment: { HOME: "/home/synthetic", XDG_CONFIG_DIRS: "/etc/xdg" },
      cwd: "/repo",
      homeDirectory: "/home/synthetic",
      platform: "linux",
      fs: {
        exists: (path) => path === CONFIG_PATH,
        readText: (path) => {
          if (path !== CONFIG_PATH) throw new Error("missing file");
          return CONFIG;
        },
      },
      repositoryIo: {
        exists: (path) => path === "/repo/.git",
        isFile: () => false,
        readText: () => "",
      },
      provider,
    });
    if (!program.ok) throw new Error("the provider program did not compose");
    const deps: CliDependencies = {
      brand: program.brand,
      clock: { now: () => NOW },
      newRunId: () => "run-gh350-simulate-golden",
      secrets: program.secrets,
      program: program.program,
    };
    const call = async (argv: readonly string[]): Promise<string> => {
      let stdout = "";
      const exitCode = await runCli(
        ["provider", ...argv],
        {
          stdout: { write: (chunk: string) => (stdout += chunk) },
          stderr: { write: () => undefined },
        },
        deps,
      );
      expect(exitCode).toBe(0);
      return stdout;
    };
    const machine = JSON.parse(await call(["simulate", "--fixture", FIXTURE_PATH, "--json"])) as {
      data: unknown;
    };
    return { data: machine.data, human: await call(["simulate", "--fixture", FIXTURE_PATH]) };
  } finally {
    removeRoot(root);
  }
};

const goldenPath = (name: string): string => join(ROOT, GOLDEN, name);
const readGolden = (name: string): string => readFileSync(goldenPath(name), "utf8");
const writeGolden = (name: string, text: string): void => {
  mkdirSync(dirname(goldenPath(name)), { recursive: true });
  writeFileSync(goldenPath(name), text);
};
const updating = (): boolean => process.env.SIMULATE_GOLDEN_UPDATE === "1";

describe("TC-SIM-010 both renderings disclose what was simulated", () => {
  test("the machine payload matches the committed golden byte for byte", async () => {
    const { data } = await runSimulation();
    const serialized = `${JSON.stringify(data, null, 2)}\n`;
    if (updating()) writeGolden(MACHINE, serialized);
    expect(serialized).toBe(readGolden(MACHINE));
    const simulation = (data as { simulation: Record<string, unknown> }).simulation;
    expect(simulation.stateWrites).toBe(0);
    expect(simulation.fixturePath).toBe(FIXTURE_PATH);
    expect(simulation.fixtureSchemaVersion).toBe(PROVIDER_SIMULATE_SCHEMA_VERSION);
    expect(simulation.now).toBe(NOW_ISO);
    expect(simulation.summary).toBeDefined();
  });

  test("the human rendering names the fixture, the instant, the seams, and that nothing was written", async () => {
    const { human } = await runSimulation();
    if (updating()) writeGolden(HUMAN, human);
    const expected = readGolden(HUMAN);
    expect(human.trimEnd()).toBe(expected.trimEnd());
    expect(human).toContain(`simulate ${FIXTURE_PATH} at ${NOW_ISO} stateWrites=0`);
    expect(human).toContain("inputs credentials=fixture quota=fixture");
    expect(human).toContain("skipped");
  });
});
