/**
 * TC-BRANDING-001..004 / 007 — resolver completeness, determinism, fail-closed
 * input handling, derivation-rule conformance, and the injected override.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import { resolveAtEdge, WORKING_NAME_OVERRIDE } from "../fixtures/branding/edge";

const ROOT = process.cwd();
const FIELDS = [
  "productName",
  "binaryName",
  "packageScope",
  "environmentPrefix",
  "configDirectoryName",
  "stateDirectoryName",
  "mcpToolPrefix",
  "telemetryNamespace",
  "docsBaseUrl",
  "repositoryUrl",
  "releaseAssetPrefix",
  "installPath",
] as const;
const SEED_LITERALS = ["ados", "ADOS_", "~/.ados"];
const namesFixture = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/branding/names.json"), "utf8"),
) as { names: string[] };
const derivationFixture = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/branding/derivation-cases.json"), "utf8"),
) as { cases: Array<{ workingName: string; expected: Record<string, string> }> };

const brandingSource = (): string =>
  readFileSync(join(ROOT, "packages/core/src/branding/index.ts"), "utf8");

const expectResolved = (workingName: string) => {
  const result = resolveBrandIdentity({ workingName });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("resolver unexpectedly failed");
  return result.value;
};

const gitStatus = (): string =>
  execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });

const containsSeed = (value: string): boolean => {
  const lower = value.toLowerCase();
  return SEED_LITERALS.some((seed) => lower.includes(seed.toLowerCase()));
};

describe("resolver completeness", () => {
  test("returns all twelve DEC-8 values for every synthetic name", () => {
    for (const name of namesFixture.names) {
      const identity = expectResolved(name);
      expect(Object.keys(identity).sort()).toEqual([...FIELDS].sort());
      expect(identity.productName).toBe(name);
      for (const field of FIELDS) {
        expect(typeof identity[field]).toBe("string");
        expect(identity[field].length).toBeGreaterThan(0);
      }
      expect(Object.isFrozen(identity)).toBe(true);
    }
  });
});

describe("resolver determinism", () => {
  test("same input yields deeply equal output", () => {
    const first = expectResolved(".renamed-product");
    const second = expectResolved(".renamed-product");
    expect(second).toEqual(first);
  });

  test("distinct names yield distinct value sets", () => {
    const serialized = namesFixture.names.map((name) => JSON.stringify(expectResolved(name)));
    expect(new Set(serialized).size).toBe(namesFixture.names.length);
  });

  test("no clock or randomness is consulted", () => {
    const originalNow = Date.now;
    const originalRandom = Math.random;
    Date.now = () => {
      throw new Error("ambient clock read");
    };
    Math.random = () => {
      throw new Error("ambient randomness read");
    };
    try {
      const identity = expectResolved(".alt-brand");
      expect(identity.productName).toBe(".alt-brand");
    } finally {
      Date.now = originalNow;
      Math.random = originalRandom;
    }
  });
});

describe("resolver fail-closed input contract", () => {
  const invalidWorkingNames: Array<[string, unknown]> = [
    ["undefined", undefined],
    ["empty", ""],
    ["whitespace-only", "   "],
    ["non-string", 42],
    ["slash", "bad/name"],
    ["backslash", "bad\\name"],
    ["control character", "bad\u0000name"],
    ["too long", "a".repeat(65)],
    ["unusable", "..."],
  ];

  test("invalid working names return a deterministic input error", () => {
    for (const [label, value] of invalidWorkingNames) {
      const result = resolveBrandIdentity({ workingName: value as string });
      expect({ label, ok: result.ok }).toEqual({ label, ok: false });
      if (result.ok) continue;
      expect(result.error.field).toBe("workingName");
      const repeat = resolveBrandIdentity({ workingName: value as string });
      expect(repeat).toEqual(result);
    }
  });

  test("an override that is present but invalid fails closed", () => {
    for (const override of ["", "   ", 17 as unknown as string]) {
      const result = resolveBrandIdentity({ workingName: "example-product", override });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.field).toBe("override");
    }
  });

  test("a valid name with no override still succeeds", () => {
    expect(resolveBrandIdentity({ workingName: "example-product" }).ok).toBe(true);
  });

  test("errors never echo the supplied value", () => {
    const result = resolveBrandIdentity({
      workingName: "secret-value",
      override: "  secret-value  ",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(JSON.stringify(result.error)).not.toContain("secret-value");
    }
  });
});

describe("derivation-rule conformance", () => {
  test("every fixture row matches the documented rules", () => {
    for (const row of derivationFixture.cases) {
      expect(expectResolved(row.workingName)).toEqual(row.expected);
    }
  });

  test("committed config path projects to a root dot-directory", () => {
    for (const row of derivationFixture.cases) {
      const projected = `${row.expected.configDirectoryName}/config.yaml`;
      expect(projected).toMatch(/^\.[a-z0-9-]+\/config\.yaml$/);
      expect(projected).toBe(`${row.expected.configDirectoryName}/config.yaml`);
    }
  });

  test("MCP prefix is documented and is binary name plus an underscore", () => {
    expect(brandingSource()).toContain("mcpToolPrefix");
    expect(brandingSource()).toContain("canonical primitive ID");
    for (const name of namesFixture.names) {
      const identity = expectResolved(name);
      expect(identity.mcpToolPrefix).toBe(`${identity.binaryName}_`);
    }
  });

  test("no derived value contains a seed literal", () => {
    for (const name of namesFixture.names) {
      const identity = expectResolved(name);
      for (const field of FIELDS) expect(containsSeed(identity[field])).toBe(false);
    }
  });
});

describe("injected override without rebuild", () => {
  test("no override fact keeps the configured name", () => {
    const result = resolveAtEdge("example-product", {});
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.productName).toBe("example-product");
  });

  test("the override fact swaps the full value set and leaves no configured name", () => {
    const result = resolveAtEdge("example-product", {
      [WORKING_NAME_OVERRIDE]: ".renamed-product",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(expectResolved(".renamed-product"));
    for (const field of FIELDS) expect(result.value[field]).not.toContain("example-product");
  });

  test("changing only the fact does not touch the working tree", () => {
    const before = gitStatus();
    resolveAtEdge("example-product", { [WORKING_NAME_OVERRIDE]: ".alt-brand" });
    resolveAtEdge("example-product", { [WORKING_NAME_OVERRIDE]: ".synthetic" });
    expect(gitStatus()).toBe(before);
  });

  test("the override variable is owned by the edge, not branding", () => {
    expect(WORKING_NAME_OVERRIDE).toBe("DELIVERY_OS_WORKING_NAME");
    expect(WORKING_NAME_OVERRIDE).not.toContain("ados");
    expect(brandingSource()).not.toContain(WORKING_NAME_OVERRIDE);
  });

  test("an empty override fails closed through the edge", () => {
    const result = resolveAtEdge("example-product", { [WORKING_NAME_OVERRIDE]: "  " });
    expect(result.ok).toBe(false);
  });

  test("the edge ignores non-record facts and inherited properties", () => {
    const inherited = Object.create({ [WORKING_NAME_OVERRIDE]: ".alt-brand" }) as unknown;
    const nonRecord = resolveAtEdge("example-product", "not-a-record");
    const inheritedResult = resolveAtEdge("example-product", inherited);
    expect(nonRecord.ok).toBe(true);
    expect(inheritedResult.ok).toBe(true);
    if (nonRecord.ok) expect(nonRecord.value.productName).toBe("example-product");
    if (inheritedResult.ok) expect(inheritedResult.value.productName).toBe("example-product");
  });
});
