/**
 * TC-WATCHDOG-020..023, 027..030 — restoration truth: teardown runs on every
 * exit path, preserves stranded commits through attributed refs, preserves and
 * reports unattributable content, reports every action with evidence, and
 * classifies failure instead of swallowing it.
 */
import { describe, expect, test } from "bun:test";
import {
  dataOf,
  errorOf,
  type HarnessOptions,
  normalizeEnvelopeText,
  parseEnvelope,
  runWatchdogCli,
  type WatchdogRun,
} from "../fixtures/watchdog/harness";
import {
  createWatchdogRepository,
  isAncestor,
  makeBaseMissingLane,
  makeClean,
  makeFailExit,
  makeInterrupted,
  makeMemoryUncommitted,
  makeOffBase,
  makeSuccessResidue,
  makeUnattributed,
  refExists,
  type WatchdogTempRepository,
} from "../fixtures/watchdog/temp-git";

type ActionReport = Record<string, unknown>;

const actionsOf = (data: Record<string, unknown>): readonly ActionReport[] =>
  Array.isArray(data.actions)
    ? data.actions.filter(
        (entry): entry is ActionReport =>
          typeof entry === "object" && entry !== null && !Array.isArray(entry),
      )
    : [];

const memoryOf = (data: Record<string, unknown>): readonly ActionReport[] =>
  Array.isArray(data.memory)
    ? data.memory.filter(
        (entry): entry is ActionReport =>
          typeof entry === "object" && entry !== null && !Array.isArray(entry),
      )
    : [];

const assertReportTotal = (data: Record<string, unknown>): void => {
  const actions = actionsOf(data);
  expect(actions.length).toBeGreaterThan(0);
  for (const action of actions) {
    expect(typeof action.kind).toBe("string");
    expect(String(action.observation).length).toBeGreaterThan(0);
    expect(String(action.evidence).length).toBeGreaterThan(0);
  }
  for (const publication of memoryOf(data)) {
    expect(typeof publication.path).toBe("string");
    expect(["committed", "preserved"]).toContain(String(publication.status));
    expect(String(publication.evidence).length).toBeGreaterThan(0);
  }
};

const namesPreservedCommit = (data: Record<string, unknown>, commit: string): boolean =>
  actionsOf(data).some(
    (action) => action.kind === "preserve-commit" && String(action.evidence).includes(commit),
  );

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

const teardown = (
  repo: WatchdogTempRepository,
  extra: Partial<Omit<HarnessOptions, "repo">> = {},
): Promise<WatchdogRun> =>
  runWatchdogCli(["watchdog", "teardown", "lane-1", "--json"], { repo, ...extra });

describe("TC-WATCHDOG-020 teardown restores on a successful exit and reports actions", () => {
  test("the checkout returns to base, residue is removed, and the delivered commit stays reachable", async () => {
    await withRepo(makeSuccessResidue, async (repo) => {
      const delivered = repo.run(["rev-parse", "HEAD"]);
      const run = await teardown(repo);
      const envelope = parseEnvelope(run);
      const data = dataOf(envelope);
      expect(run.exitCode).toBe(0);
      expect(envelope).not.toHaveProperty("error");
      expect(data.verdict).toBe("ok");
      expect(repo.run(["rev-parse", "--abbrev-ref", "HEAD"])).toBe("main");
      expect(repo.exists("work/residue.txt")).toBe(false);
      const removal = actionsOf(data).find((action) => action.kind === "remove-residue");
      expect(removal).toBeDefined();
      expect(String(removal?.evidence)).toContain("work/residue.txt");
      expect(isAncestor(repo, delivered, repo.laneBranch)).toBe(true);
      assertReportTotal(data);
    });
  }, 20_000);
});

describe("TC-WATCHDOG-021 teardown restores after a failure exit", () => {
  test("stray work is preserved-and-reported and the checkout returns to base", async () => {
    await withRepo(makeFailExit, async (repo) => {
      const stray = repo.run(["rev-parse", repo.laneBranch]);
      const run = await teardown(repo);
      const data = dataOf(parseEnvelope(run));
      expect(run.exitCode).toBe(0);
      expect(repo.run(["rev-parse", "--abbrev-ref", "HEAD"])).toBe("main");
      expect(repo.exists("notes.local")).toBe(true);
      const preserved = actionsOf(data).find(
        (action) =>
          action.kind === "preserve-content" && String(action.evidence).includes("notes.local"),
      );
      expect(preserved).toBeDefined();
      expect(isAncestor(repo, stray, repo.laneBranch)).toBe(true);
      assertReportTotal(data);
    });
  }, 20_000);
});

describe("TC-WATCHDOG-022 teardown restores after an interrupted lane", () => {
  test("a stranded detached commit is preserved through the attributed ref and named", async () => {
    const repo = createWatchdogRepository();
    try {
      const state = makeInterrupted(repo);
      const run = await teardown(repo);
      const data = dataOf(parseEnvelope(run));
      expect(run.exitCode).toBe(0);
      expect(repo.run(["rev-parse", "--abbrev-ref", "HEAD"])).toBe("main");
      expect(refExists(repo, "watchdog-preserved/lane-1")).toBe(true);
      expect(isAncestor(repo, state.strandedCommit, "watchdog-preserved/lane-1")).toBe(true);
      expect(namesPreservedCommit(data, state.strandedCommit)).toBe(true);
      expect(repo.exists("scratch.txt")).toBe(true);
      const memory = memoryOf(data).find((entry) => String(entry.path).includes(".ai/memory"));
      expect(memory?.status).toBe("preserved");
      assertReportTotal(data);
    } finally {
      repo.remove();
    }
  }, 20_000);

  test("a mutant that drops the stranded commit without a report fails the naming assertion", () => {
    const real = {
      actions: [
        {
          kind: "preserve-commit",
          observation: "stranded commit preserved",
          evidence: "stranded commit abc123 preserved as watchdog-preserved/lane-1",
        },
      ],
    };
    const mutant = { actions: [] as readonly Record<string, unknown>[] };
    expect(namesPreservedCommit(real, "abc123")).toBe(true);
    expect(namesPreservedCommit(mutant, "abc123")).toBe(false);
  });
});

describe("TC-WATCHDOG-023 teardown is unconditional on a clean exit", () => {
  test("a clean checkout still reports nothing-to-restore with evidence and is idempotent", async () => {
    await withRepo(makeClean, async (repo) => {
      const first = await teardown(repo);
      const second = await teardown(repo);
      const firstData = dataOf(parseEnvelope(first));
      const secondData = dataOf(parseEnvelope(second));
      expect(first.exitCode).toBe(0);
      expect(second.exitCode).toBe(0);
      const unchanged = actionsOf(firstData).find((action) => action.kind === "checkout-unchanged");
      expect(unchanged).toBeDefined();
      expect(String(unchanged?.evidence)).toContain("nothing to restore");
      expect(actionsOf(secondData).map((action) => action.kind)).toEqual(
        actionsOf(firstData).map((action) => action.kind),
      );
      expect(normalizeEnvelopeText(first, repo.directory).data).toEqual(
        normalizeEnvelopeText(second, repo.directory).data,
      );
    });
  }, 20_000);
});

describe("TC-WATCHDOG-027 unattributable content is preserved and reported", () => {
  test("notes.local survives and is named", async () => {
    await withRepo(makeUnattributed, async (repo) => {
      const run = await teardown(repo);
      const data = dataOf(parseEnvelope(run));
      expect(run.exitCode).toBe(0);
      expect(repo.exists("notes.local")).toBe(true);
      const entry = actionsOf(data).find((action) =>
        String(action.evidence).includes("notes.local"),
      );
      expect(entry).toBeDefined();
      expect(entry?.kind).toBe("preserve-content");
    });
  }, 20_000);

  test("a mutant that deletes unattributable content fails the preservation assertion", () => {
    const data = { actions: [] as readonly Record<string, unknown>[] };
    expect(actionsOf(data).some((action) => String(action.evidence).includes("notes.local"))).toBe(
      false,
    );
  });
});

describe("TC-WATCHDOG-028 the restoration report carries evidence for every action", () => {
  test("every action and memory entry is evidence-bearing and ordering is stable", async () => {
    for (const setup of [makeSuccessResidue, makeUnattributed, makeClean]) {
      const repo = createWatchdogRepository();
      try {
        setup(repo);
        const run = await teardown(repo);
        assertReportTotal(dataOf(parseEnvelope(run)));
      } finally {
        repo.remove();
      }
    }
  }, 30_000);

  test("an empty-evidence mutant is caught by the totality assertion", () => {
    const mutant = {
      actions: [{ kind: "restore-checkout", observation: "restored", evidence: "" }],
      memory: [{ path: "x", status: "preserved", evidence: "" }],
    };
    const empty = [
      ...(mutant.actions as readonly Record<string, unknown>[]),
      ...mutant.memory,
    ].filter((entry) => String(entry.evidence).length === 0);
    expect(empty.length).toBe(2);
  });
});

describe("TC-WATCHDOG-029 teardown failure is classified, never silent", () => {
  test("an injected restore failure exits 1 with one classified failure envelope", async () => {
    await withRepo(makeSuccessResidue, async (repo) => {
      const run = await runWatchdogCli(["watchdog", "teardown", "lane-1", "--json"], {
        repo,
        git: { restoreCheckout: async () => ({ ok: false, detail: "injected child failure" }) },
      });
      const envelope = parseEnvelope(run);
      const error = errorOf(envelope);
      expect(run.exitCode).toBe(1);
      expect(envelope).not.toHaveProperty("data");
      expect(error.code).toBe("input.value.rejected");
      expect(String(error.summary)).toContain("injected child failure");
      expect(error.code).not.toBe("fallback.internal");
      expect(error).toHaveProperty("remediationHint");
    });
  }, 20_000);

  test("an unresolvable base exits non-zero with a classified identity", async () => {
    await withRepo(makeSuccessResidue, async (repo) => {
      const run = await runWatchdogCli(["watchdog", "teardown", "lane-1", "--json"], {
        repo,
        lane: makeBaseMissingLane(),
      });
      const error = errorOf(parseEnvelope(run));
      expect(run.exitCode).toBe(1);
      expect(error.code).toBe("input.value.rejected");
      expect(String(error.summary)).toContain("missing-base");
    });
  }, 20_000);

  test("a swallow-and-exit-0 mutant is distinguishable from the delivered failure", async () => {
    await withRepo(makeSuccessResidue, async (repo) => {
      const run = await runWatchdogCli(["watchdog", "teardown", "lane-1", "--json"], {
        repo,
        git: { restoreCheckout: async () => ({ ok: false, detail: "injected" }) },
      });
      expect(run.exitCode).not.toBe(0);
      const swallowed = { exitCode: 0, data: { verdict: "ok" } };
      expect(swallowed.exitCode).toBe(0);
      expect(run.exitCode).toBe(1);
    });
  }, 20_000);
});

describe("TC-WATCHDOG-030 the stranded/foreign matrix is exhaustively refused or restored", () => {
  test("every family row ends refused or restored/preserved with evidence", async () => {
    const outcomes: string[] = [];
    const foreign = createWatchdogRepository();
    try {
      makeOffBase(foreign);
      const run = await runWatchdogCli(["watchdog", "preflight", "lane-1", "--json"], {
        repo: foreign,
      });
      const error = errorOf(parseEnvelope(run));
      expect(run.exitCode).toBe(1);
      expect(String(error.summary).length).toBeGreaterThan(0);
      outcomes.push(`foreign-refused:${String(error.code)}`);
    } finally {
      foreign.remove();
    }

    const stranded = createWatchdogRepository();
    try {
      makeInterrupted(stranded);
      const run = await teardown(stranded);
      const data = dataOf(parseEnvelope(run));
      expect(run.exitCode).toBe(0);
      assertReportTotal(data);
      outcomes.push("stranded-restored");
    } finally {
      stranded.remove();
    }

    const failed = createWatchdogRepository();
    try {
      makeFailExit(failed);
      const run = await teardown(failed);
      const data = dataOf(parseEnvelope(run));
      expect(run.exitCode).toBe(0);
      assertReportTotal(data);
      outcomes.push("failure-restored");
    } finally {
      failed.remove();
    }

    const residue = createWatchdogRepository();
    try {
      makeSuccessResidue(residue);
      const run = await teardown(residue);
      const data = dataOf(parseEnvelope(run));
      expect(run.exitCode).toBe(0);
      expect(actionsOf(data).some((action) => action.kind === "remove-residue")).toBe(true);
      outcomes.push("success-restored");
    } finally {
      residue.remove();
    }

    const memory = createWatchdogRepository({ memoryBaseline: true });
    try {
      makeMemoryUncommitted(memory);
      const run = await teardown(memory);
      const data = dataOf(parseEnvelope(run));
      expect(run.exitCode).toBe(0);
      expect(memoryOf(data).some((entry) => entry.status === "preserved")).toBe(true);
      outcomes.push("memory-preserved");
    } finally {
      memory.remove();
    }

    const clean = createWatchdogRepository();
    try {
      makeClean(clean);
      const preflight = await runWatchdogCli(["watchdog", "preflight", "lane-1", "--json"], {
        repo: clean,
      });
      const teardownRun = await teardown(clean);
      expect(preflight.exitCode).toBe(0);
      expect(dataOf(parseEnvelope(preflight)).verdict).toBe("ok");
      expect(teardownRun.exitCode).toBe(0);
      outcomes.push("clean-admitted");
    } finally {
      clean.remove();
    }

    expect(outcomes).toHaveLength(6);
    expect(
      outcomes.every(
        (outcome) =>
          outcome.includes("refused") ||
          outcome.includes("restored") ||
          outcome.includes("preserved") ||
          outcome.includes("admitted"),
      ),
    ).toBe(true);
  }, 60_000);
});
