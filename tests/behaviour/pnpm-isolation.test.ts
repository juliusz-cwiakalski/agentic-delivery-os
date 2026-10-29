/**
 * TC-SCAFFOLD-003 — pnpm isolation probe.
 *
 * Builds a throwaway two-package workspace in which `b` imports `a` without
 * declaring it, installs, and records whether resolution rejects the undeclared
 * import. The ADR treats isolation as an assumption; the recorded observation is
 * the deliverable, and boundary rules remain the sole gate either way.
 */
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const writeJson = (path: string, value: unknown): void => {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

test("undeclared workspace import observation is recorded", () => {
  const dir = mkdtempSync(join(tmpdir(), "workspace-isolation-"));
  try {
    writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n');
    writeJson(join(dir, "package.json"), { name: "isolation-probe", private: true });

    mkdirSync(join(dir, "packages/a/src"), { recursive: true });
    writeJson(join(dir, "packages/a/package.json"), {
      name: "@delivery-os/probe-a",
      version: "0.0.0",
      type: "module",
      exports: { ".": "./src/index.ts" },
    });
    writeFileSync(join(dir, "packages/a/src/index.ts"), "export type A = { a: string };\n");

    mkdirSync(join(dir, "packages/b/src"), { recursive: true });
    writeJson(join(dir, "packages/b/package.json"), {
      name: "@delivery-os/probe-b",
      version: "0.0.0",
      type: "module",
      exports: { ".": "./src/index.ts" },
    });
    writeFileSync(
      join(dir, "packages/b/src/index.ts"),
      'import type { A } from "@delivery-os/probe-a";\nexport type B = A;\n',
    );

    const install = spawnSync(
      "pnpm",
      ["install", "--ignore-scripts", "--frozen-lockfile=false", "--reporter=silent"],
      { cwd: dir, encoding: "utf8", timeout: 180_000 },
    );
    expect(install.status).toBe(0);

    const probe = spawnSync(
      "bun",
      [
        "-e",
        'import("@delivery-os/probe-a").then(() => process.exit(0)).catch(() => process.exit(7))',
      ],
      { cwd: join(dir, "packages/b"), encoding: "utf8", timeout: 60_000 },
    );
    const rejected = probe.status !== 0;
    console.log(
      `RSK-4 observation: an undeclared workspace import was ${rejected ? "REJECTED by pnpm isolation" : "NOT rejected by pnpm isolation (recorded; boundary rules remain the sole gate)"}`,
    );
    // Never fails on the observation itself — the result is the record.
    expect(typeof rejected).toBe("boolean");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 240_000);
