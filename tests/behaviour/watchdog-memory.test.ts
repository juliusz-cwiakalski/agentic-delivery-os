/**
 * TC-WATCHDOG-024..026 — memory-publish verification and preservation: a
 * committed publication is reported committed without losing its blob, an
 * uncommitted publication is preserved byte-identically and reported, and no
 * teardown path deletes or clobbers a `.ai/memory` path.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  dataOf,
  destructiveMemoryGitCalls,
  memoryPathsOf,
  parseEnvelope,
  runWatchdogCli,
  type WatchdogRun,
} from "../fixtures/watchdog/harness";
import {
  createWatchdogRepository,
  MEMORY_PUBLICATION,
  MEMORY_UNTRACKED,
  type WatchdogTempRepository,
} from "../fixtures/watchdog/temp-git";

const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

const memoryReport = (data: Record<string, unknown>): readonly Record<string, unknown>[] =>
  Array.isArray(data.memory)
    ? data.memory.filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null && !Array.isArray(entry),
      )
    : [];

const teardown = (repo: WatchdogTempRepository): Promise<WatchdogRun> =>
  runWatchdogCli(["watchdog", "teardown", "lane-1", "--json"], { repo });

const memoryStatus = (repo: WatchdogTempRepository): string =>
  repo.run(["status", "--porcelain", "--", ".ai/memory"]);

const indexState = (repo: WatchdogTempRepository): string =>
  repo.run(["diff", "--cached", "--name-only", "--", ".ai/memory"]);

describe("TC-WATCHDOG-024 a committed publication is reported committed", () => {
  test("the report names the file and commit, and the committed blob stays byte-identical", async () => {
    const repo = createWatchdogRepository();
    try {
      const commit = repo.commitFile(
        MEMORY_PUBLICATION,
        "committed publication\n",
        "commit memory publication",
      );
      const blobBefore = repo.run(["rev-parse", `${commit}:${MEMORY_PUBLICATION}`]);
      const run = await teardown(repo);
      const data = dataOf(parseEnvelope(run));
      expect(run.exitCode).toBe(0);
      const entries = memoryReport(data);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.path).toBe(MEMORY_PUBLICATION);
      expect(entries[0]?.status).toBe("committed");
      expect(String(entries[0]?.evidence)).toContain(MEMORY_PUBLICATION);
      expect(String(entries[0]?.evidence)).toContain(commit);
      expect(repo.run(["rev-parse", `${commit}:${MEMORY_PUBLICATION}`])).toBe(blobBefore);
    } finally {
      repo.remove();
    }
  });
});

describe("TC-WATCHDOG-025 an uncommitted publication is preserved byte-identically", () => {
  test("modified and untracked publications survive with identical bytes and are reported preserved", async () => {
    const repo = createWatchdogRepository({ memoryBaseline: true });
    try {
      repo.write(MEMORY_PUBLICATION, "modified publication with canary bytes\n");
      repo.write(MEMORY_UNTRACKED, "new untracked publication with canary bytes\n");
      const before = {
        tracked: {
          text: repo.read(MEMORY_PUBLICATION),
          sha: sha256(repo.read(MEMORY_PUBLICATION)),
        },
        untracked: { text: repo.read(MEMORY_UNTRACKED), sha: sha256(repo.read(MEMORY_UNTRACKED)) },
        status: memoryStatus(repo),
        index: indexState(repo),
      };
      const run = await teardown(repo);
      const data = dataOf(parseEnvelope(run));
      expect(run.exitCode).toBe(0);
      expect(repo.exists(MEMORY_PUBLICATION)).toBe(true);
      expect(repo.exists(MEMORY_UNTRACKED)).toBe(true);
      expect(repo.read(MEMORY_PUBLICATION)).toBe(before.tracked.text);
      expect(repo.read(MEMORY_UNTRACKED)).toBe(before.untracked.text);
      expect(sha256(repo.read(MEMORY_PUBLICATION))).toBe(before.tracked.sha);
      expect(sha256(repo.read(MEMORY_UNTRACKED))).toBe(before.untracked.sha);
      expect(memoryStatus(repo)).toBe(before.status);
      expect(indexState(repo)).toBe(before.index);
      const preserved = memoryReport(data).filter((entry) => entry.status === "preserved");
      expect(preserved.map((entry) => entry.path).sort()).toEqual(
        [MEMORY_PUBLICATION, MEMORY_UNTRACKED].sort(),
      );
      for (const entry of preserved) {
        expect(String(entry.evidence)).toContain(String(entry.path));
      }
    } finally {
      repo.remove();
    }
  });
});

describe("TC-WATCHDOG-026 teardown never deletes or clobbers uncommitted memory", () => {
  test("four variants keep bytes, index state, and existence; no destructive git op targets .ai/memory", async () => {
    const variants: readonly {
      readonly name: string;
      readonly setup: (repo: WatchdogTempRepository) => void;
      readonly path: string;
    }[] = [
      {
        name: "modified tracked",
        setup: (repo) => repo.write(MEMORY_PUBLICATION, "modified variant\n"),
        path: MEMORY_PUBLICATION,
      },
      {
        name: "untracked",
        setup: (repo) => repo.write(MEMORY_UNTRACKED, "untracked variant\n"),
        path: MEMORY_UNTRACKED,
      },
      {
        name: "staged",
        setup: (repo) => {
          repo.write(MEMORY_PUBLICATION, "staged variant\n");
          repo.run(["add", "--", MEMORY_PUBLICATION]);
        },
        path: MEMORY_PUBLICATION,
      },
      {
        name: "residue-resembling path",
        setup: (repo) =>
          repo.write(
            ".ai/memory/agents/watchdog-fixture/work/residue.txt",
            "memory path resembling lane residue\n",
          ),
        path: ".ai/memory/agents/watchdog-fixture/work/residue.txt",
      },
    ];

    for (const variant of variants) {
      const repo = createWatchdogRepository({ memoryBaseline: true });
      try {
        variant.setup(repo);
        const before = {
          text: repo.read(variant.path),
          status: memoryStatus(repo),
          index: indexState(repo),
        };
        const run = await teardown(repo);
        expect(run.exitCode, variant.name).toBe(0);
        expect(repo.exists(variant.path), variant.name).toBe(true);
        expect(repo.read(variant.path), variant.name).toBe(before.text);
        expect(memoryStatus(repo), variant.name).toBe(before.status);
        expect(indexState(repo), variant.name).toBe(before.index);
        expect(destructiveMemoryGitCalls(run.gitCalls), variant.name).toEqual([]);
        expect(
          memoryPathsOf(run.gitCalls).every(
            (path) => path === ".ai/memory" || path.startsWith(".ai/memory/"),
          ),
        ).toBe(true);
      } finally {
        repo.remove();
      }
    }
  }, 45_000);

  test("a destructive mutant that reverts .ai/memory is caught by a byte comparison", () => {
    const repo = createWatchdogRepository({ memoryBaseline: true });
    try {
      repo.write(MEMORY_PUBLICATION, "canary content that must survive\n");
      const before = repo.read(MEMORY_PUBLICATION);
      repo.run(["checkout", "--", MEMORY_PUBLICATION]);
      const after = repo.read(MEMORY_PUBLICATION);
      expect(before).not.toBe(after);
      expect(sha256(before)).not.toBe(sha256(after));
    } finally {
      repo.remove();
    }
  });
});
