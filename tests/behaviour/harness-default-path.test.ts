/**
 * TC-HDA-011 — the configured command is the bare name `opencode`; the child
 * resolves it through the declared `PATH`. Removing the directory from `PATH`
 * fails the same bare command, so the positive result is load-bearing.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { HarnessExecutionEnvironmentDescriptor } from "../../packages/core/src/contracts/index";
import {
  createControlledParent,
  createSyntheticOpencode,
  readArgvDump,
  readEnvironmentDump,
} from "../fixtures/harness/default-spawn";

const pathDescriptor = (workDirectory: string): HarnessExecutionEnvironmentDescriptor => ({
  kind: "host",
  workDirectory,
  environment: [{ kind: "variable", name: "PATH" }],
});

describe("TC-HDA-011 bare-command PATH resolution", () => {
  test("the bare name resolves through the declared PATH and writes a marker", async () => {
    const controlled = createControlledParent();
    try {
      const synthetic = createSyntheticOpencode({
        parentEnvironment: controlled.parentEnvironment,
      });
      const result = await synthetic.port.spawn({
        workItemRef: "GH-277",
        prompt: "deliver GH-277",
        descriptor: pathDescriptor(controlled.workDirectory),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.harnessKind).toBe("opencode");
      expect(existsSync(controlled.markerPath)).toBe(true);

      expect(synthetic.starterCalls).toHaveLength(1);
      expect(synthetic.starterCalls[0]?.file).toBe("opencode");
      expect(synthetic.starterCalls[0]?.file).not.toContain("/");
      expect(synthetic.starterCalls[0]?.args).toEqual(["run", "--format", "json"]);
      expect(synthetic.starterCalls[0]?.args.some((arg) => arg.startsWith("/"))).toBe(false);

      const child = readEnvironmentDump(controlled);
      expect(child.PATH).toBe(controlled.pathValue);
      const argv = readArgvDump(controlled);
      expect(argv.some((arg) => arg === "opencode" || arg.endsWith(join("bin", "opencode")))).toBe(
        true,
      );
    } finally {
      controlled.dispose();
    }
  });

  test("the off-PATH control fails pre-session and writes no marker", async () => {
    const controlled = createControlledParent();
    try {
      const withoutTempBin = controlled.pathValue
        .split(":")
        .filter((entry) => entry !== controlled.binDirectory)
        .join(":");
      const synthetic = createSyntheticOpencode({
        parentEnvironment: { ...controlled.parentEnvironment, PATH: withoutTempBin },
      });
      const result = await synthetic.port.spawn({
        workItemRef: "GH-277",
        prompt: "deliver GH-277",
        descriptor: pathDescriptor(controlled.workDirectory),
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("harness.spawn.refused");
      expect(existsSync(controlled.markerPath)).toBe(false);
      expect(synthetic.starterCalls).toHaveLength(1);
      expect(synthetic.starterCalls[0]?.file).toBe("opencode");
    } finally {
      controlled.dispose();
    }
  });
});
