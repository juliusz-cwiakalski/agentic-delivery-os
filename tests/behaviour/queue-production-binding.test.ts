/**
 * GH-273 — production-composition regression suite.
 *
 * Every scenario composes the real `createProductionComposer` program over a
 * real temporary checkout whose `.git` metadata is fabricated on disk and
 * injects only the origin remote. The harness exposes no root seam, so the
 * recorded root is always the production derivation's own resolution
 * (spec DEC-2, DEC-5; test plan TR-1/TR-2).
 *
 * TC-BIND-001..TC-BIND-010, TC-BIND-017.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, rmSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { readDispatchIdentityMarkerText } from "../../packages/adapters/src/file/dispatch-identity";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import { claimQueueLease, readQueueFold } from "../../packages/core/src/app/queue";
import {
  QUEUE_ENTRY_RECORD_KIND,
  type QueueEntryRecord,
} from "../../packages/core/src/contracts/index";
import {
  normalizeRepositoryRemote,
  resolveDispatchIdentity,
} from "../../packages/core/src/domain/dispatch-identity";
import { normalizeRepositoryKey } from "../../packages/core/src/domain/queue-graph";
import {
  evaluateQueueReadiness,
  type QueueSchedulerFacts,
} from "../../packages/core/src/domain/queue-readiness";
import {
  type Checkout,
  createProductionQueueHarness,
  makeCheckout,
  makeHarnessHome,
  makeLinkedWorktree,
  makeNestedDirectory,
  makeNonCheckoutDirectory,
  originOfConfig,
  type ProductionQueueHarness,
  removeHome,
  setCheckoutOrigin,
} from "../fixtures/queue/production/harness";

const ORIGIN = "https://github.com/owner/repo.git";
const KEY = "github.com/owner/repo";
const REF = "GH-273";
const NOW_ISO = "2026-11-08T10:00:00.000Z";
const NOW_MS = Date.parse(NOW_ISO);

/** The pre-fix failure triple the ticket reports (AC-F6-4, encoded explicitly). */
const PRE_FIX_FAILURE_TRIPLE = {
  addRefusalCode: "input.value.rejected",
  entryCount: 0,
  dispatchErrorCode: "queue.entry.unobserved",
} as const;

type Envelope = {
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string };
};

const envelopeOf = (run: { readonly envelope?: Record<string, unknown> }): Envelope | undefined =>
  run.envelope as Envelope | undefined;

const dataOf = (run: { readonly envelope?: Record<string, unknown> }) =>
  envelopeOf(run)?.data as Record<string, unknown> | undefined;

const errorOf = (run: { readonly envelope?: Record<string, unknown> }) =>
  envelopeOf(run)?.error as { readonly code?: string; readonly summary?: string } | undefined;

const entryOf = (run: { readonly envelope?: Record<string, unknown> }) => {
  const entry = dataOf(run)?.entry as Record<string, unknown> | undefined;
  if (entry === undefined) throw new Error("the mutation envelope carries no entry projection");
  return entry;
};

/** The verified record for a ref, or a loud failure. */
const recordOf = (harness: ProductionQueueHarness, ref = REF): QueueEntryRecord => {
  const found = harness.ledgerEntries().find((record) => record.ref === ref);
  if (found === undefined) throw new Error(`no recorded queue entry for ${ref}`);
  return found;
};

/** One-sided records across the whole ledger (must always be zero). */
const oneSidedCount = (harness: ProductionQueueHarness): number =>
  harness
    .ledgerEntries()
    .filter((record) => (record.repository === undefined) !== (record.repositoryRoot === undefined))
    .length;

const withHarness = async (
  label: string,
  workingDirectory: string,
  originUrl: string | undefined,
  body: (harness: ProductionQueueHarness) => Promise<void>,
): Promise<void> => {
  const harness = createProductionQueueHarness({ label, workingDirectory, originUrl });
  try {
    await body(harness);
  } finally {
    harness.dispose();
  }
};

/** The production fact surface the queue composition supplies (no injected facts). */
const productionFacts = (harness: ProductionQueueHarness): QueueSchedulerFacts => {
  const fold = readQueueFold(harness.store);
  if (!fold.ok) throw new Error(`queue fold failed: ${fold.code}`);
  return {
    nowIso: NOW_ISO,
    nowMs: NOW_MS,
    fold: fold.value,
    plans: {},
    workItems: {},
    ci: {},
    provider: { state: "unavailable", reason: "not-configured" },
    leases: [],
    parkEvaluations: {},
    parkRecords: [],
    close: {},
    deploy: { expectations: {}, verdicts: {} },
    runner: "runner-a",
  };
};

/**
 * The declared degraded state of an unbound entry: the repository-dependent
 * readiness condition is `unknown` with the addressing-unresolved evidence, and
 * the domain's claim precondition carries the repository-binding-unresolved
 * blocking detail. The production fact source has no work-item facts, so the
 * schedule projects `held/dependency-unobserved` before the repo-free step; the
 * two binding tokens are therefore asserted at the layers that emit them.
 */
const expectUnboundReadiness = (harness: ProductionQueueHarness, cell: string): void => {
  const readiness = evaluateQueueReadiness(productionFacts(harness), REF);
  const repoFree = readiness.conditions.find((condition) => condition.id === "repo-free");
  expect(repoFree?.state, `${cell}: repo-free is unknown`).toBe("unknown");
  expect(repoFree?.evidence[0]?.source, `${cell}: evidence source`).toBe("repository-binding");
  expect(repoFree?.evidence[0]?.reason, `${cell}: evidence reason`).toBe("addressing-unresolved");

  const claim = claimQueueLease(harness.store, {
    ref: REF,
    holder: "gh273-probe",
    runner: "runner-a",
    weightClass: "standard",
    nowIso: NOW_ISO,
    nowMs: NOW_MS,
    fenceToken: "gh273-probe-fence",
  });
  expect(claim.ok, `${cell}: an unbound entry is not claimable`).toBe(false);
  if (claim.ok) return;
  expect(claim.code, `${cell}: claim blocking code`).toBe("queue.precondition.unmet");
  expect("detail" in claim ? claim.detail : undefined, `${cell}: claim blocking detail`).toBe(
    "repository-binding-unresolved",
  );
};

const expectUnboundEntry = (run: { readonly envelope?: Record<string, unknown> }, cell: string) => {
  const entry = entryOf(run);
  expect(entry.repository, `${cell}: no root-only record carries a key`).toBeUndefined();
  expect(entry.state, `${cell}: the entry is never ready`).not.toBe("ready");
};

describe("TC-BIND-001 production add records the atomic pair", () => {
  test("TC-BIND-001 add is added, the ledger carries the pair, replay is noop", async () => {
    const root = makeHarnessHome("tc001-root");
    const checkout = makeCheckout(root, "checkout", ORIGIN);
    try {
      await withHarness("tc001", checkout.directory, ORIGIN, async (harness) => {
        const added = await harness.run(["queue", "add", REF, "--json"]);
        expect(added.exitCode, "first add exits 0").toBe(0);
        expect(dataOf(added)?.result, "first add is added").toBe("added");
        expect(entryOf(added).repository, "the envelope projects the key").toBe(KEY);
        expect(
          Object.keys(entryOf(added)),
          "the envelope never projects the recording root",
        ).not.toContain("repositoryRoot");

        const record = recordOf(harness);
        expect(record.repository, "the recorded key").toBe(KEY);
        expect(record.repositoryRoot, "the recorded root is the checkout root").toBe(
          checkout.directory,
        );
        expect(harness.ledgerEntries(), "one entry record for the ref").toHaveLength(1);
        expect(oneSidedCount(harness), "no one-sided record exists").toBe(0);

        const replay = await harness.run(["queue", "add", REF, "--json"]);
        expect(replay.exitCode, "replay exits 0").toBe(0);
        expect(dataOf(replay)?.result, "replay is noop").toBe("noop");
        const replayed = recordOf(harness);
        expect(replayed.repository, "the replayed key is unchanged").toBe(record.repository);
        expect(replayed.repositoryRoot, "the replayed root is unchanged").toBe(
          record.repositoryRoot,
        );
      });
    } finally {
      removeHome(root);
    }
  });
});

describe("TC-BIND-002 binding totality across the cause-labelled matrix", () => {
  test("TC-BIND-002 present cell records both fields", async () => {
    const root = makeHarnessHome("tc002-present-root");
    const checkout = makeCheckout(root, "checkout", ORIGIN);
    try {
      await withHarness("tc002-present", checkout.directory, ORIGIN, async (harness) => {
        const added = await harness.run(["queue", "add", REF, "--json"]);
        expect(added.exitCode, "cell=present: exit 0").toBe(0);
        expect(dataOf(added)?.result, "cell=present: added").toBe("added");
        const entry = entryOf(added);
        expect(entry.repository, "cell=present: key present").toBe(KEY);
        const record = recordOf(harness);
        expect(record.repository, "cell=present: recorded key").toBe(KEY);
        expect(record.repositoryRoot, "cell=present: recorded root").toBe(checkout.directory);
        expect(oneSidedCount(harness), "cell=present: no one-sided record").toBe(0);

        const readiness = evaluateQueueReadiness(productionFacts(harness), REF);
        const repoFree = readiness.conditions.find((condition) => condition.id === "repo-free");
        expect(repoFree?.state, "cell=present: repo-free is evaluable").toBe("satisfied");
      });
    } finally {
      removeHome(root);
    }
  });

  test("TC-BIND-002 target-unresolved cell emits no binding for a non-GitHub remote", async () => {
    const gitlab = "https://gitlab.com/owner/repo.git";
    expect(normalizeRepositoryKey(gitlab), "the key normalizer accepts the GitLab remote").toBe(
      "gitlab.com/owner/repo",
    );
    // The GitHub target gate, not key normalization, is what excludes it.
    const root = makeHarnessHome("tc002-target-root");
    const checkout = makeCheckout(root, "checkout", gitlab);
    try {
      await withHarness("tc002-target", checkout.directory, gitlab, async (harness) => {
        const added = await harness.run(["queue", "add", REF, "--json"]);
        expect(added.exitCode, "cell=target-unresolved: exit 0").toBe(0);
        expect(dataOf(added)?.result, "cell=target-unresolved: added").toBe("added");
        expectUnboundEntry(added, "cell=target-unresolved");
        const record = recordOf(harness);
        expect(record.repository, "cell=target-unresolved: no root-only record").toBeUndefined();
        expect(
          record.repositoryRoot,
          "cell=target-unresolved: no root-only record",
        ).toBeUndefined();
        expect(oneSidedCount(harness), "cell=target-unresolved: no one-sided record").toBe(0);
        expectUnboundReadiness(harness, "cell=target-unresolved");
      });
    } finally {
      removeHome(root);
    }
  });

  test("TC-BIND-002 key-unresolved cell emits no binding for non-normalizable origins", async () => {
    for (const origin of ["not-a-url", "./repo"] as const) {
      expect(
        normalizeRepositoryKey(origin),
        `cell=key-unresolved: ${origin} is not normalizable`,
      ).toBeUndefined();
      const root = makeHarnessHome("tc002-key-root");
      const checkout = makeCheckout(root, "checkout", origin);
      try {
        await withHarness("tc002-key", checkout.directory, origin, async (harness) => {
          const added = await harness.run(["queue", "add", REF, "--json"]);
          expect(added.exitCode, `cell=key-unresolved(${origin}): exit 0`).toBe(0);
          expect(dataOf(added)?.result, `cell=key-unresolved(${origin}): added`).toBe("added");
          expectUnboundEntry(added, `cell=key-unresolved(${origin})`);
          const record = recordOf(harness);
          expect(
            record.repository,
            `cell=key-unresolved(${origin}): no root-only record`,
          ).toBeUndefined();
          expect(
            record.repositoryRoot,
            `cell=key-unresolved(${origin}): no root-only record`,
          ).toBeUndefined();
          expect(
            oneSidedCount(harness),
            `cell=key-unresolved(${origin}): no one-sided record`,
          ).toBe(0);
          expectUnboundReadiness(harness, `cell=key-unresolved(${origin})`);
        });
      } finally {
        removeHome(root);
      }
    }
  });

  test("TC-BIND-002 root-unresolved cell emits no binding without a checkout root", async () => {
    const directory = makeNonCheckoutDirectory("root-unresolved");
    const harness = createProductionQueueHarness({
      label: "tc002-root-unresolved",
      workingDirectory: directory,
      originUrl: ORIGIN,
    });
    try {
      const added = await harness.run(["queue", "add", REF, "--json"]);
      expect(added.exitCode, "cell=root-unresolved: exit 0").toBe(0);
      expect(dataOf(added)?.result, "cell=root-unresolved: added").toBe("added");
      expectUnboundEntry(added, "cell=root-unresolved");
      const record = recordOf(harness);
      expect(record.repository, "cell=root-unresolved: no key-only record").toBeUndefined();
      expect(record.repositoryRoot, "cell=root-unresolved: no key-only record").toBeUndefined();
      expect(oneSidedCount(harness), "cell=root-unresolved: no one-sided record").toBe(0);
      expectUnboundReadiness(harness, "cell=root-unresolved");
    } finally {
      harness.dispose();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("TC-BIND-003 nested working directory records the checkout root", () => {
  test("TC-BIND-003 a nested cwd records the checkout root, not the nested path", async () => {
    const root = makeHarnessHome("tc003-root");
    const checkout = makeCheckout(root, "checkout", ORIGIN);
    const nested = makeNestedDirectory(checkout.directory, "packages", "core", "src", "deep");
    try {
      await withHarness("tc003", nested, ORIGIN, async (harness) => {
        const added = await harness.run(["queue", "add", REF, "--json"]);
        expect(added.exitCode, "nested add exits 0").toBe(0);
        expect(dataOf(added)?.result, "nested add is added").toBe("added");
        const record = recordOf(harness);
        expect(record.repositoryRoot, "the root is the checkout root").toBe(checkout.directory);
        expect(record.repositoryRoot, "the root is not the nested directory").not.toBe(nested);
        expect(record.repository, "the key is the normalized origin").toBe(KEY);
      });
    } finally {
      removeHome(root);
    }
  });
});

describe("TC-BIND-004 linked worktree root and top-level/nested equality", () => {
  test("TC-BIND-004 the worktree records its own root; top level equals nested", async () => {
    const root = makeHarnessHome("tc004-root");
    const { main, root: worktree } = makeLinkedWorktree(root, "wt", ORIGIN);
    const nested = makeNestedDirectory(main.directory, "packages", "core");
    try {
      await withHarness("tc004-worktree", worktree, ORIGIN, async (harness) => {
        const added = await harness.run(["queue", "add", REF, "--json"]);
        expect(added.exitCode, "worktree add exits 0").toBe(0);
        const record = recordOf(harness);
        expect(record.repositoryRoot, "the worktree records its own checkout root").toBe(worktree);
        expect(record.repositoryRoot, "the worktree root is not the main checkout").not.toBe(
          main.directory,
        );
        expect(record.repository, "the worktree key").toBe(KEY);
      });

      let topLevelRoot: string | undefined;
      await withHarness("tc004-top", main.directory, ORIGIN, async (harness) => {
        const added = await harness.run(["queue", "add", "GH-274", "--json"]);
        expect(added.exitCode, "top-level add exits 0").toBe(0);
        const record = recordOf(harness, "GH-274");
        expect(record.repositoryRoot, "the top-level root").toBe(main.directory);
        expect(record.repository, "the top-level key").toBe(KEY);
        topLevelRoot = record.repositoryRoot;
      });

      await withHarness("tc004-nested", nested, ORIGIN, async (harness) => {
        const added = await harness.run(["queue", "add", "GH-275", "--json"]);
        expect(added.exitCode, "nested add exits 0").toBe(0);
        const record = recordOf(harness, "GH-275");
        expect(record.repositoryRoot, "the nested invocation records the same absolute root").toBe(
          topLevelRoot,
        );
        expect(record.repository, "the nested key").toBe(KEY);
      });
    } finally {
      removeHome(root);
    }
  });
});

describe("TC-BIND-005 the root is absolute and add performs no spawn or network call", () => {
  test("TC-BIND-005 add is pure: no spawn, no transport, no git child call", async () => {
    const root = makeHarnessHome("tc005-root");
    const checkout = makeCheckout(root, "checkout", ORIGIN);
    try {
      await withHarness("tc005", checkout.directory, ORIGIN, async (harness) => {
        const added = await harness.run(["queue", "add", REF, "--json"]);
        expect(added.exitCode, "add exits 0").toBe(0);
        const record = recordOf(harness);
        expect(isAbsolute(record.repositoryRoot ?? ""), "the recorded root is absolute").toBe(true);
        expect(record.repositoryRoot, "the recorded root is the checkout").toBe(checkout.directory);
        expect(harness.spawns, "no harness process was spawned").toHaveLength(0);
        expect(harness.transportCalls, "no provider request left the process").toHaveLength(0);
        expect(harness.gitCalls, "no git child process was spawned").toHaveLength(0);

        const records = harness.store.readRecords();
        expect(records.ok, "the ledger is readable").toBe(true);
        if (!records.ok) return;
        const appended = records.value.records.filter(
          (stateRecord) => stateRecord.kind !== "document",
        );
        expect(
          appended.filter((stateRecord) => stateRecord.kind === QUEUE_ENTRY_RECORD_KIND),
          "the add appends exactly one queue entry record",
        ).toHaveLength(1);
        for (const stateRecord of appended) {
          expect(stateRecord.kind, "the add appends no other record family").toBe(
            QUEUE_ENTRY_RECORD_KIND,
          );
        }
      });
    } finally {
      removeHome(root);
    }
  });
});

describe("TC-BIND-006 normalizeRepositoryKey is the recorded key for every form", () => {
  const FORMS = [
    "https://github.com/owner/repo.git",
    "https://github.com/owner/repo",
    "ssh://git@github.com/owner/repo",
    "git@github.com:owner/repo.git",
    "https://github.com/Owner/Repo.git",
    "git@github.com:Owner/Repo.git",
  ] as const;

  test("TC-BIND-006 every accepted remote form records the lowercase host/owner/name", async () => {
    for (const form of FORMS) {
      const root = makeHarnessHome("tc006-root");
      const checkout = makeCheckout(root, "checkout", form);
      try {
        await withHarness("tc006", checkout.directory, form, async (harness) => {
          const added = await harness.run(["queue", "add", REF, "--json"]);
          expect(added.exitCode, `form=${form}: exit 0`).toBe(0);
          expect(dataOf(added)?.result, `form=${form}: added`).toBe("added");
          const record = recordOf(harness);
          expect(record.repository, `form=${form}: normalizeRepositoryKey is the authority`).toBe(
            normalizeRepositoryKey(form),
          );
          expect(record.repository, `form=${form}: every form shares one key`).toBe(KEY);

          const configText = originOfConfig(
            // Read the recorded root's own .git/config back for the consistency row.
            readFileSync(join(record.repositoryRoot ?? "", ".git/config"), "utf8"),
          );
          expect(
            normalizeRepositoryKey(configText ?? ""),
            `form=${form}: the recorded root's remote normalizes to the recorded key`,
          ).toBe(record.repository);

          if (form.toLowerCase() !== form) {
            expect(
              normalizeRepositoryRemote(form),
              `form=${form}: the dispatch-identity normalizer preserves owner/name case`,
            ).toBe("github.com/Owner/Repo");
            expect(
              record.repository,
              `form=${form}: the record does not use normalizeRepositoryRemote`,
            ).not.toBe(normalizeRepositoryRemote(form));
          }
        });
      } finally {
        removeHome(root);
      }
    }
  });

  test("TC-BIND-006 pure normalizer rows agree with the recorded key", () => {
    for (const form of FORMS) {
      expect(normalizeRepositoryKey(form), `pure row ${form}`).toBe(KEY);
    }
  });
});

describe("TC-BIND-007 dispatch identity resolves from the recorded scheduler key", () => {
  test("TC-BIND-007 the scheduler key outranks a disagreeing remote-derived identity", async () => {
    const root = makeHarnessHome("tc007-root");
    const schedulerOrigin = "https://github.com/owner/scheduler.git";
    const checkout: Checkout = makeCheckout(root, "checkout", schedulerOrigin);
    const stateHome = makeHarnessHome("tc007-state");
    try {
      const harnessA = createProductionQueueHarness({
        label: "tc007-a",
        workingDirectory: checkout.directory,
        originUrl: schedulerOrigin,
        home: stateHome,
      });
      const added = await harnessA.run(["queue", "add", REF, "--json"]);
      expect(added.exitCode, "the scheduler-key add exits 0").toBe(0);
      const record = recordOf(harnessA);
      expect(record.repository, "the entry records the normalizeRepositoryKey form").toBe(
        "github.com/owner/scheduler",
      );

      // Rewrite the checkout remote so the remote-derived identity disagrees.
      const remoteOrigin = "https://github.com/owner/remote.git";
      setCheckoutOrigin(checkout, remoteOrigin);

      const harness = createProductionQueueHarness({
        label: "tc007-b",
        workingDirectory: checkout.directory,
        originUrl: remoteOrigin,
        home: stateHome,
      });
      try {
        const dispatched = await harness.run(["dispatch", REF, "--json"]);
        expect(
          errorOf(dispatched)?.code ?? dataOf(dispatched)?.result,
          "dispatch passes the observation gate (no queue.entry.unobserved)",
        ).not.toBe("queue.entry.unobserved");

        const attempts = readDispatchAttempts(harness.store);
        expect(attempts.ok, "the dispatch ledger is readable").toBe(true);
        if (!attempts.ok) return;
        expect(attempts.records, "one attempt was appended").toHaveLength(1);
        expect(attempts.records[0]?.repository, "the attempt carries the scheduler key").toBe(
          "github.com/owner/scheduler",
        );

        const marker = readDispatchIdentityMarkerText(checkout.commonDir);
        expect(marker, "the checkout-scoped marker records the scheduler key").toContain(
          "github.com/owner/scheduler",
        );

        const unit = resolveDispatchIdentity({
          schedulerKey: "github.com/owner/scheduler",
          remoteUrl: remoteOrigin,
        });
        expect(unit.ok, "the resolver accepts the recorded key").toBe(true);
        if (!unit.ok) return;
        expect(unit.repository, "the resolver prefers the scheduler key").toBe(
          "github.com/owner/scheduler",
        );
        expect(unit.source, "the resolver source is scheduler").toBe("scheduler");
      } finally {
        harness.dispose();
      }
    } finally {
      removeHome(stateHome);
      removeHome(root);
    }
  });
});

describe("TC-BIND-008 list observes the entry and no read surface leaks the root", () => {
  test("TC-BIND-008 list projects the key and the root never appears in any output", async () => {
    const root = makeHarnessHome("tc008-root");
    const checkout = makeCheckout(root, "checkout", ORIGIN);
    try {
      await withHarness("tc008", checkout.directory, ORIGIN, async (harness) => {
        const added = await harness.run(["queue", "add", REF, "--json"]);
        expect(added.exitCode, "add exits 0").toBe(0);
        const rootString = recordOf(harness).repositoryRoot;
        if (rootString === undefined) throw new Error("the recorded root is missing");

        const listed = await harness.run(["queue", "list", "--json"]);
        expect(listed.exitCode, "list exits 0").toBe(0);
        const entries = dataOf(listed)?.entries as ReadonlyArray<Record<string, unknown>>;
        const observed = entries.find((entry) => entry.ref === REF);
        expect(observed?.repository, "list observes the normalized key").toBe(KEY);

        const surfaces = [
          await harness.run(["queue", "list"]),
          await harness.run(["queue", "plan", "--json"]),
          await harness.run(["lanes", "list", "--json"]),
          await harness.run(["lanes", "show", REF, "--json"]),
          await harness.run(["queue", "claim", REF, "--holder", "h", "--json"]),
          await harness.run(["queue", "release", REF, "--holder", "h", "--json"]),
        ];
        for (const surface of surfaces) {
          const output = `${surface.stdout}\n${surface.stderr}`;
          expect(output.includes(rootString), "the recorded root never appears in output").toBe(
            false,
          );
        }

        // `status` renders the pre-existing local-context path from its own cwd,
        // so the absence assertion is made over the same state and a working
        // directory outside the recorded checkout: the queue-recorded root must
        // still appear nowhere.
        const outside = makeNonCheckoutDirectory("tc008-outside");
        const statusHarness = createProductionQueueHarness({
          label: "tc008-status",
          workingDirectory: outside,
          home: harness.home,
        });
        try {
          for (const surface of [
            await statusHarness.run(["status", "--json"]),
            await statusHarness.run(["brief", "--json"]),
          ]) {
            const output = `${surface.stdout}\n${surface.stderr}`;
            expect(output.includes(rootString), "status/brief carry no recorded root").toBe(false);
          }
        } finally {
          statusHarness.dispose();
          rmSync(outside, { recursive: true, force: true });
        }

        const graph = harness.graphDocument();
        expect(graph, "the derived graph document exists").toBeDefined();
        expect(graph?.includes(rootString), "the graph document carries no root").toBe(false);
        expect(listed.stdout.includes(rootString), "list JSON carries no root").toBe(false);
      });
    } finally {
      removeHome(root);
    }
  });
});

describe("TC-BIND-009 claim/plan observe and dispatch passes the observation gate", () => {
  test("TC-BIND-009 plan observes the ref and dispatch appends an attempt", async () => {
    const root = makeHarnessHome("tc009-root");
    const checkout = makeCheckout(root, "checkout", ORIGIN);
    try {
      await withHarness("tc009", checkout.directory, ORIGIN, async (harness) => {
        const added = await harness.run(["queue", "add", REF, "--json"]);
        expect(added.exitCode, "add exits 0").toBe(0);

        const planned = await harness.run(["queue", "plan", "--json"]);
        expect(planned.exitCode, "plan exits 0").toBe(0);
        const entries = dataOf(planned)?.entries as ReadonlyArray<Record<string, unknown>>;
        const observed = entries.find((entry) => entry.ref === REF);
        expect(observed?.repository, "plan observes the recorded key").toBe(KEY);

        const dispatched = await harness.run(["dispatch", REF, "--json"]);
        const observedError = errorOf(dispatched)?.code;
        expect(observedError, "dispatch never refuses with queue.entry.unobserved").not.toBe(
          "queue.entry.unobserved",
        );

        const attempts = readDispatchAttempts(harness.store);
        expect(attempts.ok, "the dispatch ledger is readable").toBe(true);
        if (!attempts.ok) return;
        expect(attempts.records, "exactly one attempt was appended").toHaveLength(1);
        expect(attempts.records[0]?.repository, "the attempt carries the recorded key").toBe(KEY);

        const rootString = recordOf(harness).repositoryRoot;
        if (rootString === undefined) throw new Error("the recorded root is missing");
        expect(
          dispatched.stdout.includes(rootString),
          "the dispatch envelope carries no root",
        ).toBe(false);
      });
    } finally {
      removeHome(root);
    }
  });
});

describe("TC-BIND-010 the ticket repro sequence", () => {
  test("TC-BIND-010 add -> list -> dispatch differs from the encoded pre-fix triple", async () => {
    const root = makeHarnessHome("tc010-root");
    const checkout = makeCheckout(root, "checkout", ORIGIN);
    try {
      await withHarness("tc010", checkout.directory, ORIGIN, async (harness) => {
        const added = await harness.run(["queue", "add", REF, "--json"]);
        expect(added.exitCode, "add exits 0").toBe(0);
        expect(dataOf(added)?.result, "add is added").toBe("added");
        expect(recordOf(harness).repositoryRoot, "the ledger carries the pair").toBe(
          checkout.directory,
        );

        const listed = await harness.run(["queue", "list", "--json"]);
        expect(listed.exitCode, "list exits 0").toBe(0);
        const entries = dataOf(listed)?.entries as ReadonlyArray<Record<string, unknown>>;
        expect(
          entries.some((entry) => entry.ref === REF),
          "list observes the entry",
        ).toBe(true);

        const dispatched = await harness.run(["dispatch", REF, "--json"]);
        const observedError = errorOf(dispatched)?.code;
        expect(observedError, "dispatch passes the observation gate").not.toBe(
          "queue.entry.unobserved",
        );
        const attempts = readDispatchAttempts(harness.store);
        expect(attempts.ok, "the dispatch ledger is readable").toBe(true);
        if (attempts.ok) expect(attempts.records, "one attempt was appended").toHaveLength(1);

        // Element-wise difference from the ticket's pre-fix failure triple.
        const observed = {
          addRefusalCode: errorOf(added)?.code,
          entryCount: entries.length,
          dispatchErrorCode: observedError,
        };
        expect(observed.addRefusalCode, "the add did not refuse").not.toBe(
          PRE_FIX_FAILURE_TRIPLE.addRefusalCode,
        );
        expect(observed.entryCount, "the list is not empty").not.toBe(
          PRE_FIX_FAILURE_TRIPLE.entryCount,
        );
        expect(observed.dispatchErrorCode, "dispatch is not unobserved").not.toBe(
          PRE_FIX_FAILURE_TRIPLE.dispatchErrorCode,
        );
      });
    } finally {
      removeHome(root);
    }
  });
});

describe("TC-BIND-017 binding determinism across independent harnesses and replay", () => {
  test("TC-BIND-017 two harnesses and a replay record the identical pair", async () => {
    const root = makeHarnessHome("tc017-root");
    const checkout = makeCheckout(root, "checkout", ORIGIN);
    const homeA = makeHarnessHome("tc017-a");
    const homeB = makeHarnessHome("tc017-b");
    const harnessA = createProductionQueueHarness({
      label: "tc017-a",
      workingDirectory: checkout.directory,
      originUrl: ORIGIN,
      home: homeA,
    });
    const harnessB = createProductionQueueHarness({
      label: "tc017-b",
      workingDirectory: checkout.directory,
      originUrl: ORIGIN,
      home: homeB,
    });
    try {
      const addedA = await harnessA.run(["queue", "add", REF, "--json"]);
      const addedB = await harnessB.run(["queue", "add", REF, "--json"]);
      expect(addedA.exitCode, "harness A exits 0").toBe(0);
      expect(addedB.exitCode, "harness B exits 0").toBe(0);
      const recordA = recordOf(harnessA);
      const recordB = recordOf(harnessB);
      expect(recordB.repository, "both harnesses record the same key").toBe(recordA.repository);
      expect(recordB.repositoryRoot, "both harnesses record the same root").toBe(
        recordA.repositoryRoot,
      );

      const replay = await harnessA.run(["queue", "add", REF, "--json"]);
      expect(dataOf(replay)?.result, "the replay is noop").toBe("noop");
      const replayed = recordOf(harnessA);
      expect(replayed.repository, "the replay leaves the key unchanged").toBe(recordA.repository);
      expect(replayed.repositoryRoot, "the replay leaves the root unchanged").toBe(
        recordA.repositoryRoot,
      );
    } finally {
      harnessA.dispose();
      harnessB.dispose();
      removeHome(homeA);
      removeHome(homeB);
      removeHome(root);
    }
  });
});
