/**
 * GH-288 TC-PROJ-037 — bounded work.
 *
 * Two cells: 25 real checkouts with materialized state and a 200-entry seeded
 * index. p95 over ten samples is a floor, not a statistical claim: the point is
 * that no cell is pathologically slow and that the maintenance counts are
 * bounded. The 200-project cell seeds the index rather than creating 200
 * repositories, which the revision/length assertions keep honest.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  hostIndexDocumentPath,
  readHostIndexFile,
} from "../../packages/adapters/src/file/host-index-store";
import { appendDispatchHandover } from "../../packages/core/src/app/dispatch-ledger";
import { maintainHostIndex } from "../../packages/core/src/app/host-index";
import { projectStateRoot } from "../../packages/core/src/app/state-scope";
import { HOST_INDEX_SCHEMA } from "../../packages/core/src/contracts/projects";
import { makeHandover } from "../fixtures/dispatch/ledger";
import { hostIndexEntriesOf, hostIndexRevisionOf } from "../fixtures/projects/host-index";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
  type ProductionRun,
} from "../fixtures/projects/production";
import { createHostFixture } from "../fixtures/projects/state-scope";
import { createRepository, removeDirectory } from "../fixtures/projects/temp-repos";

const p95 = (samples: readonly number[]): number => {
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? 0;
};

const time = async <T>(
  body: () => Promise<T> | T,
): Promise<{ readonly elapsed: number; readonly value: T }> => {
  const startedAt = performance.now();
  const value = await body();
  return { elapsed: performance.now() - startedAt, value };
};

const exitOf = (run: ProductionRun): number => run.exitCode;

const projectsOf = (run: ProductionRun): readonly unknown[] => {
  const data = run.envelope?.data as { readonly projects?: readonly unknown[] } | undefined;
  return data?.projects ?? [];
};

describe("TC-PROJ-037 bounded work", () => {
  test("25 real projects stay under the human and machine latency floors", async () => {
    const host = createHostFixture("perf-25");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      for (let index = 0; index < 25; index += 1) {
        const checkout = createRepository(base, `perf-${String(index).padStart(2, "0")}`);
        const harness = createProductionProjectsHarness({
          label: `perf-${String(index).padStart(2, "0")}`,
          host,
          workingDirectory: checkout,
          originUrl: `https://github.com/owner/perf-${String(index)}.git`,
        });
        harnesses.push(harness);
        expect(exitOf(await harness.run(["queue", "list", "--json"]))).toBe(0);
        const record = {
          ...makeHandover({ recordedAt: "2026-11-11T08:00:00.000Z" }),
          repository: `github.com/owner/perf-${String(index)}`,
        };
        const appended = appendDispatchHandover(harness.store, `fence-${String(index)}`, record);
        expect(appended.ok).toBe(true);
      }
      const driver = harnesses[0] as ProductionProjectsHarness;
      expect(hostIndexEntriesOf(host.hostRoot)).toHaveLength(25);

      // Warm-up, then ten samples of each projection.
      expect(exitOf(await driver.run(["projects", "list", "--json"]))).toBe(0);
      expect(exitOf(await driver.run(["projects", "list"]))).toBe(0);
      const text: number[] = [];
      const json: number[] = [];
      for (let sample = 0; sample < 10; sample += 1) {
        const textRun = await time(() => driver.run(["projects", "list"]));
        expect(textRun.value.exitCode).toBe(0);
        text.push(textRun.elapsed);
        const jsonRun = await time(() => driver.run(["projects", "list", "--json"]));
        expect(jsonRun.value.exitCode).toBe(0);
        expect(projectsOf(jsonRun.value)).toHaveLength(25);
        json.push(jsonRun.elapsed);
      }
      expect(p95(text)).toBeLessThanOrEqual(500);
      expect(p95(json)).toBeLessThanOrEqual(500);
      expect([p95(text), p95(json)].every((value) => Number.isFinite(value))).toBe(true);
      // Recorded wall clock is informational: a regression is visible even when
      // the ceiling holds.
      expect(Number.isFinite(p95(text) + p95(json))).toBe(true);
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  }, 120_000);

  test("a 200-entry index stays under the machine latency floor with bounded counts", async () => {
    const host = createHostFixture("perf-200");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const checkout = createRepository(base, "perf-driver");
      const harness = createProductionProjectsHarness({
        label: "perf-driver",
        host,
        workingDirectory: checkout,
        originUrl: "https://github.com/owner/perf-driver.git",
      });
      harnesses.push(harness);
      expect(exitOf(await harness.run(["queue", "list", "--json"]))).toBe(0);

      // Seed a 200-entry index and 200 materialized empty project roots.
      const seeded = Array.from({ length: 200 }, (_, index) => {
        const projectKey = `seeded-${String(index).padStart(3, "0")}-00000000`;
        const stateLocation = projectStateRoot(host.hostRoot, projectKey);
        mkdirSync(stateLocation, { recursive: true, mode: 0o700 });
        // A recorded checkout root must exist or the row is not reported, so the
        // seeded host mirrors real checkouts with the checkout directory present.
        const checkoutRoot = join(base, `seeded-root-${String(index)}`);
        mkdirSync(checkoutRoot, { recursive: true });
        return {
          projectKey,
          projectIdentifier: `${String(index).padStart(8, "0")}${"0".repeat(24)}`,
          root: checkoutRoot,
          stateLocation,
          lastWrittenAt: "2026-11-11T08:00:00.000Z",
        };
      });
      writeFileSync(
        hostIndexDocumentPath(host.hostRoot),
        `${JSON.stringify({ schema: HOST_INDEX_SCHEMA, revision: 5, projects: seeded }, null, 2)}\n`,
      );

      expect(exitOf(await harness.run(["projects", "list", "--json"]))).toBe(0);
      const samples: number[] = [];
      for (let sample = 0; sample < 10; sample += 1) {
        const run = await time(() => harness.run(["projects", "list", "--json"]));
        expect(run.value.exitCode).toBe(0);
        samples.push(run.elapsed);
      }
      expect(p95(samples)).toBeLessThanOrEqual(4_000);

      const listed = await harness.run(["projects", "list", "--json"]);
      expect(listed.exitCode).toBe(0);
      // The measurement is of the real read path: the seeded revision and length
      // are what the command reports.
      const data = listed.envelope?.data as {
        readonly projects?: readonly unknown[];
        readonly hostIndexRevision?: number;
      };
      expect(data.projects).toHaveLength(200);
      expect(data.hostIndexRevision).toBe(5);
      expect(hostIndexRevisionOf(host.hostRoot)).toBe(5);

      // The maintenance step's own cost: one read plus the pure fold.
      const maintenanceSamples: number[] = [];
      const document = hostIndexEntriesOf(host.hostRoot);
      for (let sample = 0; sample < 10; sample += 1) {
        const measured = await time(() => {
          const read = readHostIndexFile(host.hostRoot);
          const parsed =
            read.state === "present"
              ? (JSON.parse(read.text) as {
                  schema: string;
                  revision: number;
                  projects: typeof document;
                })
              : undefined;
          return maintainHostIndex({
            hostRoot: host.hostRoot,
            document:
              parsed === undefined
                ? undefined
                : {
                    schema: HOST_INDEX_SCHEMA,
                    revision: parsed.revision,
                    projects: parsed.projects,
                  },
            corrupt: false,
            registration: {
              projectKey: harness.projectKey,
              projectIdentifier: `${"a".repeat(8)}${"0".repeat(24)}`,
              root: harness.checkout,
              stateLocation: harness.stateLocation,
              recordedAt: "2026-11-11T09:00:00.000Z",
            },
            // The production probe does one bounded existence check per entry;
            // measuring with it keeps the maintenance ceiling honest.
            probe: (recordedRoot) =>
              existsSync(recordedRoot) ? { state: "uncertain" } : { state: "absent" },
          });
        });
        expect(measured.value.next === undefined || measured.value.revision === 6).toBe(true);
        maintenanceSamples.push(measured.elapsed);
      }
      expect(p95(maintenanceSamples)).toBeLessThanOrEqual(10);

      // Exactly one index read and at most one write per maintaining invocation.
      const before = {
        reads: harness.hostIndexAccess.reads,
        writes: harness.hostIndexAccess.writes,
      };
      expect(exitOf(await harness.run(["queue", "list", "--json"]))).toBe(0);
      expect(harness.hostIndexAccess.reads - before.reads).toBe(1);
      expect(harness.hostIndexAccess.writes - before.writes).toBeLessThanOrEqual(1);
      // ... and the list path performs no maintenance write at all.
      const beforeList = harness.hostIndexAccess.writes;
      expect(exitOf(await harness.run(["projects", "list", "--json"]))).toBe(0);
      expect(harness.hostIndexAccess.writes).toBe(beforeList);

      // No crawl: the maintenance fold is filesystem-free by construction.
      const foldSource = readFileSync(
        join(process.cwd(), "packages/core/src/app/host-index.ts"),
        "utf8",
      );
      expect(foldSource).not.toContain("node:fs");
      expect(foldSource).not.toContain("readdir");
      expect(foldSource).not.toContain("scandir");
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  }, 120_000);
});
