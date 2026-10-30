/**
 * GH-172 CI parity — exports-gate mutations.
 *
 * The check passes on the live built tree and fails on a mutated copy of a real
 * publishable package whose packed declarations no longer resolve, proving the
 * attw gate is live rather than vacuous.
 */
import { describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { checkPackage, validate } from "../../scripts/checks/exports-parity";

const ROOT = process.cwd();

// Inside the repo tree so `pnpm exec attw` resolves the workspace binary through
// the ancestor node_modules; bunfig ignores tmp/**, so the copy is not a suite.
const makePackageCopy = (): string => {
  mkdirSync(join(ROOT, "tmp"), { recursive: true });
  const directory = mkdtempSync(join(ROOT, "tmp", "exports-parity-"));
  mkdirSync(join(directory, "packages"), { recursive: true });
  cpSync(join(ROOT, "packages/core"), join(directory, "packages/core"), { recursive: true });
  return directory;
};

describe("exports parity (attw --pack, esm-only)", () => {
  test("every publishable package passes against its built dist", () => {
    expect(validate(ROOT)).toEqual([]);
  }, 240_000);

  test("a packed declaration that stops resolving fails the gate by name", () => {
    const directory = makePackageCopy();
    try {
      expect(checkPackage(directory, "core")).toEqual([]);
      rmSync(join(directory, "packages/core/dist/contracts/index.d.ts"));
      const failures = checkPackage(directory, "core");
      expect(failures.length).toBeGreaterThan(0);
      expect(failures[0]).toContain("packages/core");
      expect(failures[0]).toContain("attw --pack --profile esm-only");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 240_000);
  }, 30_000);

  test("a missing build fails closed with the build hint", () => {
    mkdirSync(join(ROOT, "tmp"), { recursive: true });
    const directory = mkdtempSync(join(ROOT, "tmp", "exports-parity-"));
    try {
      const failures = checkPackage(directory, "core");
      expect(failures[0]).toContain("dist/ missing");
      expect(failures[0]).toContain("pnpm build");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
