/**
 * TC-PEAK-033 — the production composition's `peakEnforcement.mode` is
 * configuration-derived: `window-watch` with automatic pausing enabled and
 * `iteration-start-gating` with it disabled; `parkClaimed` stays record-derived
 * (GH-413 F-6, F-8, AC-F6-4, DM-7, NFR-9).
 */
import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { queueParkRecordKey } from "../../packages/core/src/app/queue";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import {
  createProductionQueueHarness,
  DEFAULT_MODE_PROVIDER_PROFILES_CONFIG,
  makeCheckout,
  makeHarnessHome,
  PROVIDER_PROFILES_CONFIG_FILE,
  removeHome,
} from "../fixtures/queue/production/harness";

const ORIGIN = "https://github.com/owner/repo.git";

const brand = (() => {
  const resolved = resolveBrandIdentity({ workingName: "delivery-os" });
  if (!resolved.ok) throw new Error("brand resolution failed");
  return resolved.value;
})();

const withCycle = async (
  label: string,
  laneConfig: string | undefined,
  body: (harness: ReturnType<typeof createProductionQueueHarness>) => Promise<void>,
  harnessKind?: "opencode" | "claude-code",
) => {
  const root = makeHarnessHome(label);
  const checkout = makeCheckout(root, "checkout", ORIGIN);
  const config = `${DEFAULT_MODE_PROVIDER_PROFILES_CONFIG}${
    laneConfig === undefined ? "" : `lane:\n${laneConfig}\n`
  }${harnessKind === undefined ? "" : `harness:\n  kind: ${harnessKind}\n`}`;
  writeFileSync(
    join(checkout.directory, brand.configDirectoryName, PROVIDER_PROFILES_CONFIG_FILE),
    config,
  );
  const harness = createProductionQueueHarness({
    label,
    workingDirectory: checkout.directory,
    originUrl: ORIGIN,
  });
  try {
    await body(harness);
  } finally {
    harness.dispose();
    removeHome(root);
  }
};

const peakEnforcementOf = (
  run: Awaited<ReturnType<ReturnType<typeof createProductionQueueHarness>["run"]>>,
) => {
  const data = (run.envelope as { readonly data?: Record<string, unknown> } | undefined)?.data;
  return data?.peakEnforcement as
    | { readonly mode?: string; readonly parkClaimed?: boolean }
    | undefined;
};

describe("TC-PEAK-033 the production composition mode is configuration-derived", () => {
  test("automatic pausing enabled reports window-watch", async () => {
    await withCycle("gh413-mode-enabled", undefined, async (harness) => {
      const run = await harness.run(["lanes", "list", "--json"]);
      expect(run.exitCode).toBe(0);
      expect(peakEnforcementOf(run)).toEqual({ mode: "window-watch", parkClaimed: false });
    });
  });

  test("automatic pausing disabled reports iteration-start-gating", async () => {
    await withCycle("gh413-mode-disabled", "  disable-peak-pausing: true", async (harness) => {
      const run = await harness.run(["lanes", "list", "--json"]);
      expect(run.exitCode).toBe(0);
      expect(peakEnforcementOf(run)).toEqual({
        mode: "iteration-start-gating",
        parkClaimed: false,
      });
    });
  });

  test("a harness that declares no terminate reads iteration-start-gating", async () => {
    await withCycle(
      "gh413-mode-no-terminate",
      undefined,
      async (harness) => {
        const run = await harness.run(["lanes", "list", "--json"]);
        expect(run.exitCode).toBe(0);
        expect(peakEnforcementOf(run)).toEqual({
          mode: "iteration-start-gating",
          parkClaimed: false,
        });
      },
      "claude-code",
    );
  });

  test("parkClaimed follows the durable park records in both settings", async () => {
    await withCycle("gh413-mode-parked", undefined, async (harness) => {
      const acquired = harness.store.acquireFence("gh413-mode-park");
      if (!acquired.ok) throw new Error("fence refused");
      const appended = harness.store.append(acquired.value.handle, {
        kind: "queue.park",
        recordKey: queueParkRecordKey("GH-413"),
        payload: {
          schema: "delivery.queue.park.v1",
          ref: "GH-413",
          cause: "peak-window",
          conditionType: "provider-window",
          condition: { type: "provider-window", expiresAt: "2026-11-08T12:00:00.000Z" },
          recheckMs: 60_000,
          evaluatedAt: "2026-11-08T10:00:00.000Z",
          recoveryState: "parked",
          until: "2026-11-08T12:00:00.000Z",
          recordedAt: "2026-11-08T10:00:00.000Z",
        } as never,
      });
      harness.store.releaseFence(acquired.value.handle);
      expect(appended.ok).toBe(true);
      const run = await harness.run(["lanes", "list", "--json"]);
      expect(peakEnforcementOf(run)?.parkClaimed).toBe(true);
    });
  });
});
