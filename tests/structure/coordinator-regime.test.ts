/**
 * TC-COORD-014 — the regime descriptor is shared, foreground-only in v1,
 * declares the M1-S18 seam, and ships no installer.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COORDINATOR_REGIME } from "../../packages/core/src/contracts/index";
import { projectCoordinatorRegime } from "../../packages/core/src/domain/index";

const ROOT = process.cwd();

describe("TC-COORD-014 the regime descriptor is shared and foreground-only", () => {
  test("the descriptor declares the shared regime fields", () => {
    expect(COORDINATOR_REGIME).toEqual({
      scope: "state-dir",
      processKind: "coordinator",
      budgetStore: "coordinator-restart",
      leaseKind: "append-only-instance-lease",
      supervisorMode: "foreground",
      externalUnit: "absent",
      daemonInstallSeam: "M1-S18",
      collectionBoundMultiplier: 2,
    });
    const regime = projectCoordinatorRegime({ stateDirectory: "/state", coordinatorId: "c-1" });
    expect(regime.scope).toBe("state-dir");
    expect(regime.unitIdentity).toBe("coordinator@/state#c-1");
    expect(regime.processKind).toBe("coordinator");
    expect(regime.budgetStore).toBe("coordinator-restart");
    expect(regime.supervisorMode).toBe("foreground");
    expect(regime.externalUnit).toBe("absent");
    expect(regime.daemonInstallSeam).toBe("M1-S18");
  });

  test("the family ships no coordinator installer or unit renderer", () => {
    const command = readFileSync(join(ROOT, "packages/cli/src/commands/coordinator.ts"), "utf8");
    for (const forbidden of [
      "coordinator install",
      "coordinator uninstall",
      "renderSystemdUnit",
      "systemd",
      "launchd",
    ]) {
      expect(command).not.toContain(forbidden);
    }
    const loop = readFileSync(join(ROOT, "packages/cli/src/commands/coordinator-loop.ts"), "utf8");
    for (const forbidden of [
      "renderSystemdUnit",
      "SupervisorInstallRequest",
      "installSupervisor",
    ]) {
      expect(loop).not.toContain(forbidden);
    }
  });

  test("detached is reserved and never produced in v1", () => {
    const loop = readFileSync(join(ROOT, "packages/cli/src/commands/coordinator-loop.ts"), "utf8");
    expect(loop).toContain("COORDINATOR_V1_SUPERVISOR_MODE");
    expect(loop).not.toContain('supervisorMode: "detached"');
  });

  test("a coordinator OS-hosting gap is declared naming M1-S18", () => {
    expect(COORDINATOR_REGIME.daemonInstallSeam).toBe("M1-S18");
    const command = readFileSync(join(ROOT, "packages/cli/src/commands/coordinator.ts"), "utf8");
    expect(command).toContain("M1-S18");
  });
});
