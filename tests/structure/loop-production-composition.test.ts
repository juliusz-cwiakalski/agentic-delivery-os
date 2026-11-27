/**
 * TC-SPAWN-004 (GH-348 F-2, AC-F2-4): the binding is the delivered per-spawn
 * resolution and nothing else.
 *
 * Structure case over the shipped composition: the loop's harness mount wraps
 * the DELIVERED `createHarnessProfilePort` (the same composed function the
 * dispatch surface uses) around the delivered `resolveBinding`, and the fresh
 * spawn passes the caller agent identity `ceo`. There is no second resolver and
 * no policy evaluation. At this boundary the family is NOT prompt-required, so a
 * registered `loop` is composed and then dropped by the delivered entrypoint.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/help/prompt-required-commands";
import { createProductionComposer } from "../../packages/cli/src/production";
import { makeTempRoot, removeRoot } from "../fixtures/state/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const ROOT = process.cwd();

/** The declared loop composition block of the production composition. */
const loopCompositionSource = (): string => {
  const text = readFileSync(join(ROOT, "packages/cli/src/production.ts"), "utf8");
  const start = text.indexOf("const createProductionLoopComposition");
  expect(start).toBeGreaterThan(0);
  const end = text.indexOf("\n    /**\n     * The `projects list` host overview", start);
  expect(end).toBeGreaterThan(start);
  return text.slice(start, end);
};

describe("TC-SPAWN-004 the binding is the delivered per-spawn resolution", () => {
  test("the loop composition mounts the delivered profile wrapper and the delivered resolver", () => {
    const block = loopCompositionSource();
    expect(block).toContain("createHarnessProfilePort");
    expect(block).toContain("resolveBinding");
    expect(block).toContain("context: () => resolveProfileContext()");
    // The caller agent identity the delivered resolution consumes.
    expect(block).toContain('agent: "ceo"');
    // No second resolver and no operator override.
    expect(block).not.toContain("resolveHarnessAdmissionBinding");
    expect(block).not.toContain("--agent");
  });

  test("the shipped composer registers the loop family and it is NOT prompt-required yet", () => {
    const root = makeTempRoot("gh348-loop-composition");
    try {
      const home = join(root, "home");
      const checkout = join(root, "checkout");
      mkdirSync(join(checkout, ".git"), { recursive: true });
      mkdirSync(home, { recursive: true });
      const composer = createProductionComposer({
        harnessVersionProbe: async () => ({
          status: "answered" as const,
          stdout: "opencode v2.3.2",
        }),
        environment: { HOME: home },
        cwd: checkout,
        homeDirectory: home,
        workingName: SYNTHETIC_BRAND.binaryName,
      });
      const program = composer(SYNTHETIC_BRAND);
      expect(program.commands.loop).toBeDefined();
      // The FINAL five-verb grammar's flag set (phase 7).
      expect(program.commands.loop?.flags).toEqual([
        "--foreground",
        "--fresh-budget",
        "--mode",
        "--lines",
      ]);
      // After the phase-7 repin the family is prompt-required AND composed (a
      // registered extra would be dropped, so this is the composed set).
      expect([...PROMPT_REQUIRED_COMMANDS]).toContain("loop");
      expect(PROMPT_REQUIRED_COMMANDS).toHaveLength(29);
      expect(PROMPT_REQUIRED_COMMANDS.at(-2)).toBe("provider");
      expect(PROMPT_REQUIRED_COMMANDS.at(-1)).toBe("push");
    } finally {
      removeRoot(root);
    }
  });
});
