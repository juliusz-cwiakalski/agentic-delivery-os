/**
 * GH-288 TC-PROJ-025 — the owner hold stays host-wide across projects.
 *
 * The marker is read at the host root only: a marker inside a project root has
 * no effect, which is the direct assertion that the hold was not narrowed
 * (DEC-9, RSK-9). The environment source keeps its precedence over the marker.
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OWNER_HOLD_MARKER_NAME } from "../../packages/core/src/contracts/owner-hold";
import {
  createProductionProjectsHarness,
  type ProductionProjectsHarness,
  type ProductionRun,
} from "../fixtures/projects/production";
import { createHostFixture } from "../fixtures/projects/state-scope";
import { createRepository, removeDirectory } from "../fixtures/projects/temp-repos";

type Evidence = { readonly source?: string; readonly reason?: string };

const dataOf = (run: ProductionRun): Record<string, unknown> => {
  const data = run.envelope?.data as Record<string, unknown> | undefined;
  if (data === undefined) throw new Error(`no data envelope: ${run.stdout}${run.stderr}`);
  return data;
};

/** The owner-hold evidence the status digest projects. */
const ownerHoldOf = (run: ProductionRun): Evidence | undefined => {
  const sections = dataOf(run).sections as readonly Record<string, unknown>[] | undefined;
  if (sections === undefined) return undefined;
  const providers = sections.find((section) => section.id === "providers");
  const evidence = providers?.evidence as Record<string, unknown> | undefined;
  return evidence?.ownerHold as Evidence | undefined;
};

const markerPathOf = (hostRoot: string): string => join(hostRoot, OWNER_HOLD_MARKER_NAME);

const writeHold = (hostRoot: string, reason: string): void => {
  mkdirSync(hostRoot, { recursive: true });
  writeFileSync(markerPathOf(hostRoot), `${reason}\n`);
};

describe("TC-PROJ-025 the owner hold is host-wide", () => {
  it("both checkouts observe a host-root hold, a project-local marker has no effect", async () => {
    const host = createHostFixture("owner-hold-scope");
    const base = `${host.hostRoot}-repos`;
    const harnesses: ProductionProjectsHarness[] = [];
    try {
      const alpha = createRepository(base, "hold-alpha");
      const beta = createRepository(base, "hold-beta");
      const a = createProductionProjectsHarness({
        label: "hold-alpha",
        host,
        workingDirectory: alpha,
        originUrl: "https://github.com/owner/hold-alpha.git",
      });
      const b = createProductionProjectsHarness({
        label: "hold-beta",
        host,
        workingDirectory: beta,
        originUrl: "https://github.com/owner/hold-beta.git",
      });
      harnesses.push(a, b);
      for (const harness of [a, b]) {
        expect((await harness.run(["queue", "list", "--json"])).exitCode).toBe(0);
      }

      // Step 1: the host-root marker is observed by both checkouts.
      writeHold(host.hostRoot, "peak-hour cost pause");
      for (const harness of [a, b]) {
        const status = await harness.run(["status", "--json"]);
        expect(status.exitCode).toBe(0);
        expect(ownerHoldOf(status)).toMatchObject({ source: "marker" });
        expect(ownerHoldOf(status)?.reason).toBe("peak-hour cost pause");
        const plan = await harness.run(["queue", "plan", "--json"]);
        expect(plan.exitCode).toBe(0);
      }

      // Step 2: with the marker removed, neither observes a hold.
      rmSync(markerPathOf(host.hostRoot), { force: true });
      for (const harness of [a, b]) {
        const status = await harness.run(["status", "--json"]);
        expect(status.exitCode).toBe(0);
        expect(ownerHoldOf(status)).toBeUndefined();
      }

      // Step 3: a marker inside project A's root has no effect on either checkout.
      mkdirSync(a.stateLocation, { recursive: true });
      writeFileSync(join(a.stateLocation, OWNER_HOLD_MARKER_NAME), "project-local hold\n");
      for (const harness of [a, b]) {
        const status = await harness.run(["status", "--json"]);
        expect(status.exitCode).toBe(0);
        expect(ownerHoldOf(status)).toBeUndefined();
      }

      // Step 4: the environment source outranks the marker, for both projects.
      writeHold(host.hostRoot, "marker reason");
      const prefix = a.brand.environmentPrefix;
      const overrideVariable = `${prefix.endsWith("_") ? prefix : `${prefix}_`}OWNER_HOLD`;
      const withOverride = (harness: ProductionProjectsHarness) =>
        createProductionProjectsHarness({
          label: "hold-override",
          host,
          workingDirectory: harness.checkout,
          originUrl: "https://github.com/owner/hold-override.git",
          environmentExtra: { [overrideVariable]: "environment reason" },
        });
      for (const harness of [a, b]) {
        const overridden = withOverride(harness);
        harnesses.push(overridden);
        const status = await overridden.run(["status", "--json"]);
        expect(status.exitCode).toBe(0);
        expect(ownerHoldOf(status)).toMatchObject({ source: "env" });
        expect(ownerHoldOf(status)?.reason).toBe("environment reason");
      }
    } finally {
      for (const harness of harnesses) harness.dispose();
      removeDirectory(base);
      host.dispose();
    }
  });
});
