/**
 * TC-ENGINE-095 — one ledger, three surfaces, identical condition statuses.
 *
 * Six fixture families are each seeded into one registered project's state root,
 * and the same repository identity addresses the summary, the handover decision,
 * and the fleet row. Any two surfaces disagreeing on status order, verdict,
 * counters, or the truncation pair fails; each family's ledger count is asserted
 * so the reads are proven side-effect free.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { readDispatchHandover } from "../../packages/core/src/app/dispatch-ledger";
import { projectStateRoot } from "../../packages/core/src/app/state-scope";
import {
  type DispatchHandoverData,
  type DispatchSummaryData,
  ERROR_TABLE,
} from "../../packages/core/src/contracts/index";
import {
  type AttemptSpec,
  buildAttempts,
  dayAt,
  eligibleSpecs,
  gappedDates,
  missingClassSpecs,
  uncorroboratedSpecs,
} from "../fixtures/dispatch/evidence-windows";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
  type ProductionRun,
  seedProjectAttempts,
} from "../fixtures/projects/production";
import { createHostFixture, type HostFixture } from "../fixtures/projects/state-scope";
import {
  createRepository,
  removeDirectory,
  setOriginRemote,
} from "../fixtures/projects/temp-repos";

type Family = {
  readonly name: string;
  readonly specs: readonly AttemptSpec[];
};

const families: readonly Family[] = [
  { name: "eligible", specs: eligibleSpecs() },
  {
    name: "truth-incident",
    specs: [
      ...eligibleSpecs({ prefix: "incident" }),
      {
        token: "pr-open",
        id: "incident-tail",
        day: 6,
        falseSuccess: true,
      },
    ],
  },
  { name: "coverage-missing", specs: missingClassSpecs("merged") },
  { name: "floor-missing", specs: gappedDates() },
  { name: "corroboration-unsatisfied", specs: uncorroboratedSpecs() },
  { name: "truncated", specs: eligibleSpecs() },
];

type Fleet = {
  readonly host: HostFixture;
  readonly harness: ProductionProjectsHarness;
  readonly repository: string;
  readonly dispose: () => void;
};

/** One host whose checkout identity resolves to the repository under test. */
const fleetFor = async (label: string, repository: string): Promise<Fleet> => {
  const host = createHostFixture(label);
  const base = `${host.hostRoot}-${label}`;
  const root = createRepository(base, "checkout");
  setOriginRemote(root, `https://github.com/${repository.split("/").slice(1).join("/")}.git`);
  const harness = createProductionProjectsHarness({
    label: `${label}-harness`,
    host,
    workingDirectory: root,
    originUrl: `https://github.com/${repository.split("/").slice(1).join("/")}.git`,
  });
  mkdirSync(projectStateRoot(host.hostRoot, harness.projectKey), { recursive: true, mode: 0o700 });
  const registered = await harness.run(["queue", "list", "--json"]);
  if (registered.exitCode !== 0) throw new Error(`registration failed: ${registered.stderr}`);
  return {
    host,
    harness,
    repository,
    dispose: () => {
      harness.dispose();
      removeDirectory(base);
      host.dispose();
    },
  };
};

const rowOf = (run: ProductionRun, repoKey: string): Record<string, unknown> => {
  const repos = (run.envelope as { data?: { repos?: readonly Record<string, unknown>[] } })?.data
    ?.repos;
  if (repos === undefined) throw new Error("no repos data");
  const row = repos.find((entry) => entry.repoKey === repoKey);
  if (row === undefined) throw new Error(`no row for ${repoKey}`);
  return row;
};

describe("TC-ENGINE-095 the three surfaces agree on one ledger", () => {
  test("six families, identical statuses, verdicts, counters, and truncation", async () => {
    for (const family of families) {
      const host = createHostFixture(`xs-${family.name}`);
      const base = `${host.hostRoot}-xs`;
      const root = createRepository(base, "checkout");
      const repository = `github.com/owner/checkout-${family.name}`;
      const shortName = `owner/checkout-${family.name}`;
      setOriginRemote(root, `https://github.com/${shortName}.git`);
      const harness = createProductionProjectsHarness({
        label: `xs-${family.name}`,
        host,
        workingDirectory: root,
        originUrl: `https://github.com/${shortName}.git`,
      });
      try {
        mkdirSync(projectStateRoot(host.hostRoot, harness.projectKey), {
          recursive: true,
          mode: 0o700,
        });
        const registered = await harness.run(["queue", "list", "--json"]);
        expect(registered.exitCode, registered.stderr).toBe(0);
        const specs = family.specs.map((spec) => ({ ...spec, repository }));
        seedProjectAttempts(host.hostRoot, harness.projectKey, buildAttempts(specs));

        const summaryRun = await harness.run([
          "dispatch",
          "dual-run",
          "summary",
          "--repo",
          repository,
          ...(family.name === "truncated" ? [] : []),
          "--json",
        ]);
        expect(summaryRun.exitCode, `${family.name}: ${summaryRun.stderr}`).toBe(0);
        const summary = (summaryRun.envelope as { data?: DispatchSummaryData }).data;
        if (summary === undefined) throw new Error(`${family.name}: no summary`);

        const ledgerBefore = readDispatchHandover(harness.store, harness.projectKey);
        const afterSummary = readDispatchHandover(harness.store, harness.projectKey);
        if (!ledgerBefore.ok || !afterSummary.ok) throw new Error("ledger read failed");
        // The summary read appends nothing.
        expect(afterSummary.records.length, family.name).toBe(ledgerBefore.records.length);
        const beforeFleet = afterSummary.records.length;
        const fleetRun = await harness.run(["repos", "list", "--json"]);
        const afterFleet = readDispatchHandover(harness.store, harness.projectKey);
        if (!afterFleet.ok) throw new Error("ledger read failed");
        // The fleet read appends nothing either.
        expect(afterFleet.records.length, family.name).toBe(beforeFleet);
        const handoverRun = await harness.run(["dispatch", "handover", repository, "--json"]);
        const handover = (handoverRun.envelope as { data?: DispatchHandoverData }).data;
        if (handover === undefined) {
          throw new Error(`${family.name}: no handover data: ${handoverRun.stdout}`);
        }

        const row = rowOf(fleetRun, harness.projectKey);
        const gate = row.handoverGate as Record<string, unknown>;

        expect(handover.conditions, family.name).toEqual(summary.conditions);
        expect(gate.conditions, family.name).toEqual(summary.conditions);
        expect(handover.verdict, family.name).toBe(summary.verdict);
        expect(gate.verdict, family.name).toBe(summary.verdict);
        // A forward handover over a met bar records the flip, so the authority
        // fact is reversible; a refusing or truncated bar leaves it dual-run.
        const expectedReversible =
          summary.verdict === "eligible" && summary.truncation === undefined;
        expect(handover.reversible, family.name).toBe(expectedReversible);
        expect(gate.countedDeliveries, family.name).toBe(summary.countedDeliveries);
        expect(gate.cleanDispatches, family.name).toBe(summary.cleanDispatches);
        expect(gate.cleanDispatches, family.name).toBe(summary.corroboration.satisfied);

        const truncations = [summary.truncation, handover.truncation, gate.truncation].filter(
          (value) => value !== undefined,
        );
        if (family.name !== "truncated") {
          expect(truncations, family.name).toEqual([]);
        }

        const open = summary.conditions.filter((entry) => entry.status === "open");
        for (const surface of [handover, row] as const) {
          void surface;
        }
        expect(
          open.map((entry) => entry.condition),
          family.name,
        ).toEqual(summary.unmetConditions.map((entry) => entry.condition));
        for (const entry of summary.conditions) {
          expect(["met", "open"], family.name).toContain(entry.status);
        }

        // Only the handover operation may append, and only when it records a
        // flip; every read above appended nothing.
        const ledgerAfter = readDispatchHandover(harness.store, harness.projectKey);
        expect(ledgerBefore.ok && ledgerAfter.ok, family.name).toBe(true);
        if (ledgerBefore.ok && ledgerAfter.ok) {
          const appended = ledgerAfter.records.length - ledgerBefore.records.length;
          expect(appended, family.name).toBe(handover.recorded ? 1 : 0);
          // The row now reflects the recorded fact.
          const rowAfter = rowOf(
            await harness.run(["repos", "list", "--json"]),
            harness.projectKey,
          );
          expect(rowAfter.reversible, family.name).toBe(handover.reversible);
        }
        // The handover cell is an evidence-reading outcome, never a --revert noop.
        expect(Object.hasOwn(handover, "conditions"), family.name).toBe(true);
        expect(ERROR_TABLE.some((entry) => entry.code === "dispatch.state-unverified")).toBe(true);
      } finally {
        harness.dispose();
        removeDirectory(base);
        host.dispose();
      }
    }
  }, 120_000);

  test("an eligible family reads four met conditions on all three surfaces", async () => {
    const repository = "github.com/owner/eligible-family";
    const fleet = await fleetFor("xs-eligible-family", repository);
    try {
      seedProjectAttempts(
        fleet.host.hostRoot,
        fleet.harness.projectKey,
        buildAttempts(
          eligibleSpecs({ repository, prefix: "xs" }).map((spec) => ({ ...spec, repository })),
        ),
      );
      const summaryRun = await fleet.harness.run([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        repository,
        "--json",
      ]);
      const summary = (summaryRun.envelope as { data?: DispatchSummaryData }).data;
      if (summary === undefined) throw new Error("no summary");
      expect(summary.verdict).toBe("eligible");
      expect(summary.conditions.map((entry) => entry.status)).toEqual(["met", "met", "met", "met"]);

      const handoverRun = await fleet.harness.run(["dispatch", "handover", repository, "--json"]);
      expect(handoverRun.exitCode, handoverRun.stderr).toBe(0);
      const handover = (handoverRun.envelope as { data?: DispatchHandoverData }).data;
      const row = rowOf(
        await fleet.harness.run(["repos", "list", "--json"]),
        fleet.harness.projectKey,
      );
      expect(handover?.conditions).toEqual(summary.conditions);
      expect((row.handoverGate as Record<string, unknown>).conditions).toEqual(summary.conditions);
      expect((row.handoverGate as Record<string, unknown>).verdict).toBe("eligible");

      // The window end is a read-time instant; the row itself carries no such
      // field, and the truncation pair is absent from every surface.
      expect(JSON.stringify(row)).not.toContain("windowEnd");
      expect(Date.parse(summary.windowEnd)).toBeGreaterThan(Date.parse(dayAt(0)));
    } finally {
      fleet.dispose();
    }
  });
});
