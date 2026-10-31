/**
 * TC-LINT-009 — lint determinism and read-only behaviour (NFR-3).
 *
 * Replays compare the complete verdict; ambient stubs throw; a tree digest and
 * a recording state edge prove a standalone lint writes nothing. A deliberate
 * cache-writing control proves the digest assertion is live.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRegistryLintReader } from "../../packages/cli/src/edge";
import type { StateStorePort } from "../../packages/core/src/contracts/index";
import { scan } from "../../scripts/checks/ambient-globals";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";
import { runLint, runtimeForFixture } from "./pm-notes-lint-command-support";

const ROOT = process.cwd();

const treeDigest = (root: string): string => {
  const hash = createHash("sha256");
  const walk = (path: string): void => {
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const next = join(path, entry.name);
      if (entry.isDirectory()) {
        walk(next);
        continue;
      }
      hash.update(entry.name);
      hash.update(readFileSync(next));
    }
  };
  walk(root);
  return hash.digest("hex");
};

const REPLAY_FIXTURES = [
  "valid/full-complete.yaml",
  "malformed/unparseable-orphaned-indentation.yaml.txt",
  "variant/unknown-compressed.yaml",
  "opaque/non-canonical-phase.yaml",
] as const;

describe("TC-LINT-009 zero verdict drift across replays", () => {
  for (const relative of REPLAY_FIXTURES) {
    test(`${relative} is byte-identical across three runs`, async () => {
      const fixture = runtimeForFixture(relative);
      try {
        const runs = [];
        for (let index = 0; index < 3; index += 1) {
          runs.push(await runLint(fixture.runtime, ["GH-179"]));
        }
        const [first] = runs;
        for (const run of runs) expect(run).toEqual(first as typeof run);
      } finally {
        fixture.cleanup();
      }
    });
  }

  test("throwing ambient clock/randomness stubs do not affect the verdict", async () => {
    const fixture = runtimeForFixture("valid/full-complete.yaml");
    const baseline = await runLint(fixture.runtime, ["GH-179"]);
    const originalNow = Date.now;
    const originalPerformanceNow = performance.now;
    const originalRandom = Math.random;
    const originalRandomUuid = globalThis.crypto.randomUUID;
    try {
      Date.now = () => {
        throw new Error("Date.now read");
      };
      performance.now = () => {
        throw new Error("performance.now read");
      };
      Math.random = () => {
        throw new Error("Math.random read");
      };
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        configurable: true,
        value: () => {
          throw new Error("randomUUID read");
        },
      });
      expect(await runLint(fixture.runtime, ["GH-179"])).toEqual(baseline);
    } finally {
      Date.now = originalNow;
      performance.now = originalPerformanceNow;
      Math.random = originalRandom;
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        configurable: true,
        value: originalRandomUuid,
      });
      fixture.cleanup();
    }
  });

  test("contracts and domain tiers contain no ambient reads", () => {
    expect(scan(ROOT)).toEqual([]);
  });
});

const recordingStore = (store: StateStorePort, recordings: string[]): StateStorePort => ({
  ...store,
  append: (...args) => {
    recordings.push("append");
    return store.append(...args);
  },
  replaceDocument: (...args) => {
    recordings.push("replaceDocument");
    return store.replaceDocument(...args);
  },
  acquireFence: (...args) => {
    recordings.push("acquireFence");
    return store.acquireFence(...args);
  },
  releaseFence: (...args) => {
    recordings.push("releaseFence");
    return store.releaseFence(...args);
  },
  recoverFence: (...args) => {
    recordings.push("recoverFence");
    return store.recoverFence(...args);
  },
  repairTornTail: (...args) => {
    recordings.push("repairTornTail");
    return store.repairTornTail(...args);
  },
  checkIntegrity: (...args) => {
    recordings.push("checkIntegrity");
    return store.checkIntegrity(...args);
  },
});

describe("TC-LINT-009 standalone lint writes nothing", () => {
  test("target bytes and the whole temp tree are byte-identical after lint", async () => {
    const fixture = runtimeForFixture("valid/full-complete.yaml");
    try {
      const before = treeDigest(fixture.root);
      const run = await runLint(fixture.runtime, ["GH-179"]);
      expect(run.exitCode).toBe(0);
      expect(treeDigest(fixture.root)).toBe(before);
    } finally {
      fixture.cleanup();
    }
  });

  test("a recording state edge observes zero writes, fences, or rebuilds", async () => {
    const root = makeTempRoot("gh179-lint-recording");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const recordings: string[] = [];
      const recording = recordingStore(store, recordings);
      const fixture = runtimeForFixture(
        "valid/full-complete.yaml",
        createRegistryLintReader(recording),
      );
      try {
        const before = treeDigest(fixture.root);
        const run = await runLint(fixture.runtime, ["GH-179", "--pm-notes", "--registry"]);
        expect(run.exitCode).toBe(0);
        expect(recordings).toEqual([]);
        expect(treeDigest(fixture.root)).toBe(before);
      } finally {
        fixture.cleanup();
      }
    } finally {
      removeRoot(root);
    }
  });

  test("a cache-writing control is caught by the digest (non-vacuity)", async () => {
    const fixture = runtimeForFixture("valid/full-complete.yaml");
    const cacheRoot = mkdtempSync(join(tmpdir(), "gh179-lint-cache-"));
    try {
      const before = treeDigest(fixture.root);
      const cacheBefore = treeDigest(cacheRoot);
      const writing = {
        ...fixture.runtime,
        readPmNotes: (changeRef: string) => {
          mkdirSync(join(cacheRoot, "cache"), { recursive: true });
          writeFileSync(join(cacheRoot, "cache", "verdict.json"), "{}\n");
          return fixture.runtime.readPmNotes(changeRef);
        },
      };
      await runLint(writing, ["GH-179"]);
      expect(treeDigest(fixture.root)).toBe(before);
      expect(treeDigest(cacheRoot)).not.toBe(cacheBefore);
    } finally {
      fixture.cleanup();
      rmSync(cacheRoot, { recursive: true, force: true });
    }
  });
});
