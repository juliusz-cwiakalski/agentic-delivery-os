import { describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type DefaultPositionManifest, resolveConfig } from "../../packages/core/src/index";
import {
  checkConfigArtifacts,
  configArtifacts,
  generateConfigArtifacts,
} from "../../scripts/checks/exports-parity";

const ROOT = process.cwd();

// Test-environment repair (GH-180 TC-DB-035, DEC-D11): the temporary workspace
// parent must exist before the first `mkdtempSync`, so the suite is
// deterministic in a clean checkout. No assertion or fixture semantics change.
mkdirSync(join(ROOT, "tmp", "tmpdir"), { recursive: true });

describe("TC-CONFIG-017/025 deterministic packed config artifacts", () => {
  test("the built core ships the same trusted schema and verified source manifest", () => {
    expect(checkConfigArtifacts(ROOT)).toEqual([]);
    const manifest = JSON.parse(configArtifacts(ROOT)["defaults-positions.json"] as string) as {
      source: string;
      sourceHash: string;
      positions: Record<string, number>;
    };
    expect(manifest).toMatchObject({ source: "core/src/config/defaults.ts" });
    expect(manifest.positions.provider).toBeGreaterThan(0);
    expect(manifest.sourceHash).toMatch(/^[0-9a-f]{64}$/);
    const schema = JSON.parse(
      readFileSync(join(ROOT, "packages/core/dist/config/config.schema.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
  });

  test("a runtime-aware reader injects the shipped manifest through the pure public resolver seam", () => {
    // Runtime-aware edge reads the packed artifact; core receives only typed data.
    const shipped = JSON.parse(
      readFileSync(join(ROOT, "packages/core/dist/config/defaults-positions.json"), "utf8"),
    ) as DefaultPositionManifest;
    const effective = resolveConfig({ defaultPositions: shipped });
    expect(effective.ok).toBe(true);
    if (effective.ok) {
      expect(effective.value.values.provider).toMatchObject({
        entries: { "zai-coding-plan": { class: "subscription" } },
      });
      expect(effective.value.origins.provider?.layer).toBe("defaults");
    }
    // Deliberately out-of-contract negative input; production type stays literal.
    const missingIdentity = resolveConfig({
      defaultPositions: { ...shipped, source: "wrong" } as DefaultPositionManifest,
    });
    expect(missingIdentity).toMatchObject({
      ok: false,
      error: { code: "config.value.invalid", layer: "defaults" },
    });
    const inventedPosition = resolveConfig({
      defaultPositions: { ...shipped, positions: { "x-invented": 99 } },
    });
    expect(inventedPosition).toMatchObject({
      ok: false,
      error: { code: "config.value.invalid", layer: "defaults" },
    });
    const missingHash = resolveConfig({ defaultPositions: { ...shipped, sourceHash: "" } });
    expect(missingHash.ok).toBe(false);
  });

  test("line insertion before an empty default declaration fails without changing runtime output", () => {
    const directory = mkdtempSync(join(ROOT, "tmp", "tmpdir", "defaults-positions-"));
    try {
      cpSync(join(ROOT, "packages/core/src/config"), join(directory, "packages/core/src/config"), {
        recursive: true,
      });
      cpSync(
        join(ROOT, "packages/core/dist/config"),
        join(directory, "packages/core/dist/config"),
        { recursive: true },
      );
      expect(checkConfigArtifacts(directory)).toEqual([]);
      const path = join(directory, "packages/core/src/config/defaults.ts");
      writeFileSync(path, `\n${readFileSync(path, "utf8")}`);
      expect(checkConfigArtifacts(directory).join("\n")).toContain("source/artifact drift");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("packed schema mutation fails without invoking attw", () => {
    const directory = mkdtempSync(join(ROOT, "tmp", "tmpdir", "schema-parity-"));
    try {
      cpSync(join(ROOT, "packages/core/src/config"), join(directory, "packages/core/src/config"), {
        recursive: true,
      });
      cpSync(
        join(ROOT, "packages/core/dist/config"),
        join(directory, "packages/core/dist/config"),
        { recursive: true },
      );
      const path = join(directory, "packages/core/dist/config/config.schema.json");
      writeFileSync(path, "{}\n");
      expect(checkConfigArtifacts(directory).join("\n")).toContain("source/artifact drift");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("artifact-only generation restores parity without attw or a prior artifact", () => {
    const directory = mkdtempSync(join(ROOT, "tmp", "tmpdir", "artifact-mode-"));
    try {
      cpSync(join(ROOT, "packages/core/src/config"), join(directory, "packages/core/src/config"), {
        recursive: true,
      });
      cpSync(
        join(ROOT, "packages/core/dist/config"),
        join(directory, "packages/core/dist/config"),
        { recursive: true },
      );
      const path = join(directory, "packages/core/dist/config/config.schema.json");
      rmSync(path);
      expect(checkConfigArtifacts(directory).join("\n")).toContain(
        "missing packed config artifact",
      );
      generateConfigArtifacts(directory);
      expect(checkConfigArtifacts(directory)).toEqual([]);
      const first = readFileSync(path, "utf8");
      generateConfigArtifacts(directory);
      expect(readFileSync(path, "utf8")).toBe(first);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("schema source mutation fails against the shipped source identity", () => {
    const directory = mkdtempSync(join(ROOT, "tmp", "tmpdir", "schema-source-"));
    try {
      cpSync(join(ROOT, "packages/core/src/config"), join(directory, "packages/core/src/config"), {
        recursive: true,
      });
      cpSync(
        join(ROOT, "packages/core/dist/config"),
        join(directory, "packages/core/dist/config"),
        { recursive: true },
      );
      const path = join(directory, "packages/core/src/config/schema.ts");
      writeFileSync(path, `\n${readFileSync(path, "utf8")}`);
      expect(checkConfigArtifacts(directory).join("\n")).toContain(
        "schema-sources.json: source/artifact drift",
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
