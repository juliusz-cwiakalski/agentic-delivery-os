/**
 * TC-PROV-003 — shipped provider defaults, optional fields, and provenance.
 *
 * Phase 2 extends this suite with validation, cost ordering, skip precedence,
 * determinism, and the no-fabrication controls.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { resolveConfig } from "../../packages/core/src/index";
import {
  parseAndValidateProviderConfiguration,
  parseProviderConfiguration,
} from "../../packages/core/src/provider/validate";
import type { ConfigValue } from "../../packages/core/src/contracts/config";

const ROOT = process.cwd();
const fixture = (name: string): unknown =>
  parse(readFileSync(join(ROOT, "tests/fixtures/provider/config", name), "utf8"));

const shipped = (): ReturnType<typeof parseProviderConfiguration> => {
  const resolved = resolveConfig();
  if (!resolved.ok) throw new Error(`defaults failed: ${JSON.stringify(resolved.error)}`);
  return parseProviderConfiguration(resolved.value.values);
};

describe("TC-PROV-003 shipped defaults", () => {
  test("the descriptor and credential reference ship exactly once with no chain", () => {
    const parsed = shipped();
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(Object.keys(parsed.config.credentials)).toEqual(["zai"]);
    expect(Object.keys(parsed.config.entries)).toEqual(["zai-coding-plan"]);
    expect(parsed.config.entries["zai-coding-plan"]?.class).toBe("subscription");
    expect(parsed.config.entries["zai-coding-plan"]?.peak).toEqual({
      timezone: "UTC",
      startSecondsOfDay: 21600,
      endSecondsOfDay: 36000,
      bufferSeconds: 7200,
    });
    expect(parsed.config.defaultChain).toBeUndefined();
    expect(parsed.config.chains).toEqual({});
  });

  test("optional defaults materialize exactly as Appendix B documents", () => {
    const parsed = shipped();
    if (!parsed.ok) throw new Error("defaults did not parse");
    const entry = parsed.config.entries["zai-coding-plan"];
    expect(entry?.enabled).toBe(true);
    expect(entry?.quota).toMatchObject({
      enabled: true,
      timeoutMs: 15000,
      thresholdPercent: 100,
      maxSleepLoops: 24,
      outageParkTtlSeconds: 300,
      credentialParkTtlSeconds: 900,
      capParkTtlSeconds: 300,
    });
    expect(entry?.quota?.endpoint).toBe("https://api.z.ai/api/monitor/usage/quota/limit");
    expect(entry?.quota?.credentialRef).toBe("zai");
    expect(parsed.config.credentials.zai?.sourceKey).toEqual({
      style: "literal",
      name: "ZAI_API_KEY",
    });
  });

  test("an omitted optional peak/quota block stays absent", () => {
    const config = fixture("optional-omitted.yaml") as ConfigValue;
    const parsed = parseAndValidateProviderConfiguration(config);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const entry = parsed.config.entries.minimal;
    expect(entry?.enabled).toBe(true);
    expect(entry === undefined ? "missing" : Object.hasOwn(entry, "peak")).toBe(false);
    expect(entry === undefined ? "missing" : Object.hasOwn(entry, "quota")).toBe(false);
  });

  test("the shipped descriptor appears exactly once; a temp-copy duplicate is detected", () => {
    const path = join(ROOT, "packages/core/src/config/defaults.ts");
    const text = readFileSync(path, "utf8");
    const count = (source: string): number => source.split('"zai-coding-plan"').length - 1;
    expect(count(text)).toBe(1);
    const root = mkdtempSync(join(tmpdir(), "provider-defaults-"));
    try {
      const copy = join(root, "defaults.ts");
      writeFileSync(copy, `${text}\n// "zai-coding-plan"\n`);
      expect(count(readFileSync(copy, "utf8"))).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("config debug provenance names the defaults layer for provider fields", () => {
    const resolved = resolveConfig();
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    for (const path of [
      "provider",
      "provider.entries.zai-coding-plan.class",
      "provider.entries.zai-coding-plan.peak.timezone",
      "provider.credentials.zai.sourceKey.name",
    ]) {
      expect(resolved.value.origins[path]?.layer, path).toBe("defaults");
    }
  });
});
