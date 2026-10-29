/**
 * TC-SCAFFOLD-031 — the publish guard fails pre-freeze for both named reasons,
 * passes only in the freeze configuration, and is wired before publish.
 */
import { describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { PUBLISHABLE, evaluate } from "../../scripts/checks/publish-guard";

const ROOT = process.cwd();
const BRANDED = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/publish-guard/branded-scope.json"), "utf8"),
) as { publishScope: string };

const materialize = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "publish-guard-"));
  cpSync(join(ROOT, "package.json"), join(directory, "package.json"));
  for (const packageName of PUBLISHABLE) {
    mkdirSync(join(directory, "packages", packageName), { recursive: true });
    cpSync(
      join(ROOT, "packages", packageName, "package.json"),
      join(directory, "packages", packageName, "package.json"),
    );
  }
  return directory;
};

const mutate = (directory: string, mutateManifest: (manifest: Record<string, unknown>) => void): void => {
  for (const packageName of PUBLISHABLE) {
    const path = join(directory, "packages", packageName, "package.json");
    const manifest = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    mutateManifest(manifest);
    writeFileSync(path, JSON.stringify(manifest, null, 2));
  }
};

describe("publish guard", () => {
  test("live tree fails pre-freeze with the still-private reason", () => {
    const result = evaluate(ROOT);
    expect(result.ok).toBe(false);
    expect(result.reasons.some((entry) => entry.reason.includes("still private"))).toBe(true);
  });

  test("flipping one package without a branded scope fails with the scope reason", () => {
    const directory = materialize();
    try {
      const path = join(directory, "packages/core/package.json");
      const manifest = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      manifest.private = false;
      writeFileSync(path, JSON.stringify(manifest, null, 2));
      const result = evaluate(directory);
      expect(result.ok).toBe(false);
      expect(result.reasons.some((entry) => entry.reason.includes("branded scope not applied"))).toBe(
        true,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("all five flipped plus a branded scope passes (the guard is not unconditional)", () => {
    const directory = materialize();
    try {
      const rootPath = join(directory, "package.json");
      const rootManifest = JSON.parse(readFileSync(rootPath, "utf8")) as Record<string, unknown>;
      rootManifest.publishScope = BRANDED.publishScope;
      writeFileSync(rootPath, JSON.stringify(rootManifest, null, 2));
      mutate(directory, (manifest) => {
        manifest.private = false;
        const name = String(manifest.name);
        manifest.name = name.replace("@delivery-os/", `${BRANDED.publishScope}/`);
      });
      expect(evaluate(directory)).toEqual({ ok: true, reasons: [] });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("the release workflow runs the guard before publish and cannot skip it", () => {
    const workflow = parse(
      readFileSync(join(ROOT, ".github/workflows/release.yml"), "utf8"),
    ) as {
      jobs?: Record<string, { needs?: string | string[]; steps?: Array<{ run?: string }> }>;
    };
    const guard = workflow.jobs?.["publish-guard"];
    const publish = workflow.jobs?.publish;
    expect(guard).toBeDefined();
    expect(publish).toBeDefined();
    const needs = Array.isArray(publish?.needs) ? publish?.needs : [publish?.needs];
    expect(needs).toContain("publish-guard");
    const runs = (guard?.steps ?? []).map((step) => step.run ?? "").join("\n");
    expect(runs).toContain("scripts/checks/publish-guard.ts");
    const text = readFileSync(join(ROOT, ".github/workflows/release.yml"), "utf8");
    expect(text).not.toContain("continue-on-error");
    expect(text).not.toContain("|| true");
    expect(text).not.toContain("if: always()");
  });
});
