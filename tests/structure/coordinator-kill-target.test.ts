/**
 * TC-COORD-042 / TC-COORD-085 (structure half) — the kill path is shell-free and
 * the same-user trust boundary is unchanged.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const FILES = [
  "packages/adapters/src/daemon/process.ts",
  "packages/adapters/src/harness/liveness.ts",
];

const SHELL_MARKERS = [
  "exec(",
  "execSync",
  "execFile",
  "spawnSync",
  "shell: true",
  "shell:true",
  "pkill",
  "killall",
  "taskkill",
  "killByName",
  "killPattern",
  "`kill ",
];

const PRIVILEGE_MARKERS = ["setuid", "sudo", "process.setgid", "os.setPriority"];

describe("TC-COORD-042 / TC-COORD-085 the kill path is shell-free", () => {
  test("no shell interpolation or name-based kill exists in the adapter kill path", () => {
    const violations: string[] = [];
    for (const file of FILES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const marker of SHELL_MARKERS) {
        if (text.includes(marker)) violations.push(`${file}: ${marker}`);
      }
    }
    expect(violations).toEqual([]);
  });

  test("no privilege escalation and no network destination enters the path", () => {
    const violations: string[] = [];
    for (const file of FILES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const marker of [...PRIVILEGE_MARKERS, "net.connect", "fetch(", "http.request"]) {
        if (text.includes(marker)) violations.push(`${file}: ${marker}`);
      }
    }
    expect(violations).toEqual([]);
  });

  test("the signal union is closed to the three declared signals", () => {
    const contracts = readFileSync(
      join(ROOT, "packages/core/src/contracts/daemon.ts"),
      "utf8",
    );
    expect(contracts).toContain('"SIGTERM" | "SIGINT" | "SIGKILL"');
    const kill = readFileSync(join(ROOT, "packages/adapters/src/daemon/process.ts"), "utf8");
    expect(kill).toContain('"SIGTERM"');
    expect(kill).toContain('"SIGKILL"');
    expect(kill).not.toContain('"SIGHUP"');
    expect(kill).not.toContain('"SIGQUIT"');
  });

  test("the kill helper is exported from the daemon subpath only", () => {
    const barrel = readFileSync(join(ROOT, "packages/adapters/src/daemon/index.ts"), "utf8");
    expect(barrel).toContain("killCoordinatorProcess");
    const root = readFileSync(join(ROOT, "packages/core/src/index.ts"), "utf8");
    expect(root).not.toContain("killCoordinatorProcess");
  });
});
