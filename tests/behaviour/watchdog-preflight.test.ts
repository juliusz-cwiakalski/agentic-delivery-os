/**
 * TC-WATCHDOG-010..015 — admission truth: dirty and non-base checkouts are
 * refused with named evidence and no mutation, a clean on-base checkout is
 * admitted, preflight is read-only on every outcome, and unevaluable or torn
 * facts fail closed.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import type { WatchdogGitFacts } from "../../packages/core/src/contracts/index";
import { WATCHDOG_ERROR_CODES } from "../../packages/core/src/contracts/index";
import {
  dataOf,
  errorOf,
  mutationCalls,
  parseEnvelope,
  runWatchdogCli,
} from "../fixtures/watchdog/harness";
import {
  createWatchdogRepository,
  makeBaseMissingLane,
  makeClean,
  makeDirty,
  makeForeignWorktree,
  makeOffBase,
  snapshotCheckout,
  type WatchdogTempRepository,
} from "../fixtures/watchdog/temp-git";

const withRepo = async (
  setup: (repo: WatchdogTempRepository) => void,
  run: (repo: WatchdogTempRepository) => Promise<void>,
): Promise<void> => {
  const repo = createWatchdogRepository();
  try {
    setup(repo);
    await run(repo);
  } finally {
    repo.remove();
  }
};

describe("TC-WATCHDOG-010 dirty checkout is refused with evidence and no mutation", () => {
  test("a dirty checkout exits 1 with watchdog.checkout-dirty and evidence", async () => {
    await withRepo(makeDirty, async (repo) => {
      const before = snapshotCheckout(repo);
      const run = await runWatchdogCli(["watchdog", "preflight", "lane-1", "--json"], { repo });
      const envelope = parseEnvelope(run);
      expect(run.exitCode).toBe(1);
      expect(envelope.exitCode).toBe(1);
      expect(envelope).not.toHaveProperty("data");
      const error = errorOf(envelope);
      expect(error.code).toBe("watchdog.checkout-dirty");
      expect(error.category).toBe("user");
      expect(error.retryable).toBe(false);
      expect(error.consequence).toBe("not_landed");
      expect(String(error.remediationHint).length).toBeGreaterThan(0);
      expect(String(error.summary)).toContain("dirty");
      expect(String(error.summary).length).toBeGreaterThan(0);
      expect(snapshotCheckout(repo)).toEqual(before);
    });
  });

  test("text mode repeats the evidence and does not emit an envelope", async () => {
    await withRepo(makeDirty, async (repo) => {
      const run = await runWatchdogCli(["watchdog", "preflight", "lane-1"], { repo });
      expect(run.exitCode).toBe(1);
      expect(run.stdout).toBe("");
      expect(run.stderr).toContain("watchdog.checkout-dirty");
      expect(run.stderr).toContain("dirty");
      expect(run.stderr).not.toContain("schemaVersion");
    });
  });

  test("a clean control does not produce the dirty identity", async () => {
    await withRepo(makeClean, async (repo) => {
      const run = await runWatchdogCli(["watchdog", "preflight", "lane-1", "--json"], { repo });
      expect(parseEnvelope(run)).not.toHaveProperty("error");
      expect(run.exitCode).toBe(0);
    });
  });
});

describe("TC-WATCHDOG-011 non-base checkout is refused with expected-vs-actual evidence", () => {
  test("an off-base branch names the expected base and the actual branch", async () => {
    await withRepo(makeOffBase, async (repo) => {
      const run = await runWatchdogCli(["watchdog", "preflight", "lane-1", "--json"], { repo });
      const error = errorOf(parseEnvelope(run));
      expect(run.exitCode).toBe(1);
      expect(error.code).toBe("watchdog.checkout-non-base");
      expect(String(error.summary)).toContain("expected main");
      expect(String(error.summary)).toContain("chore/foreign");
      expect(repo.run(["rev-parse", "--abbrev-ref", "HEAD"])).toBe("chore/foreign");
    });
  });

  test("a real foreign worktree is refused without being mutated", async () => {
    const repo = createWatchdogRepository();
    try {
      const worktree = makeForeignWorktree(repo);
      const before = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: worktree.directory,
        encoding: "utf8",
      }).trim();
      const run = await runWatchdogCli(["watchdog", "preflight", "lane-1", "--json"], {
        repo: worktree.directory,
      });
      const error = errorOf(parseEnvelope(run));
      expect(run.exitCode).toBe(1);
      expect(error.code).toBe("watchdog.checkout-non-base");
      expect(String(error.summary)).toContain("expected main");
      expect(String(error.summary)).toContain(worktree.branch);
      const after = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
        cwd: worktree.directory,
        encoding: "utf8",
      }).trim();
      expect(after).toBe(before);
    } finally {
      repo.remove();
    }
  });

  test("an on-base control is admitted, proving the refusal is not unconditional", async () => {
    await withRepo(makeClean, async (repo) => {
      const run = await runWatchdogCli(["watchdog", "preflight", "lane-1", "--json"], { repo });
      expect(run.exitCode).toBe(0);
      expect(dataOf(parseEnvelope(run)).verdict).toBe("ok");
    });
  });
});

describe("TC-WATCHDOG-012 clean on-base checkout is admitted", () => {
  test("the success envelope is exclusive and carries verdict and evidence", async () => {
    await withRepo(makeClean, async (repo) => {
      const before = snapshotCheckout(repo);
      const run = await runWatchdogCli(["watchdog", "preflight", "lane-1", "--json"], { repo });
      const envelope = parseEnvelope(run);
      expect(run.exitCode).toBe(0);
      expect(envelope).not.toHaveProperty("error");
      for (const key of ["schemaVersion", "runId", "exitCode", "timing", "data"]) {
        expect(envelope).toHaveProperty(key);
      }
      const data = dataOf(envelope);
      expect(data.verdict).toBe("ok");
      expect(typeof data.evidence).toBe("string");
      expect(String(data.evidence)).toContain("main");
      expect(snapshotCheckout(repo)).toEqual(before);
    });
  });
});

describe("TC-WATCHDOG-013 preflight is read-only on every outcome", () => {
  test("clean, dirty, off-base and torn outcomes record only read operations", async () => {
    const scenarios: readonly {
      readonly name: string;
      readonly setup: (repo: WatchdogTempRepository) => void;
    }[] = [
      { name: "clean", setup: makeClean },
      { name: "dirty", setup: makeDirty },
      { name: "off-base", setup: makeOffBase },
    ];
    for (const scenario of scenarios) {
      const repo = createWatchdogRepository();
      try {
        scenario.setup(repo);
        const before = snapshotCheckout(repo);
        const run = await runWatchdogCli(["watchdog", "preflight", "lane-1", "--json"], { repo });
        expect(mutationCalls(run.runtimeCalls), scenario.name).toEqual([]);
        expect(
          run.runtimeCalls.every(
            (call) => call.startsWith("readLane:") || call === "git.readCheckoutFacts",
          ),
        ).toBe(true);
        expect(snapshotCheckout(repo), scenario.name).toEqual(before);
      } finally {
        repo.remove();
      }
    }
    const repo = createWatchdogRepository();
    try {
      const run = await runWatchdogCli(["watchdog", "preflight", "lane-1", "--json"], {
        repo,
        laneRead: () => ({ ok: false, reason: "torn" }),
      });
      expect(mutationCalls(run.runtimeCalls)).toEqual([]);
    } finally {
      repo.remove();
    }
  }, 30_000);

  test("a mutant runtime that restores during preflight is caught by the call log", async () => {
    const repo = createWatchdogRepository();
    try {
      makeDirty(repo);
      const run = await runWatchdogCli(["watchdog", "preflight", "lane-1", "--json"], { repo });
      const mutantLog = [...run.runtimeCalls, "git.restoreCheckout"];
      expect(mutationCalls(mutantLog)).toEqual(["git.restoreCheckout"]);
    } finally {
      repo.remove();
    }
  });
});

describe("TC-WATCHDOG-014 unevaluable checkout fails closed", () => {
  test("a missing base ref classifies input.value.rejected and is never admitted", async () => {
    await withRepo(
      () => {},
      async (repo) => {
        const run = await runWatchdogCli(["watchdog", "preflight", "lane-1", "--json"], {
          repo,
          lane: makeBaseMissingLane(),
        });
        const envelope = parseEnvelope(run);
        const error = errorOf(envelope);
        expect(run.exitCode).toBe(1);
        expect(envelope).not.toHaveProperty("data");
        expect(error.code).toBe("input.value.rejected");
        expect(String(error.summary)).toContain("missing-base");
        expect(String(error.summary)).not.toBe("");
      },
    );
  });

  test("an injected read failure fails closed and names the unevaluable fact", async () => {
    await withRepo(
      () => {},
      async (repo) => {
        const run = await runWatchdogCli(["watchdog", "preflight", "lane-1", "--json"], {
          repo,
          git: {
            readCheckoutFacts: async () => ({
              kind: "unreadable",
              detail: "injected read failure",
            }),
          },
        });
        const error = errorOf(parseEnvelope(run));
        expect(run.exitCode).toBe(1);
        expect(error.code).toBe("input.value.rejected");
        expect(String(error.summary)).toContain("injected read failure");
      },
    );
  });
});

describe("TC-WATCHDOG-015 torn or impossible lane facts are classified, never clean", () => {
  test("a torn lane record classifies state.store.torn", async () => {
    await withRepo(
      () => {},
      async (repo) => {
        const run = await runWatchdogCli(["watchdog", "preflight", "lane-1", "--json"], {
          repo,
          laneRead: () => ({ ok: false, reason: "torn" }),
        });
        const error = errorOf(parseEnvelope(run));
        expect(run.exitCode).toBe(2);
        expect(error.code).toBe("state.store.torn");
        expect(String(error.summary).length).toBeGreaterThan(0);
      },
    );
  });

  test("contradictory checkout facts are classified, non-zero, and add no watchdog identity", async () => {
    const contradictory: WatchdogGitFacts = {
      kind: "facts",
      baseResolves: true,
      branch: "main",
      detached: false,
      head: "0000000000000000000000000000000000000000",
      clean: true,
      entries: [{ path: "README.md", change: "modified" }],
      memory: [],
    };
    await withRepo(
      () => {},
      async (repo) => {
        const run = await runWatchdogCli(["watchdog", "preflight", "lane-1", "--json"], {
          repo,
          git: { readCheckoutFacts: async () => contradictory },
        });
        const envelope = parseEnvelope(run);
        const error = errorOf(envelope);
        expect(run.exitCode).toBe(1);
        expect(error.code).toBe("input.value.rejected");
        expect(String(error.summary)).toContain("contradictory");
        expect(WATCHDOG_ERROR_CODES as readonly string[]).not.toContain(String(error.code));
        expect(envelope).not.toHaveProperty("data");
      },
    );
  });
});
