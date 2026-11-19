/**
 * GH-346 TC-INST-020 (one arm) — the real artifact end to end, once.
 *
 * The in-process seam is anchored to the real process edge: the compiled
 * artifact installs itself from a non-worktree clone into a scratch `HOME`, and
 * the destination holds exactly its bytes with a `current` record.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { compileArtifact } from "../../scripts/build-binary";
import { createFixtureCheckouts } from "../fixtures/install/checkouts";

const ROOT = process.cwd();
let scratch = "";
let clone = "";
let dispose = () => {};
let artifactPath = "";

beforeAll(() => {
  scratch = mkdtempSync(join(ROOT, "tmp/tmpdir/gh346-e2e-"));
  const checkouts = createFixtureCheckouts("e2e");
  dispose = checkouts.dispose;
  clone = checkouts.clone;
  const built = compileArtifact({
    root: ROOT,
    outDirectory: join(scratch, "out"),
    now: () => new Date("2026-11-18T12:00:00Z"),
    git: (arguments_) =>
      arguments_.includes("status") ? "" : "4bc7b61a2c3d4e5f60718293a4b5c6d7e8f90123",
  });
  artifactPath = join(clone, "jaiship");
  copyFileSync(built.path, artifactPath);
  chmodSync(artifactPath, 0o755);
});

afterAll(() => {
  dispose();
  rmSync(scratch, { recursive: true, force: true });
});

const run = (
  argv: readonly string[],
): { readonly status: number | null; readonly stdout: string; readonly stderr: string } => {
  const result = spawnSync(artifactPath, [...argv], {
    cwd: clone,
    env: {
      HOME: join(scratch, "home"),
      TMPDIR: join(scratch, "tmp"),
      PATH: process.env.PATH ?? "",
    },
    encoding: "utf8",
    timeout: 120_000,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};

describe("TC-INST-020 the real artifact installs itself once", () => {
  test("the destination holds the artifact bytes and the record is current", () => {
    const install = run(["install", "--json"]);
    expect({ stderr: install.stderr, status: install.status }).toEqual({
      stderr: install.stderr,
      status: 0,
    });
    const home = join(scratch, "home");
    const destination = join(home, ".jaiship", "bin", "jaiship");
    const recordPath = join(home, ".jaiship", "install.json");
    expect(existsSync(destination)).toBe(true);
    expect(createHash("sha256").update(readFileSync(destination)).digest("hex")).toBe(
      createHash("sha256").update(readFileSync(artifactPath)).digest("hex"),
    );
    expect(existsSync(recordPath)).toBe(true);
    const record = JSON.parse(readFileSync(recordPath, "utf8")) as {
      readonly schemaVersion?: string;
      readonly provenance?: string;
      readonly sourceCheckout?: string;
    };
    expect(record.schemaVersion).toBe("install.record.v1");
    expect(record.provenance).toBe("verified");
    expect(record.sourceCheckout).toBe(clone);
    const status = run(["install", "status", "--json"]);
    expect(status.status).toBe(0);
    const payload = JSON.parse(status.stdout) as {
      readonly data: {
        readonly recordState?: string;
        readonly installed?: { readonly commit?: string };
      };
    };
    expect(payload.data.recordState).toBe("current");
    expect(payload.data.installed?.commit).toBe("4bc7b61a2c3d4e5f60718293a4b5c6d7e8f90123");
  });
});
