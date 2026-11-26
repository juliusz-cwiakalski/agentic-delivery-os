/**
 * TC-PEAK-005 / TC-PEAK-019 — production-composition arms for the watch
 * precondition (a harness without terminate composes no watch) and an
 * unconfirmed stop (no park is written) through the real
 * `createProductionComposer` (GH-413 F-6, AC-F2-2, AC-F6-4, AC-F9-2).
 */
import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { readQueueParks } from "../../packages/core/src/app/index";
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

const peakWindowConfig = (extra: string): string =>
  `${DEFAULT_MODE_PROVIDER_PROFILES_CONFIG}`
    .replace(
      `      base:
        tier: build`,
      `      base:
        tier: build
        peakWindows:
          graceSeconds: 20
          windows:
            - { timezone: UTC, startSecondsOfDay: 21600, endSecondsOfDay: 36000, multiplier: 2, bufferBeforeSeconds: 60, bufferAfterSeconds: 60 }`,
    )
    .concat(
      `lane:\n  liveness-interval: 100\n  restart-budget: 3\n  disable-worktrees: true\n${extra}`,
    );

const withComposition = async (
  label: string,
  config: string,
  body: (harness: ReturnType<typeof createProductionQueueHarness>) => Promise<void>,
  clock?: { readonly nowMs: () => number; readonly nowIso: () => string },
) => {
  const root = makeHarnessHome(label);
  const checkout = makeCheckout(root, "checkout", ORIGIN);
  writeFileSync(
    join(checkout.directory, brand.configDirectoryName, PROVIDER_PROFILES_CONFIG_FILE),
    config,
  );
  const harness = createProductionQueueHarness({
    label,
    workingDirectory: checkout.directory,
    originUrl: ORIGIN,
    ...(clock === undefined ? {} : { clock }),
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
  return data?.peakEnforcement as { readonly mode?: string } | undefined;
};

describe("TC-PEAK-005 a terminate-less harness composes no watch and reads iteration-start-gating", () => {
  test("claude-code inside an open window writes no park and the mode is iteration-start-gating", async () => {
    await withComposition(
      "gh413-prod-no-terminate",
      peakWindowConfig("harness:\n  kind: claude-code\n"),
      async (harness) => {
        expect((await harness.run(["queue", "add", "GH-413", "--json"])).exitCode).toBe(0);
        await harness.run(["dispatch", "GH-413", "--json"]);
        const parks = readQueueParks(harness.store);
        expect(parks.ok).toBe(true);
        if (!parks.ok) return;
        expect(parks.records).toHaveLength(0);
        const lanes = await harness.run(["lanes", "list", "--json"]);
        expect(peakEnforcementOf(lanes)?.mode).toBe("iteration-start-gating");
      },
    );
  });
});

describe("TC-PEAK-019 an unconfirmed terminate writes no park in production", () => {
  test("an opencode session with no matching live identity appends no park", async () => {
    await withComposition("gh413-prod-unconfirmed", peakWindowConfig(""), async (harness) => {
      // The window is open (06:00-10:00 UTC) and the harness claims opencode,
      // but the terminate seam has no live exact identity for the scripted
      // session, so the stop is unconfirmed and no park is written.
      expect((await harness.run(["queue", "add", "GH-413", "--json"])).exitCode).toBe(0);
      await harness.run(["dispatch", "GH-413", "--json"]);
      const parks = readQueueParks(harness.store);
      expect(parks.ok).toBe(true);
      if (!parks.ok) return;
      expect(parks.records).toHaveLength(0);
    });
  });
});
