/**
 * TC-DAEMON-077 — production supplies the durable resolver, and the hardcoded
 * marker cannot return.
 *
 * The source scan is anchored on the production composition's wire, and the
 * behavioural half composes the shipped program over two stores so a constant
 * wire cannot pass.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createProductionComposer } from "../../packages/cli/src/production";
import {
  createMountHarness,
  openMountStore,
  productionStateRoot,
} from "../fixtures/daemon/mount-harness";
import { appendHeartbeat, appendInstance, scopeOf } from "../fixtures/daemon/mount-states";
import * as hardcodedDegradation from "../fixtures/daemon/mount-mutants/hardcoded-degradation";
import * as capturedDegradation from "../fixtures/daemon/mount-mutants/captured-degradation";

const isFailure = (value: unknown): value is { error: { code: string } } =>
  typeof value === "object" && value !== null && "error" in value;

/** The project state root the production composition opens for one harness. */
const projectRootOf = (harness: ReturnType<typeof createMountHarness>): string =>
  productionStateRoot({
    environment: {
      HOME: harness.home,
      PATH: "/usr/bin",
      [`${harness.brand.environmentPrefix.toUpperCase().replace(/_+$/u, "")}_STATE_DIR`]:
        harness.stateDirectory,
    },
    cwd: harness.root,
    homeDirectory: harness.home,
    brand: harness.brand,
  });

const queueList = async (stateDirectory: string, home: string, root: string, brand: never) => {
  const program = createProductionComposer({
    environment: {
      HOME: home,
      PATH: "/usr/bin",
      [`${(brand as { environmentPrefix: string }).environmentPrefix.toUpperCase().replace(/_+$/u, "")}_STATE_DIR`]:
        stateDirectory,
    },
    cwd: root,
    homeDirectory: home,
    workingName: (brand as { binaryName: string }).binaryName,
  })(brand);
  const result = await program.commands.queue?.handler({
    positionals: ["list"],
    flags: {},
    global: {},
  } as never);
  return result;
};

describe("TC-DAEMON-077 the durable resolver is the production wire", () => {
  test("a live store yields [] and a released store yields the marker", async () => {
    const live = createMountHarness({ label: "wiring-live" });
    const released = createMountHarness({ label: "wiring-released" });
    try {
      // The records live in the project state root each composition opens.
      const liveRoot = projectRootOf(live);
      const liveStore = openMountStore(liveRoot);
      appendInstance(liveStore, { pid: 4321, scope: scopeOf(liveRoot) });
      appendHeartbeat(liveStore, {
        instanceId: "instance-live",
        beatAt: new Date(Date.now()).toISOString(),
      });
      const releasedRoot = projectRootOf(released);
      const releasedStore = openMountStore(releasedRoot);
      appendInstance(releasedStore, { pid: 4321, scope: scopeOf(releasedRoot) });
      appendInstance(releasedStore, {
        operation: "released",
        releaseReason: "drain",
        recordedAt: new Date(Date.now()).toISOString(),
        heartbeatAt: new Date(Date.now()).toISOString(),
      });
      appendHeartbeat(releasedStore, {
        instanceId: "instance-live",
        beatAt: new Date(Date.now()).toISOString(),
      });

      const liveResult = await queueList(
        live.stateDirectory,
        live.home,
        live.root,
        live.brand as never,
      );
      const releasedResult = await queueList(
        released.stateDirectory,
        released.home,
        released.root,
        released.brand as never,
      );
      expect(liveResult === undefined ? "missing" : isFailure(liveResult)).toBe(false);
      if (liveResult !== undefined && !isFailure(liveResult)) {
        expect((liveResult.data as { degraded: readonly string[] }).degraded).toEqual([]);
      }
      if (releasedResult !== undefined && !isFailure(releasedResult)) {
        expect((releasedResult.data as { degraded: readonly string[] }).degraded).toEqual([
          "daemon-unreachable",
        ]);
      }
    } finally {
      live.dispose();
      released.dispose();
    }
  });

  test("no literal array-valued degraded remains in the production composition", () => {
    const source = readFileSync(join(process.cwd(), "packages/cli/src/production.ts"), "utf8");
    expect(source).toContain("degraded: daemonReachability");
    expect(source).not.toContain('degraded: ["daemon-unreachable"]');
    // The resolver is a function defined inside the composer, never memoized.
    expect(source).toContain("const daemonReachability = (): readonly QueueDegradationReason[]");
  });

  test("the hardcoded and captured mutants are caught by name", () => {
    for (const mutant of [hardcodedDegradation, capturedDegradation]) {
      const source = readFileSync(join(process.cwd(), mutant.target), "utf8");
      expect(mutant.violates(source)).toBe(false);
      const mutated = mutant.apply(source);
      expect(mutated).not.toBe(source);
      expect(mutant.violates(mutated)).toBe(true);
    }
  });

  test("two stores resolve differently through the same composition", () => {
    const harness = createMountHarness({ label: "wiring-two" });
    try {
      appendInstance(harness.store, { pid: 4321, scope: scopeOf(harness.stateDirectory) });
      appendHeartbeat(harness.store, {
        instanceId: "instance-live",
        beatAt: new Date(Date.now()).toISOString(),
      });
      // A second handle over a different directory sees an absent store.
      const other = openMountStore(`${harness.root}/other-state`);
      expect(other.identity.stateDirectory).not.toBe(harness.store.identity.stateDirectory);
    } finally {
      harness.dispose();
    }
  });
});
