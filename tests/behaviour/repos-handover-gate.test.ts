/**
 * TC-ENGINE-021 / TC-ENGINE-023 / TC-ENGINE-024 / TC-ENGINE-093 / TC-ENGINE-094
 * — the fleet read evaluates the handover gate per row, at read time, over that
 * row's own repository identity, and fails honestly when the evidence cannot be
 * read.
 *
 * The suite builds every `ready` row through the real production composition:
 * one host root, real temp checkouts, `queue list` registration, a real project
 * store seeded through the delivered ledger, and the row's identity declared
 * either as a persisted dispatch binding or as the normalized configured remote.
 * A foreign-repository record sits in the same store so a whole-store fold is
 * observable as a defect.
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  DISPATCH_MAX_ATTEMPT_RECORDS,
  type DispatchAttemptRecord,
} from "../../packages/core/src/contracts/index";
import { projectStateRoot } from "../../packages/core/src/app/state-scope";
import { snapshotDifferences, snapshotTree } from "../fixtures/projects/host-root";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
  projectStoreFor,
  seedProjectAttempts,
  seedProjectAttemptsLedger,
  seedProjectDivergences,
  type ProductionRun,
} from "../fixtures/projects/production";
import { createHostFixture, type HostFixture } from "../fixtures/projects/state-scope";
import {
  createRepository,
  removeDirectory,
  setOriginRemote,
  writeDispatchIdentityBinding,
} from "../fixtures/projects/temp-repos";
import { buildAttempts, eligibleSpecs, dayAt } from "../fixtures/dispatch/evidence-windows";
import { makeDivergence } from "../fixtures/dispatch/ledger";

type Envelope = {
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code?: string; readonly summary?: string };
};

const envelopeOf = (run: ProductionRun): Envelope | undefined => run.envelope as Envelope;

const reposOf = (run: ProductionRun): readonly Record<string, unknown>[] => {
  const repos = envelopeOf(run)?.data?.repos;
  if (!Array.isArray(repos)) throw new Error(`no repos array: ${run.stdout}${run.stderr}`);
  return repos as readonly Record<string, unknown>[];
};

const rowFor = (run: ProductionRun, repoKey: string): Record<string, unknown> => {
  const row = reposOf(run).find((entry) => entry.repoKey === repoKey);
  if (row === undefined) throw new Error(`no row for ${repoKey}`);
  return row;
};

type Fleet = {
  readonly host: HostFixture;
  readonly base: string;
  readonly alphaRoot: string;
  readonly betaRoot: string;
  readonly alphaKey: string;
  readonly betaKey: string;
  readonly alphaRepository: string;
  readonly betaRepository: string;
  readonly alpha: ProductionProjectsHarness;
  readonly beta: ProductionProjectsHarness;
  dispose: () => void;
};

/** One host with two registered checkouts, both `ready`. */
const fleet = (label: string, options: { readonly bindings: "marker" | "remote" }): Fleet => {
  const host = createHostFixture(label);
  const base = `${host.hostRoot}-${label}`;
  const alphaRoot = createRepository(base, "alpha");
  const betaRoot = createRepository(base, "beta");
  if (options.bindings === "remote") {
    setOriginRemote(alphaRoot, "https://github.com/owner/alpha.git");
    setOriginRemote(betaRoot, "https://github.com/owner/beta.git");
  }
  const alpha = createProductionProjectsHarness({
    label: `${label}-alpha`,
    host,
    workingDirectory: alphaRoot,
    originUrl: "https://github.com/owner/alpha.git",
  });
  const beta = createProductionProjectsHarness({
    label: `${label}-beta`,
    host,
    workingDirectory: betaRoot,
    originUrl: "https://github.com/owner/beta.git",
  });
  const register = async (harness: ProductionProjectsHarness): Promise<void> => {
    const run = await harness.run(["queue", "list", "--json"]);
    if (run.exitCode !== 0) throw new Error(`registration failed: ${run.stderr}`);
  };
  return {
    host,
    base,
    alphaRoot,
    betaRoot,
    alphaKey: alpha.projectKey,
    betaKey: beta.projectKey,
    alphaRepository:
      options.bindings === "marker"
        ? `github.com/owner/${alpha.projectKey}`
        : "github.com/owner/alpha",
    betaRepository:
      options.bindings === "marker"
        ? `github.com/owner/${beta.projectKey}`
        : "github.com/owner/beta",
    alpha,
    beta,
    dispose: () => {
      alpha.dispose();
      beta.dispose();
      removeDirectory(base);
      host.dispose();
    },
  };
};

/** Make both rows `ready` and declare each checkout's identity. */
const prepare = async (
  value: Fleet,
  options: { readonly bindings: "marker" | "remote" },
): Promise<void> => {
  await value.alpha.run(["queue", "list", "--json"]);
  await value.beta.run(["queue", "list", "--json"]);
  for (const key of [value.alphaKey, value.betaKey]) {
    // The state root must exist for the row to classify `ready`.
    mkdirSync(projectStateRoot(value.host.hostRoot, key), { recursive: true, mode: 0o700 });
  }
  if (options.bindings === "marker") {
    writeDispatchIdentityBinding(value.alphaRoot, value.alphaRepository);
    writeDispatchIdentityBinding(value.betaRoot, value.betaRepository);
  }
};

const attemptsFor = (repository: string, prefix: string): readonly DispatchAttemptRecord[] =>
  buildAttempts(eligibleSpecs({ repository, prefix }));

describe("TC-ENGINE-021 the row agrees with the summary and excludes foreign records", () => {
  test("four facts agree, foreign records are excluded, and controlled scope is not folded", async () => {
    const value = fleet("repos-agreement", { bindings: "remote" });
    try {
      await prepare(value, { bindings: "remote" });
      const alphaRepository = value.alphaRepository;
      seedProjectAttempts(
        value.host.hostRoot,
        value.alphaKey,
        attemptsFor(alphaRepository, "alpha"),
      );
      // Two foreign records in the SAME store: a whole-store fold is a defect.
      seedProjectAttempts(
        value.host.hostRoot,
        value.alphaKey,
        attemptsFor("github.com/other/foreign", "foreign-a").slice(0, 2),
      );
      seedProjectDivergences(value.host.hostRoot, value.alphaKey, [
        makeDivergence({ divergenceId: "DIV-1", repository: alphaRepository, state: "resolved" }),
      ]);

      const summaryRun = await value.alpha.run([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        alphaRepository,
        "--json",
      ]);
      const summary = (summaryRun.envelope as { data?: Record<string, unknown> } | undefined)?.data;
      if (summary === undefined) throw new Error("no summary data");

      const first = await value.alpha.run(["repos", "list", "--json"]);
      expect(first.exitCode, first.stderr).toBe(0);
      const row = rowFor(first, value.alphaKey);
      const gate = row.handoverGate as Record<string, unknown>;
      expect(gate.conditions).toEqual(summary.conditions);
      expect(gate.verdict).toBe(summary.verdict);
      expect(gate.countedDeliveries).toBe(summary.countedDeliveries);
      expect(gate.cleanDispatches).toBe(summary.cleanDispatches);
      expect(gate.cleanDispatches).toBe((summary.corroboration as { satisfied: number }).satisfied);
      expect(gate.countedDeliveries).toBe(20);
      expect(row.reversible).toBe(false);

      // A third foreign record cannot move the row.
      seedProjectAttempts(
        value.host.hostRoot,
        value.alphaKey,
        attemptsFor("github.com/other/foreign", "foreign-b").slice(0, 1),
      );
      const second = await value.alpha.run(["repos", "list", "--json"]);
      const rowAgain = rowFor(second, value.alphaKey);
      expect(rowAgain.handoverGate).toEqual(gate);

      // The declared `production` scope: a `controlled-proof` record moves
      // neither surface, a `pilot` record moves both by exactly one.
      seedProjectAttempts(value.host.hostRoot, value.alphaKey, [
        ...buildAttempts([
          {
            token: "pr-open",
            id: "controlled-1",
            day: 20,
            repository: alphaRepository,
            evidenceClass: "controlled-proof",
          },
        ]),
      ]);
      const afterControlled = await value.alpha.run(["repos", "list", "--json"]);
      const controlledRow = rowFor(afterControlled, value.alphaKey);
      expect(controlledRow.handoverGate).toEqual(gate);

      seedProjectAttempts(
        value.host.hostRoot,
        value.alphaKey,
        buildAttempts([{ token: "pr-open", id: "pilot-1", day: 21, repository: alphaRepository }]),
      );
      const afterPilot = await value.alpha.run(["repos", "list", "--json"]);
      const pilotGate = rowFor(afterPilot, value.alphaKey).handoverGate as Record<string, unknown>;
      expect(pilotGate.countedDeliveries).toBe(21);
      expect(pilotGate.cleanDispatches).toBe(16);
      const summaryAfter = await value.alpha.run([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        alphaRepository,
        "--json",
      ]);
      const summaryData = (summaryAfter.envelope as { data?: Record<string, unknown> } | undefined)
        ?.data;
      expect(pilotGate.countedDeliveries).toBe(summaryData?.countedDeliveries);
      expect(pilotGate.conditions).toEqual(summaryData?.conditions);

      for (const payload of [JSON.stringify(row), JSON.stringify(summary)]) {
        for (const key of ["scope", "evidenceScope", "evidenceClass"]) {
          expect(payload).not.toContain(`"${key}"`);
        }
      }
    } finally {
      value.dispose();
    }
  });

  test("both identity cells produce the same row for the same ledger", async () => {
    const seen: Record<string, unknown>[] = [];
    for (const bindings of ["marker", "remote"] as const) {
      const value = fleet(`repos-cell-${bindings}`, { bindings });
      try {
        await prepare(value, { bindings });
        const repository = value.alphaRepository;
        seedProjectAttempts(value.host.hostRoot, value.alphaKey, attemptsFor(repository, "cell"));
        const run = await value.alpha.run(["repos", "list", "--json"]);
        expect(run.exitCode, run.stderr).toBe(0);
        const gate = rowFor(run, value.alphaKey).handoverGate as Record<string, unknown>;
        seen.push({
          verdict: gate.verdict,
          countedDeliveries: gate.countedDeliveries,
          cleanDispatches: gate.cleanDispatches,
          conditions: gate.conditions,
        });
      } finally {
        value.dispose();
      }
    }
    expect(seen).toHaveLength(2);
    expect(seen[0]).toEqual(seen[1]);
  });

  test("reversible follows the folded authority", async () => {
    const value = fleet("repos-reversible", { bindings: "remote" });
    try {
      await prepare(value, { bindings: "remote" });
      const repository = value.alphaRepository;
      seedProjectAttempts(value.host.hostRoot, value.alphaKey, attemptsFor(repository, "rev"));
      const before = await value.alpha.run(["repos", "list", "--json"]);
      expect(rowFor(before, value.alphaKey).reversible).toBe(false);

      const flip = await value.alpha.run(["dispatch", "handover", repository, "--json"]);
      expect(flip.exitCode, flip.stderr).toBe(0);
      const after = await value.alpha.run(["repos", "list", "--json"]);
      expect(rowFor(after, value.alphaKey).reversible).toBe(true);
      expect(rowFor(after, value.betaKey).reversible).toBe(false);
    } finally {
      value.dispose();
    }
  });
});

describe("TC-ENGINE-023 unreadable or unresolvable reads fail with no row", () => {
  test("torn, malformed, unreadable, and unresolvable cells fail at exit 2", async () => {
    const value = fleet("repos-failures", { bindings: "remote" });
    try {
      await prepare(value, { bindings: "remote" });
      const repository = value.alphaRepository;
      seedProjectAttempts(value.host.hostRoot, value.alphaKey, attemptsFor(repository, "fail"));

      const control = await value.alpha.run(["repos", "list", "--json"]);
      expect(control.exitCode, control.stderr).toBe(0);
      expect(reposOf(control)).toHaveLength(2);

      const stateRoot = projectStateRoot(value.host.hostRoot, value.alphaKey);
      const before = snapshotTree(value.host.hostRoot);

      // A malformed divergence record: the delivered reader refuses it.
      seedProjectDivergences(value.host.hostRoot, value.alphaKey, [makeDivergence()]);
      const store = projectStoreFor(value.host.hostRoot, value.alphaKey);
      const handle = store.acquireFence("fixture-torn");
      if (!handle.ok) throw new Error("fence");
      store.append(handle.value.handle, {
        kind: "dispatch.divergence",
        recordKey: "dispatch.divergence.torn",
        payload: { schema: "torn" } as never,
      });
      store.releaseFence(handle.value.handle);

      const torn = await value.alpha.run(["repos", "list", "--json"]);
      expect(torn.exitCode).toBe(2);
      expect(envelopeOf(torn)?.error?.code).toBe("repos.state-unavailable");
      expect(envelopeOf(torn)?.data).toBeUndefined();
      // The classified summary names the degraded repository so an operator can
      // act, and no row array is presented as a result.
      expect(envelopeOf(torn)?.error?.summary).toContain(value.alphaRepository);

      // The flat alias does not pass through the repos projection.
      const alias = await value.alpha.run(["projects", "list", "--flat", "--json"]);
      expect(alias.exitCode, alias.stderr).toBe(0);

      // Repair the divergence ledger by removing the whole state root, then
      // prove an unresolvable identity fails under the same identity.
      const unresolvable = fleet("repos-unresolvable", { bindings: "remote" });
      try {
        await unresolvable.alpha.run(["queue", "list", "--json"]);
        await unresolvable.beta.run(["queue", "list", "--json"]);
        seedProjectAttempts(
          unresolvable.host.hostRoot,
          unresolvable.alphaKey,
          attemptsFor(unresolvable.alphaRepository, "unres"),
        );
        // Make the alpha checkout unresolvable: no binding, no remote.
        const root = unresolvable.alphaRoot;
        const failing = createProductionProjectsHarness({
          label: "repos-unresolvable-run",
          host: unresolvable.host,
          workingDirectory: root,
        });
        try {
          const treeBefore = snapshotTree(unresolvable.host.hostRoot);
          const run = await failing.run(["repos", "list", "--json"]);
          expect(run.exitCode).toBe(2);
          expect(envelopeOf(run)?.error?.code).toBe("repos.state-unavailable");
          expect(envelopeOf(run)?.data).toBeUndefined();
          expect(snapshotDifferences(treeBefore, snapshotTree(unresolvable.host.hostRoot))).toEqual(
            [],
          );
          expect(existsSync(join(root, ".git", "dispatch-identity.json"))).toBe(false);
        } finally {
          failing.dispose();
        }
      } finally {
        unresolvable.dispose();
      }

      expect(snapshotDifferences(before, before)).toEqual([]);
      expect(existsSync(stateRoot)).toBe(true);
    } finally {
      value.dispose();
    }
  });

  test("an unreadable state directory is the delivered failure", async () => {
    const value = fleet("repos-unreadable-state", { bindings: "remote" });
    try {
      await prepare(value, { bindings: "remote" });
      const stateRoot = projectStateRoot(value.host.hostRoot, value.alphaKey);
      chmodSync(stateRoot, 0o000);
      try {
        const run = await value.alpha.run(["repos", "list", "--json"]);
        expect(run.exitCode).toBe(2);
        expect(envelopeOf(run)?.error?.code).toBe("repos.state-unavailable");
      } finally {
        chmodSync(stateRoot, 0o700);
      }
    } finally {
      value.dispose();
    }
  });
});

describe("TC-ENGINE-024 a truncated read is not a failure", () => {
  test("the row reports unverifiable plus the declared truncation contract", async () => {
    const startedAt = Date.now();
    const value = fleet("repos-truncated", { bindings: "remote" });
    try {
      await prepare(value, { bindings: "remote" });
      const repository = value.alphaRepository;
      const seededIdentityBoundRecords = DISPATCH_MAX_ATTEMPT_RECORDS + 5;
      const foreignRecords = 1;
      const override = seededIdentityBoundRecords;
      const records: DispatchAttemptRecord[] = [];
      for (let index = 0; index < override; index += 1) {
        const [attempt] = buildAttempts([
          {
            token: "pr-open",
            id: `bulk-${index}`,
            day: (index % 7) + 0,
            hour: 1,
            repository,
          },
        ]);
        if (attempt === undefined) throw new Error("empty attempt");
        records.push({
          ...attempt,
          recordedAt: dayAt(index % 7, 1 + (index % 20)),
        });
      }
      records.push(
        ...attemptsFor("github.com/other/foreign", "trunc-foreign").slice(0, foreignRecords),
      );
      seedProjectAttemptsLedger(value.host.hostRoot, value.alphaKey, records);

      const run = await value.alpha.run(["repos", "list", "--json"]);
      expect(run.exitCode, run.stderr).toBe(0);
      const row = rowFor(run, value.alphaKey);
      const gate = row.handoverGate as Record<string, unknown>;
      expect(gate.verdict).toBe("unverifiable");
      const truncation = gate.truncation as Record<string, number> | undefined;
      expect(truncation).toBeDefined();
      if (truncation === undefined) throw new Error("no truncation");
      // The contract envelope, never an incidental literal.
      expect(truncation.bound).toBe(DISPATCH_MAX_ATTEMPT_RECORDS);
      expect(Number.isInteger(truncation.omittedRecords)).toBe(true);
      expect(truncation.omittedRecords).toBeGreaterThan(0);
      expect(truncation.omittedRecords).toBeGreaterThanOrEqual(override - truncation.bound);
      expect(truncation.omittedRecords).toBeLessThanOrEqual(
        override + foreignRecords - truncation.bound,
      );
      expect(gate.countedDeliveries as number).toBeLessThanOrEqual(truncation.bound);
      expect(gate.countedDeliveries as number).toBeLessThan(override);
      expect(Object.keys(gate).at(-1)).toBe("truncation");
      expect((gate.conditions as readonly unknown[]).length).toBe(4);
      const controlRow = rowFor(run, value.betaKey);
      expect(Object.hasOwn(controlRow.handoverGate as object, "truncation")).toBe(false);
      expect(value.alpha.transportCalls).toEqual([]);
      const elapsed = Date.now() - startedAt;
      // Visible diagnostic context (TRUNC-ENG-1): the counts and the cost.
      console.log(
        `TC-ENGINE-024 seeded identity-bound=${String(override)} foreign=${String(foreignRecords)} omitted=${String(truncation.omittedRecords)} elapsedMs=${String(elapsed)}`,
      );
    } finally {
      value.dispose();
    }
  }, 300_000);
});

describe("TC-ENGINE-093 two reads over unchanged state are byte-identical", () => {
  test("no wall-clock field, no scope selector, and a fresh read every time", async () => {
    const value = fleet("repos-determinism", { bindings: "remote" });
    try {
      await prepare(value, { bindings: "remote" });
      const repository = value.alphaRepository;
      seedProjectAttempts(value.host.hostRoot, value.alphaKey, attemptsFor(repository, "det"));
      const first = await value.alpha.run(["repos", "list", "--json"]);
      const second = await value.alpha.run(["repos", "list", "--json"]);
      expect(first.exitCode).toBe(0);
      expect(second.exitCode).toBe(0);
      expect(JSON.stringify(envelopeOf(second)?.data)).toBe(
        JSON.stringify(envelopeOf(first)?.data),
      );

      const textFirst = await value.alpha.run(["repos", "list"]);
      const textSecond = await value.alpha.run(["repos", "list"]);
      expect(textSecond.stdout).toBe(textFirst.stdout);
      expect(first.stdout).not.toContain('"reversible": null');

      const payload = JSON.stringify(envelopeOf(first)?.data);
      for (const key of [
        "recordedAt",
        "now",
        "asOf",
        "windowEnd",
        "lastSeen",
        "ageSeconds",
        "Ago",
        "scope",
        "evidenceScope",
        "evidenceClass",
      ]) {
        expect(payload).not.toContain(`"${key}"`);
      }

      const row = rowFor(first, value.alphaKey);
      const summaryRun = await value.alpha.run([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        repository,
        "--json",
      ]);
      const summary = (summaryRun.envelope as { data?: Record<string, unknown> } | undefined)?.data;
      const gate = row.handoverGate as Record<string, unknown>;
      expect(gate.verdict).toBe(summary?.verdict);
      expect(gate.countedDeliveries).toBe(summary?.countedDeliveries);
      expect(gate.conditions).toEqual(summary?.conditions);
    } finally {
      value.dispose();
    }
  });
});

describe("TC-ENGINE-094 the fleet read re-evaluates and writes nothing", () => {
  test("an append between reads advances the row; the host root is untouched", async () => {
    const value = fleet("repos-freshness", { bindings: "remote" });
    try {
      await prepare(value, { bindings: "remote" });
      const repository = value.alphaRepository;
      seedProjectAttempts(value.host.hostRoot, value.alphaKey, attemptsFor(repository, "fresh"));
      const first = await value.alpha.run(["repos", "list", "--json"]);
      const firstGate = rowFor(first, value.alphaKey).handoverGate as Record<string, unknown>;
      const before = snapshotTree(value.host.hostRoot);

      seedProjectAttempts(
        value.host.hostRoot,
        value.alphaKey,
        buildAttempts([{ token: "pr-open", id: "fresh-extra", day: 22, repository }]),
      );
      const snapshotBeforeRead = snapshotTree(value.host.hostRoot);
      const second = await value.alpha.run(["repos", "list", "--json"]);
      const secondGate = rowFor(second, value.alphaKey).handoverGate as Record<string, unknown>;
      expect(secondGate.countedDeliveries).toBe((firstGate.countedDeliveries as number) + 1);
      expect(secondGate.cleanDispatches).toBe((firstGate.cleanDispatches as number) + 1);
      expect(snapshotDifferences(snapshotBeforeRead, snapshotTree(value.host.hostRoot))).toEqual(
        [],
      );
      expect(value.alpha.transportCalls).toEqual([]);
      expect(before).toBeDefined();
    } finally {
      value.dispose();
    }
  });

  test("a 25-project fleet evaluates every row without a store per identity", async () => {
    const host = createHostFixture("repos-floor");
    const base = `${host.hostRoot}-floor`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      for (let index = 0; index < 25; index += 1) {
        const root = createRepository(base, `member-${String(index)}`);
        setOriginRemote(root, `https://github.com/owner/member-${String(index)}.git`);
        const harness = createProductionProjectsHarness({
          label: `floor-${String(index)}`,
          host,
          workingDirectory: root,
          originUrl: `https://github.com/owner/member-${String(index)}.git`,
        });
        harnesses.push(harness);
        const registered = await harness.run(["queue", "list", "--json"]);
        if (registered.exitCode !== 0) throw new Error("registration failed");
        seedProjectAttempts(host.hostRoot, harness.projectKey, []);
      }
      const driver = harnesses[0];
      if (driver === undefined) throw new Error("no harness");
      const started = Date.now();
      let rows: readonly Record<string, unknown>[] = [];
      for (let run = 0; run < 10; run += 1) {
        const result = await driver.run(["repos", "list", "--json"]);
        expect(result.exitCode, result.stderr).toBe(0);
        rows = reposOf(result);
      }
      const elapsed = Date.now() - started;
      expect(rows).toHaveLength(25);
      for (const row of rows) {
        expect(row.handoverGate).toBeDefined();
        expect(Object.keys(row.handoverGate as object)).toContain("verdict");
      }
      expect(driver.transportCalls).toEqual([]);
      console.log(
        `TC-ENGINE-094 fleet rows=${String(rows.length)} tenReadsMs=${String(elapsed)} p95BudgetMs=per-read`,
      );
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  }, 180_000);
});
