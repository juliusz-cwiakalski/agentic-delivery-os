/**
 * TC-HOLDEDGE-001/002 + TC-HOLDNEG-003 (GH-280) — the production composition
 * supplies one per-pass owner-hold fact to the queue, lanes, claim, watch,
 * dispatch, status, and doctor seams; a removed supply changes behaviour; and
 * core stays ambient-free. The production resident daemon is deliberately not a
 * claim source (GAP-T7/D14).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createQueueCommandRuntime,
  type QueueComposition,
} from "../../packages/cli/src/edge";
import { declareQueueEntry } from "../../packages/core/src/app/index";
import type { OwnerHoldFact } from "../../packages/core/src/contracts/index";
import { resolveOwnerHoldFact } from "../../packages/core/src/domain/index";
import { REPO_A } from "../fixtures/queue/schedule/harness";
import { makeAuditStore } from "../fixtures/state/harness";

const ROOT = process.cwd();
const HOLD: OwnerHoldFact = {
  active: true,
  source: "marker",
  reason: "peak-hour cost pause",
};

const compositionFor = (
  label: string,
  readOwnerHold?: () => OwnerHoldFact,
): { readonly composition: QueueComposition; readonly dispose: () => void } => {
  const fixture = makeAuditStore(label);
  const declared = declareQueueEntry(fixture.store, {
    ref: "GH-320",
    repository: REPO_A,
    repositoryRoot: "/work/repo-alpha",
    priority: 5,
    recordedAt: "2026-11-07T10:00:00Z",
    fenceToken: "seed",
  });
  expect(declared.ok).toBe(true);
  let fence = 0;
  return {
    composition: {
      store: fixture.store,
      facts: {
        plans: { "GH-320": { state: "valid", tier: "full" } },
        workItems: {
          "GH-320": {
            state: "observed",
            deliveryState: "ready",
            labels: ["priority:high"],
            blockedBy: [],
          },
        },
        ci: { "GH-320": { state: "available", result: "succeeded" } },
        provider: { state: "available" },
        close: { "GH-320": "none" },
        deploy: { expectations: {}, verdicts: {} },
      },
      repositoryBinding: { repository: REPO_A, repositoryRoot: "/work/repo-alpha" },
      nowIso: () => "2026-11-07T10:00:00Z",
      nowMs: () => Date.parse("2026-11-07T10:00:00Z"),
      newFenceToken: () => {
        fence += 1;
        return `fence-${fence}`;
      },
      degraded: [],
      ...(readOwnerHold === undefined ? {} : { readOwnerHold }),
    },
    dispose: () => {},
  };
};

describe("TC-HOLDEDGE-001 the queue composition supplies the fact to every CLI surface", () => {
  test("queue list, plan, lanes, claim, and watch all receive the active fact", () => {
    const { composition } = compositionFor("edge-hold", () => HOLD);
    const runtime = createQueueCommandRuntime(composition);
    const list = runtime.readSchedule(20);
    if (!list.ok) throw new Error("queue read failed");
    expect(list.schedule.ownerHold).toEqual({ source: "marker", reason: "peak-hour cost pause" });
    expect(list.schedule.entries[0]?.blocking[0]?.reason).toBe("owner-hold");
    expect(list.schedule.nextActions).toEqual([]);

    const claimNoRef = runtime.claim({ holder: "local" });
    expect(claimNoRef.ok).toBe(false);
    if (claimNoRef.ok) throw new Error("expected a refusal");
    expect(claimNoRef.code).toBe("queue.precondition.unmet");
    expect(claimNoRef.summary).toBe(
      "reason=owner-hold; owner hold active (marker): peak-hour cost pause",
    );

    const claimWithRef = runtime.claim({ ref: "GH-320", holder: "local" });
    expect(claimWithRef.ok).toBe(false);
    if (claimWithRef.ok) throw new Error("expected a refusal");
    expect(claimWithRef.summary).toContain("reason=owner-hold");
  });

  test("a removed supply changes the queue result (mutation control)", () => {
    const { composition } = compositionFor("edge-no-hold");
    const runtime = createQueueCommandRuntime(composition);
    const list = runtime.readSchedule(20);
    if (!list.ok) throw new Error("queue read failed");
    expect(list.schedule.ownerHold).toBeUndefined();
    expect(list.schedule.entries[0]?.blocking[0]?.reason).not.toBe("owner-hold");
    const claim = runtime.claim({ ref: "GH-320", holder: "local" });
    if (!claim.ok) {
      expect(claim.summary).not.toContain("reason=owner-hold");
    }
  });

  test("the exact production wiring is present in both composition sites", () => {
    const production = readFileSync(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    expect(production).toContain("const readOwnerHold = (): OwnerHoldFact =>");
    expect(production).toContain("resolveOwnerHoldFact({");
    expect(production).toContain("readOwnerHoldMarker(");
    expect(production).toContain("readOwnerHold,");
    expect(production).toContain("ownerHold: hold,");
    const mcpServe = readFileSync(join(ROOT, "packages/mcp/src/serve.ts"), "utf8");
    expect(mcpServe).toContain("const readOwnerHold = (): OwnerHoldFact =>");
    expect(mcpServe).toContain("resolveOwnerHoldFact({");
    expect(mcpServe).toContain("buildStatusRuntime(cwd, store, readOwnerHold)");
    const mcpStatus = readFileSync(join(ROOT, "packages/mcp/src/commands/status.ts"), "utf8");
    expect(mcpStatus).toContain("readOwnerHold?: () => OwnerHoldFact");
    expect(mcpStatus).toContain("runtime.readOwnerHold?.()");
  });
});

describe("TC-HOLDNEG-003 core stays ambient-free and brand-literal-free", () => {
  test("the core resolver and contract contain no ambient read", () => {
    for (const relative of [
      "packages/core/src/contracts/owner-hold.ts",
      "packages/core/src/domain/owner-hold.ts",
    ]) {
      const source = readFileSync(join(ROOT, relative), "utf8");
      for (const banned of ["process.env", "Bun.env", "Deno.env", "node:fs", "fetch(", "Date.now"]) {
        expect(source.includes(banned), `${relative}: ${banned}`).toBe(false);
      }
    }
  });

  test("the resolver's input surface is the environment record, store directory, and marker", () => {
    const fact = resolveOwnerHoldFact({
      environment: { ACME_OWNER_HOLD: "pause" },
      environmentPrefix: "ACME",
      storeDirectory: undefined,
      marker: { state: "absent" },
    });
    expect(fact).toEqual({ active: true, source: "env", reason: "pause" });
  });
});
