/**
 * TC-SUP-084 — every entry, action, and refusal carries non-empty evidence; the
 * completeness control is a structural walk, not a count (GH-295 NFR-6, AC-F2-1,
 * AC-F8-1).
 */
import { describe, expect, test } from "bun:test";
import { claimSingleFlightRefusal, runSupervisionBattery } from "../../packages/core/src/app/index";
import { createSupervisionHarness, syntheticReadPort } from "../fixtures/supervise/harness";
import {
  LANE_REF,
  mixedScope,
  seedHeartbeat,
  seedLane,
  seedLiveLease,
  stalledAndParked,
} from "../fixtures/supervise/records";

const FORBIDDEN_VALUES = new Set(["", "-", "n/a"]);

type EvidenceEntry = { readonly code?: unknown };
type EvidenceBearer = { readonly evidence?: readonly EvidenceEntry[] };

const walk = (report: {
  readonly lanes: readonly EvidenceBearer[];
  readonly supervisors: readonly EvidenceBearer[];
  readonly actions: readonly EvidenceBearer[];
}): readonly string[] => {
  const failures: string[] = [];
  const groups: readonly (readonly [string, readonly EvidenceBearer[]])[] = [
    ["lanes", report.lanes],
    ["supervisors", report.supervisors],
    ["actions", report.actions],
  ];
  for (const [group, entries] of groups) {
    entries.forEach((entry, index) => {
      const evidence = entry.evidence ?? [];
      if (evidence.length === 0) failures.push(`${group}[${String(index)}].evidence is empty`);
      for (const [itemIndex, item] of evidence.entries()) {
        if (typeof item.code !== "string" || FORBIDDEN_VALUES.has(item.code)) {
          failures.push(
            `${group}[${String(index)}].evidence[${String(itemIndex)}].code is invalid`,
          );
        }
      }
    });
  }
  return failures;
};

describe("TC-SUP-084 the mixed scope carries evidence everywhere", () => {
  test("every lane, claim, and action carries non-empty code evidence", () => {
    const reads = { count: 0 };
    const result = runSupervisionBattery({
      repository: "github.com/example/supervision-repo",
      nowMs: Date.parse("2026-11-17T00:00:00.000Z"),
      nowIso: "2026-11-17T00:00:00.000Z",
      runId: "run-supervision-fixture",
      read: syntheticReadPort(mixedScope(), reads),
    });
    // The mixed scope parks the stalled lane and reports the claim, so both the
    // report and the action path are walked.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(walk(result.report)).toEqual([]);
  });

  test("a real applied action carries evidence too", async () => {
    const harness = createSupervisionHarness({ label: "totality-action" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -(300_000 + 1) });
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const data = (JSON.parse(run.stdout) as { data?: Record<string, unknown> }).data;
      if (data === undefined) throw new Error("report data missing");
      expect(((data.actions ?? []) as readonly unknown[]).length).toBe(1);
      expect(
        walk({
          lanes: (data.lanes ?? []) as readonly EvidenceBearer[],
          supervisors: (data.supervisors ?? []) as readonly EvidenceBearer[],
          actions: (data.actions ?? []) as readonly EvidenceBearer[],
        }),
      ).toEqual([]);
    } finally {
      harness.remove();
    }
  });

  test("a dropped evidence member fails the walk naming the entry path", () => {
    const mutated = {
      lanes: [{ evidence: [] }, { evidence: [{ code: "" }] }],
      supervisors: [],
      actions: [],
    };
    const failures = walk(mutated);
    expect(failures.join("\n")).toContain("lanes[0].evidence is empty");
    expect(failures.join("\n")).toContain("lanes[1].evidence[0].code is invalid");
  });

  test("both refusal cells ride the failure summary with the identity and holder", async () => {
    const single = createSupervisionHarness({ label: "totality-single" });
    try {
      stalledAndParked(single.seed);
      seedLiveLease(single.seed, { ref: LANE_REF, holder: "holder-a" });
      const run = await single.runCli(["supervise", "--json"], {
        claimRefusal: (ref) => {
          const refusal = claimSingleFlightRefusal(single.store, {
            ref,
            holder: "supervise",
            nowMs: single.nowMs,
          });
          return refusal === undefined
            ? undefined
            : {
                code: "queue.single-flight",
                ...(refusal.holder === undefined ? {} : { holder: refusal.holder }),
              };
        },
      });
      expect(run.exitCode).toBe(1);
      const envelope = JSON.parse(run.stdout) as { error?: { code?: string; summary?: string } };
      expect(envelope.error?.code).toBe("queue.single-flight");
      expect(envelope.error?.summary ?? "").toContain("holder-a");
    } finally {
      single.remove();
    }
  });
});
