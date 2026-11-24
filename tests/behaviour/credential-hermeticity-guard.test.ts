/**
 * TC-HERM-001 — the suite-level hermeticity guard: the preload's behaviour
 * -based spawn interception holds on any host (CI may ship a real `gh`), and
 * its teeth are proven by a deliberately misbehaving probe.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

describe("TC-HERM-001 the hermeticity guard", () => {
  test("a real owner CLI spawn attempt is intercepted and named", () => {
    let message = "";
    try {
      spawnSync("gh", ["auth", "token"]);
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    expect(message).toContain("hermeticity-guard");
    expect(message).toContain("gh");
  });

  test("every declared owner CLI binary name is guarded", () => {
    for (const program of ["gh", "opencode", "claude"]) {
      let message = "";
      try {
        spawnSync(program, ["--version"]);
      } catch (error) {
        message = error instanceof Error ? error.message : "";
      }
      expect(message, program).toContain("hermeticity-guard");
    }
  });

  test("non-owner child processes pass through (git stays reachable for suites)", () => {
    const result = spawnSync("git", ["--version"], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("git version");
  });

  test("the strategies construct over the four injected seams only (suite convention)", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    // The pure strategy modules accept no ambient environment record: their
    // inputs are the injected seams. (The production wrapper module is the
    // single documented ambient read, guarded by the secret-read boundary.)
    for (const file of [
      "packages/adapters/src/credentials/command-strategy.ts",
      "packages/adapters/src/credentials/harness-store-strategy.ts",
      "packages/adapters/src/credentials/allowlist.ts",
    ]) {
      const text = readFileSync(file, "utf8");
      expect(text).not.toMatch(/process\.env/);
    }
  });
});
