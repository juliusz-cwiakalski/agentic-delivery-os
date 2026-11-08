/**
 * TC-TRANSPORT-001 / TC-WIRE-001 (structure halves) — codec and session are
 * transport-free, and no test double is exported from the production subpath.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const source = (path: string): string => readFileSync(join(ROOT, path), "utf8");

describe("GH-238 daemon import boundaries", () => {
  test("the codec and session import no transport module", () => {
    for (const file of [
      "packages/core/src/domain/control-codec.ts",
      "packages/core/src/domain/control-session.ts",
    ]) {
      const text = source(file);
      expect(text).not.toContain("adapters");
      expect(text).not.toContain("node:");
      expect(text).not.toContain("ControlTransport");
    }
  });

  test("the production adapters daemon subpath exports no test double", () => {
    const index = source("packages/adapters/src/daemon/index.ts");
    expect(index).not.toContain("memory");
    expect(index).not.toContain("fixtures");
    expect(index).not.toContain("createMemoryTransportPair");
  });

  test("the dispatcher performs no state write", () => {
    const server = source("packages/core/src/app/control-server.ts");
    expect(server).not.toContain("StateStorePort");
    expect(server).not.toContain(".append(");
    expect(server).not.toContain("acquireFence");
  });
});

describe("GH-238 supervision import boundary", () => {
  test("the supervision cycle imports no commit, phase, or merge path", () => {
    const supervision = source("packages/core/src/app/daemon-supervision.ts");
    expect(supervision).not.toContain("commit-act");
    expect(supervision).not.toContain("commands/phase");
    expect(supervision).not.toContain("merge");
    expect(supervision).not.toContain("StateStorePort>\n  commit");
  });
});

describe("GH-238 owner/daemon effect boundary", () => {
  test("no daemon module imports the owner effect composition or the commit seam", () => {
    for (const file of [
      "packages/core/src/app/daemon.ts",
      "packages/core/src/app/daemon-runtime.ts",
      "packages/core/src/app/daemon-reconcile.ts",
      "packages/core/src/app/daemon-supervision.ts",
    ]) {
      const text = source(file);
      expect(text).not.toContain("./effects");
      expect(text).not.toContain("commit-act");
      expect(text).not.toContain("createGitCommitSeam");
    }
  });
});
