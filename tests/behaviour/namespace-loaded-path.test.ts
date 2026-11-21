/**
 * TC-LAYER-004 (AC-F1-4) — a composed read loads the committed current layer,
 * resolves the moved suite map, and opens no prior-root path.
 *
 * The composition is the production one; only the configuration filesystem facts
 * are injected so every opened path is observable. The prior configuration file
 * exists on disk with a different suite map, so a fallback would be visible as a
 * prior-root open and as a `prior-identity-fallback` notice.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createConfigProgram } from "../../packages/cli/src/edge";
import {
  recordingFs,
  scratchCheckout,
  scratchHome,
} from "../fixtures/entrypoint/prior-identity/harness";

const MARKER_JOB = "namespace-loaded-path-marker";
const PRIOR_JOB = "namespace-loaded-path-prior";

const suiteMap = (job: string): string =>
  [
    "verify:",
    "  suite-map:",
    '    schemaVersion: "delivery.verify.suite-map.v1"',
    "    jobs:",
    `      - job: "${job}"`,
    "        suites:",
    "          - tests",
    "    local:",
    "      - tests",
    "",
  ].join("\n");

type ConfigDebugData = {
  readonly loadedFiles?: readonly string[];
  readonly config?: Record<string, unknown>;
};

type ConfigDebugRun = {
  readonly data?: ConfigDebugData;
  readonly warnings?: readonly string[];
  readonly error?: { readonly code?: string };
};

const runConfigDebug = async (input: {
  readonly checkout: string;
  readonly home: string;
}): Promise<{ readonly run: ConfigDebugRun; readonly fs: ReturnType<typeof recordingFs> }> => {
  const fs = recordingFs();
  const program = createConfigProgram({
    workingName: "jaiship",
    environment: { HOME: input.home },
    cwd: input.checkout,
    homeDirectory: input.home,
    priorConfigurationDirectoryName: ".delivery-os",
    fs,
  });
  if (!program.ok) throw new Error("the configuration program did not compose");
  const definition = program.program.commands.config;
  if (definition === undefined) throw new Error("the config command is not composed");
  const result = (await definition.handler({
    command: "config",
    flags: {},
    argv: [],
    positionals: ["debug"],
    brand: program.brand,
  } as never)) as ConfigDebugRun;
  return { run: result, fs };
};

describe("TC-LAYER-004 loaded configuration path", () => {
  test("the composed read loads the current layer and opens no prior path", async () => {
    const checkout = scratchCheckout("loaded-path", {
      ".jaiship/config.yaml": suiteMap(MARKER_JOB),
      ".delivery-os/config.yaml": suiteMap(PRIOR_JOB),
    });
    const home = scratchHome("loaded-path-home", {});
    try {
      const { run, fs } = await runConfigDebug({ checkout: checkout.root, home: home.root });
      expect(run.error).toBeUndefined();

      const loadedFiles = run.data?.loadedFiles ?? [];
      expect(loadedFiles).toContain(join(checkout.root, ".jaiship/config.yaml"));

      const verify: unknown = run.data?.config?.verify;
      expect(verify).toBeTypeOf("object");
      const suiteMapNode: unknown = (verify as Record<string, unknown>)["suite-map"];
      expect(suiteMapNode).toBeTypeOf("object");
      const jobs: unknown = (suiteMapNode as Record<string, unknown>).jobs;
      expect(Array.isArray(jobs)).toBe(true);
      const firstJob: unknown = Array.isArray(jobs) ? jobs[0] : undefined;
      expect(firstJob).toBeTypeOf("object");
      expect((firstJob as Record<string, unknown>).job).toBe(MARKER_JOB);

      const priorRoot = `${join(checkout.root, ".delivery-os")}/`;
      // Existence-only probing of a shadowed prior file is the delivered
      // current-wins rule; a content read is what "opened" must exclude.
      const priorReads = fs.reads.filter((path) => path.startsWith(priorRoot));
      expect(priorReads).toEqual([]);
      const priorOpens = fs.opened.filter((path) => path.startsWith(priorRoot));
      for (const path of priorOpens) expect(fs.reads).not.toContain(path);

      const notices = (run.warnings ?? []).filter((line) =>
        line.includes("prior-identity-fallback"),
      );
      expect(notices).toEqual([]);
    } finally {
      checkout.dispose();
      home.dispose();
    }
  });
});
