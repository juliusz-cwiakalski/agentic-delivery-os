/**
 * TC-BRANDING-014 / 015 — legacy adapter mapping, exactly-once warning,
 * parameter-supplied current names, and secret-safe warning text.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLegacyCompat } from "../../packages/adapters/src/legacy/index";

const ROOT = process.cwd();
const PROBE = join(ROOT, "tests/fixtures/legacy/warn-probe.ts");
const CURRENT = { environmentPrefix: "SYNTH_", configDirectoryName: ".synthetic" } as const;
const ALT_CURRENT = { environmentPrefix: "ALT_", configDirectoryName: ".alt-brand" } as const;

const makeHome = (options: { legacyDirectory?: boolean; segment?: string } = {}): string => {
  const parent = mkdtempSync(join(tmpdir(), "legacy-home-"));
  const home = join(parent, options.segment ?? "synthetic-user");
  mkdirSync(home, { recursive: true });
  if (options.legacyDirectory) mkdirSync(join(home, ".ados"), { recursive: true });
  return home;
};

const withSink = (current = CURRENT) => {
  const messages: string[] = [];
  const compat = createLegacyCompat({ current, warn: (message) => messages.push(message) });
  return { compat, messages };
};

type ProbeResult = { warnings: number; messages: string[]; stderr: string };

const runProbe = (config: {
  current: { environmentPrefix: string; configDirectoryName: string };
  facts: Record<string, string>;
  homeDirectory: string;
  calls: number;
}): ProbeResult => {
  const result = spawnSync("bun", ["run", PROBE, JSON.stringify(config)], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const parsed = JSON.parse(result.stdout ?? "{}") as { warnings: number; messages: string[] };
  return { ...parsed, stderr: result.stderr ?? "" };
};

describe("legacy mapping", () => {
  test("maps to the supplied current names", () => {
    const home = makeHome();
    const { compat } = withSink();
    const result = compat.resolveLegacy({
      facts: { ADOS_TOKEN: "synthetic-value" },
      homeDirectory: home,
    });
    expect(result.environment).toEqual({ SYNTH_TOKEN: "synthetic-value" });
    expect(result.configDirectoryPath).toBe(join(home, ".synthetic"));
    expect(result.legacySourcesPresent).toBe(true);
  });

  test("two current-name sets change the output without a code edit", () => {
    const home = makeHome();
    const first = withSink(CURRENT).compat.resolveLegacy({
      facts: { ADOS_TOKEN: "value" },
      homeDirectory: home,
    });
    const second = withSink(ALT_CURRENT).compat.resolveLegacy({
      facts: { ADOS_TOKEN: "value" },
      homeDirectory: home,
    });
    expect(first.environment).toEqual({ SYNTH_TOKEN: "value" });
    expect(second.environment).toEqual({ ALT_TOKEN: "value" });
    expect(first.configDirectoryPath).not.toBe(second.configDirectoryPath);
  });

  test("reads only own properties of the injected facts", () => {
    const home = makeHome();
    const inherited = Object.create({ ADOS_INHERITED: "value" }) as Record<string, string>;
    const { compat } = withSink();
    const result = compat.resolveLegacy({ facts: inherited, homeDirectory: home });
    expect(result.environment).toEqual({});
    expect(result.legacySourcesPresent).toBe(false);
  });
});

describe("exactly-once warning", () => {
  test("two reads emit one warning", () => {
    const home = makeHome();
    const { compat, messages } = withSink();
    compat.resolveLegacy({ facts: { ADOS_TOKEN: "value" }, homeDirectory: home });
    compat.resolveLegacy({ facts: { ADOS_TOKEN: "value" }, homeDirectory: home });
    expect(messages).toHaveLength(1);
  });

  test("two different legacy sources still emit one warning", () => {
    const home = makeHome({ legacyDirectory: true });
    const { compat, messages } = withSink();
    compat.resolveLegacy({ facts: { ADOS_TOKEN: "value" }, homeDirectory: home });
    compat.resolveLegacy({ facts: { ADOS_TOKEN: "value" }, homeDirectory: home });
    expect(messages).toHaveLength(1);
  });

  test("no legacy source emits zero warnings", () => {
    const home = makeHome();
    const { compat, messages } = withSink();
    compat.resolveLegacy({ facts: { UNRELATED: "value" }, homeDirectory: home });
    compat.resolveLegacy({ facts: {}, homeDirectory: home });
    expect(messages).toHaveLength(0);
  });

  test("mapping is deterministic and independent of warning state", () => {
    const home = makeHome({ legacyDirectory: true });
    const { compat } = withSink();
    const first = compat.resolveLegacy({ facts: { ADOS_TOKEN: "value" }, homeDirectory: home });
    const second = compat.resolveLegacy({ facts: { ADOS_TOKEN: "value" }, homeDirectory: home });
    expect(second).toEqual(first);
  });

  test("the default process instance warns exactly once across two reads", () => {
    const home = makeHome({ legacyDirectory: true });
    const result = runProbe({
      current: CURRENT,
      facts: { ADOS_TOKEN: "synthetic-value", ADOS_HOME: "synthetic-home" },
      homeDirectory: home,
      calls: 2,
    });
    expect(result.warnings).toBe(1);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toContain("SYNTH_");
    expect(result.messages[0]).toContain("ADOS_");
    expect(result.stderr).toBe("");
  });

  test("the default process instance stays silent when no legacy source is present", () => {
    const home = makeHome();
    const result = runProbe({
      current: CURRENT,
      facts: { UNRELATED: "value" },
      homeDirectory: home,
      calls: 2,
    });
    expect(result.warnings).toBe(0);
    expect(result.messages).toEqual([]);
  });
});

describe("secret-safe warning text", () => {
  test("never echoes environment values or the home path", () => {
    const home = makeHome({ legacyDirectory: true, segment: "synthetic-user-segment" });
    const { compat, messages } = withSink();
    compat.resolveLegacy({
      facts: {
        ADOS_TOKEN: "synthetic-secret-value",
        ADOS_API_KEY: "synthetic-secret-two",
      },
      homeDirectory: home,
    });
    expect(messages).toHaveLength(1);
    const text = messages[0] as string;
    expect(text).not.toContain("synthetic-secret-value");
    expect(text).not.toContain("synthetic-secret-two");
    expect(text).not.toContain("synthetic-user-segment");
    expect(text).not.toContain("{");
    expect(text.length).toBeLessThan(300);
  });

  test("the child-process probe never echoes secrets either", () => {
    const home = makeHome({ legacyDirectory: true, segment: "synthetic-user-segment" });
    const result = runProbe({
      current: CURRENT,
      facts: { ADOS_TOKEN: "synthetic-secret-value" },
      homeDirectory: home,
      calls: 1,
    });
    expect(result.warnings).toBe(1);
    expect(result.messages.join(" ")).not.toContain("synthetic-secret-value");
  });
});

describe("legacy config facts", () => {
  test("current values and selector win over legacy collisions", () => {
    const home = makeHome();
    const { compat } = withSink();
    const facts = compat.resolveConfigFacts({
      facts: { ADOS_TOKEN: "legacy-token", ADOS_CONFIG: "/legacy/config.yaml" },
      environment: { SYNTH_TOKEN: "current-token", SYNTH_CONFIG: "/current/config.yaml" },
      homeDirectory: home,
    });
    expect(facts.environment.SYNTH_TOKEN).toBe("current-token");
    expect(facts.environment.SYNTH_CONFIG).toBe("/current/config.yaml");
    expect(facts.selectedConfig).toBe("/current/config.yaml");
    expect(facts.configDirectoryPath).toBe(join(home, ".synthetic"));
  });

  test("legacy-only environment and selector map to current names", () => {
    const home = makeHome();
    const { compat } = withSink();
    const facts = compat.resolveConfigFacts({
      facts: { ADOS_TOKEN: "legacy-token", ADOS_CONFIG: "/legacy/config.yaml" },
      environment: {},
      homeDirectory: home,
    });
    expect(facts.environment.SYNTH_TOKEN).toBe("legacy-token");
    expect(facts.environment.SYNTH_CONFIG).toBe("/legacy/config.yaml");
    expect(facts.selectedConfig).toBe("/legacy/config.yaml");
  });

  test("config facts warn once per instance and never without a legacy source", () => {
    const home = makeHome();
    const first = withSink();
    first.compat.resolveConfigFacts({
      facts: { ADOS_TOKEN: "x" },
      environment: {},
      homeDirectory: home,
    });
    first.compat.resolveConfigFacts({
      facts: { ADOS_TOKEN: "x" },
      environment: {},
      homeDirectory: home,
    });
    expect(first.messages).toHaveLength(1);

    const quiet = withSink();
    quiet.compat.resolveConfigFacts({ facts: {}, environment: {}, homeDirectory: home });
    expect(quiet.messages).toEqual([]);
  });
});
