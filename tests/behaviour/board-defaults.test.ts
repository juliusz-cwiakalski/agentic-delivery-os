/**
 * TC-SLA-006, TC-SLA-007, TC-SLA-008, and the TC-SLA-012 behaviour half —
 * default application, permanent escalation, structural never-merge protection,
 * and policy-as-data behaviour over the real state ledger.
 */
import { describe, expect, test } from "bun:test";
import type {
  OwnerGateSlaDecisionRecord,
  OwnerGateSlaInput,
} from "../../packages/core/src/contracts/index";
import {
  evaluateOwnerGateSla,
  validateOwnerGateSlaPolicy,
} from "../../packages/core/src/domain/owner-gate-sla";
import {
  appendOwnerGateSlaDecision,
  readOwnerGateSlaDecisions,
} from "../../packages/core/src/state/index";
import {
  asPolicy,
  BOARD_NOW_ISO,
  BOARD_NOW_MS,
  clonePolicy,
  DAY_MS,
  gateFact,
  HOUR_MS,
  ownerReviewGate,
  shippedPolicy,
  waiverGate,
} from "../fixtures/board/matrix";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";
import { guardStore } from "./verify-support";

const evaluate = (
  gates: OwnerGateSlaInput["gates"],
  overrides: Partial<OwnerGateSlaInput> = {},
): ReturnType<typeof evaluateOwnerGateSla> =>
  evaluateOwnerGateSla({
    audience: "owner",
    nowMs: BOARD_NOW_MS,
    nowIso: BOARD_NOW_ISO,
    policy: shippedPolicy(),
    gates,
    decisions: [],
    ...overrides,
  });

const appendAll = (
  store: ReturnType<typeof openStore>["store"],
  decisions: readonly OwnerGateSlaDecisionRecord[],
): void => {
  for (const [index, decision] of decisions.entries()) {
    const appended = appendOwnerGateSlaDecision(store, {
      decision,
      fenceToken: `board-fence-${index}`,
    });
    if (!appended.ok) throw new Error(appended.error.code);
  }
};

type Ledger = ReturnType<typeof openStore>["store"];
const withLedger = (body: (store: Ledger) => void): void => {
  const root = makeTempRoot("gh229-defaults");
  try {
    const identity = makeIdentity(root, { workspaceId: "owner-gate-sla-defaults" });
    const { store } = openStore(identity);
    body(store);
  } finally {
    removeRoot(root);
  }
};

describe("TC-SLA-006 72 h default application on a defaultable waiver gate", () => {
  test("applies owner-review-first, never synthesizes waivedBy, and records exactly once", () => {
    withLedger((store) => {
      const recorder = { calls: [] as string[] };
      const guarded = guardStore(store, recorder, { throwOnMutation: false });
      const first = evaluate([waiverGate("GH-301", 73 * HOUR_MS)]);
      expect(first.gates[0]?.slaState).toBe("default-applied");
      expect(first.gates[0]?.default).toBe("owner-review-first");
      expect(first.gates[0]?.waivedBy).toBeNull();
      expect(first.gates[0]?.age).toBe(73 * HOUR_MS);
      expect(first.decisionsToApply).toHaveLength(1);

      appendAll(guarded.store, first.decisionsToApply);
      expect(recorder.calls.filter((call) => call === "acquireFence")).toHaveLength(1);
      expect(recorder.calls.filter((call) => call === "append")).toHaveLength(1);

      const read = readOwnerGateSlaDecisions(store);
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.recordCount).toBe(1);
        const record = read.value.records[0];
        expect(record?.gateId).toBe("GH-301:waiver");
        expect(record?.appliedDefault).toBe("owner-review-first");
        expect(record?.appliedAt).toBe(BOARD_NOW_ISO);
        expect(record?.thresholdCrossedMs).toBe(72 * HOUR_MS);
        expect(record?.clockSource).toBe("activity-timestamp");
        expect(Object.keys(record ?? {}).sort()).toEqual(
          [
            "appliedAt",
            "appliedDefault",
            "clockSource",
            "gateId",
            "gateKind",
            "schemaId",
            "thresholdCrossedMs",
            "workItemRef",
          ].sort(),
        );
      }

      const replay = evaluate([waiverGate("GH-301", 73 * HOUR_MS)], {
        decisions: read.ok ? read.value.records : [],
      });
      expect(replay.gates[0]?.slaState).toBe("default-applied");
      expect(replay.gates[0]?.default).toBe("owner-review-first");
      expect(replay.decisionsToApply).toEqual([]);
    });
  });

  test("control: 71 h 59 m is escalated with no record", () => {
    const result = evaluate([waiverGate("GH-302", 72 * HOUR_MS - 60_000)]);
    expect(result.gates[0]?.slaState).toBe("escalated");
    expect(result.gates[0]?.default).toBeNull();
    expect(result.decisionsToApply).toEqual([]);
  });
});

describe("TC-SLA-007 no pre-agreed default: owner-review escalates indefinitely", () => {
  test("every age stays escalated with a null default and zero records", () => {
    for (const age of [73 * HOUR_MS, 7 * DAY_MS, 30 * DAY_MS, 365 * DAY_MS]) {
      const result = evaluate([ownerReviewGate("GH-303", age)]);
      expect(result.gates[0]?.slaState).toBe("escalated");
      expect(result.gates[0]?.default).toBeNull();
      expect(result.gates[0]?.waivedBy).toBeNull();
      expect(result.decisionsToApply).toEqual([]);
    }
  });

  test("advancing the clock to one year never invents a default", () => {
    const gate = ownerReviewGate("GH-304", 73 * HOUR_MS);
    for (const advance of [7 * DAY_MS, 30 * DAY_MS, 365 * DAY_MS]) {
      const result = evaluate([gate], { nowMs: BOARD_NOW_MS + advance });
      expect(result.gates[0]?.slaState).toBe("escalated");
      expect(result.decisionsToApply).toEqual([]);
    }
  });

  test("the waiver default never falls back to an owner-review gate", () => {
    const result = evaluate([ownerReviewGate("GH-305", 100 * HOUR_MS)]);
    expect(result.gates[0]?.default).toBeNull();
  });

  test("the policy row is an explicit non-defaultable statement", () => {
    const row = shippedPolicy().rows.find((candidate) => candidate.kind === "owner-review");
    expect(row).toMatchObject({ neverMerge: true, defaultable: false, default: null });
  });

  test("positive control: a waiver gate at the same age is default-applied", () => {
    expect(evaluate([waiverGate("GH-306", 100 * HOUR_MS)]).gates[0]?.slaState).toBe(
      "default-applied",
    );
  });
});

describe("TC-SLA-008 never-merge protection is structural and permanent", () => {
  test("no never-merge gate is ever default-applied at any age or repetition", () => {
    const gates = [72 * HOUR_MS, 73 * HOUR_MS, 7 * DAY_MS, 30 * DAY_MS, 365 * DAY_MS].map(
      (age, index) => ownerReviewGate(`GH-40${index}`, age),
    );
    for (let repetition = 0; repetition < 10; repetition += 1) {
      const result = evaluate(gates, { nowMs: BOARD_NOW_MS + repetition * DAY_MS });
      for (const gate of result.gates) {
        expect(gate.slaState).not.toBe("default-applied");
        expect(gate.default).toBeNull();
      }
      expect(result.decisionsToApply).toEqual([]);
    }
  });

  test("a recorded waiver is the only override evidence and never changes the SLA state", () => {
    const result = evaluate([ownerReviewGate("GH-410", 100 * HOUR_MS, { waivedBy: "owner" })]);
    expect(result.gates[0]?.waivedBy).toBe("owner");
    expect(result.gates[0]?.slaState).toBe("escalated");
    expect(result.gates[0]?.default).toBeNull();
  });

  test("expiry alone never populates waivedBy", () => {
    const result = evaluate([waiverGate("GH-411", 100 * HOUR_MS)]);
    expect(result.gates[0]?.waivedBy).toBeNull();
    expect(result.gates[0]?.default).toBe("owner-review-first");
  });

  test("the policy table structurally excludes the class from default machinery", () => {
    const row = shippedPolicy().rows.find((candidate) => candidate.kind === "owner-review");
    expect(row?.neverMerge).toBe(true);
    expect(row?.defaultable).toBe(false);
    expect(row?.default).toBeNull();
  });

  test("mutation control: a flipped temp map would apply a default, proving the test is live", () => {
    const flipped = clonePolicy();
    const row = flipped.rows.find((candidate) => candidate.kind === "owner-review");
    if (row === undefined) throw new Error("owner-review row missing");
    row.neverMerge = false;
    row.defaultable = true;
    row.default = "owner-review-first";
    const result = evaluate([ownerReviewGate("GH-412", 100 * HOUR_MS)], {
      policy: asPolicy(flipped),
    });
    expect(result.gates[0]?.slaState).toBe("default-applied");
    expect(result.decisionsToApply).toHaveLength(1);
    expect(shippedPolicy().rows[0]?.default).toBeNull();
  });

  test("an unknown kind is never defaulted even when its class is flagged never-merge", () => {
    const result = evaluate([gateFact({ id: "GH-413", kind: "mystery", ageMs: 100 * HOUR_MS })]);
    expect(result.gates[0]?.slaState).toBe("escalated");
    expect(result.gates[0]?.default).toBeNull();
    expect(result.decisionsToApply).toEqual([]);
  });
});

describe("TC-SLA-012 policy-as-data behaviour and validation", () => {
  test("an unknown kind at 100 h escalates with nothing invented", () => {
    const result = evaluate([
      gateFact({ id: "GH-420", kind: "owner-review-v2", ageMs: 100 * HOUR_MS }),
    ]);
    expect(result.gates[0]?.slaState).toBe("escalated");
    expect(result.gates[0]?.default).toBeNull();
    expect(result.decisionsToApply).toEqual([]);
  });

  test("a temp map making owner-review defaultable changes the observed outcome", () => {
    const variant = clonePolicy();
    const row = variant.rows.find((candidate) => candidate.kind === "owner-review");
    if (row === undefined) throw new Error("owner-review row missing");
    row.neverMerge = false;
    row.defaultable = true;
    row.default = "owner-review-first";
    expect(
      evaluate([ownerReviewGate("GH-421", 100 * HOUR_MS)], { policy: asPolicy(variant) }).gates[0]
        ?.slaState,
    ).toBe("default-applied");
    expect(evaluate([ownerReviewGate("GH-422", 100 * HOUR_MS)]).gates[0]?.slaState).toBe(
      "escalated",
    );
  });

  test("a temp map with no waiver default escalates and invents nothing", () => {
    const variant = clonePolicy();
    const row = variant.rows.find((candidate) => candidate.kind === "waiver");
    if (row === undefined) throw new Error("waiver row missing");
    row.defaultable = false;
    row.default = null;
    const result = evaluate([waiverGate("GH-423", 100 * HOUR_MS)], { policy: asPolicy(variant) });
    expect(result.gates[0]?.slaState).toBe("escalated");
    expect(result.gates[0]?.default).toBeNull();
    expect(result.decisionsToApply).toEqual([]);
  });

  test("a third kind with its own default is handled without an engine change", () => {
    const variant = clonePolicy();
    variant.rows.push({
      kind: "owner-review-v2",
      class: "owner-review",
      neverMerge: false,
      defaultable: true,
      default: "owner-review-first",
    });
    const result = evaluate(
      [gateFact({ id: "GH-424", kind: "owner-review-v2", ageMs: 100 * HOUR_MS })],
      { policy: asPolicy(variant) },
    );
    expect(result.gates[0]?.slaState).toBe("default-applied");
  });

  test("the policy validator rejects two defaults on one kind, a never-merge default, and sentinels", () => {
    const duplicate = clonePolicy();
    duplicate.rows.push({
      kind: "waiver",
      class: "waiver",
      neverMerge: false,
      defaultable: true,
      default: "owner-review-first",
    });
    expect(validateOwnerGateSlaPolicy(asPolicy(duplicate))).toContain("duplicate-kind");

    const neverMerge = clonePolicy();
    const neverMergeRow = neverMerge.rows[0];
    if (neverMergeRow === undefined) throw new Error("owner-review row missing");
    neverMergeRow.default = "owner-review-first";
    expect(validateOwnerGateSlaPolicy(asPolicy(neverMerge))).toContain("never-merge-default");

    const nonDefaultable = clonePolicy();
    const nonDefaultableRow = nonDefaultable.rows[0];
    if (nonDefaultableRow === undefined) throw new Error("owner-review row missing");
    nonDefaultableRow.default = "owner-review-first";
    expect(validateOwnerGateSlaPolicy(asPolicy(nonDefaultable))).toContain(
      "non-defaultable-default",
    );
    expect(validateOwnerGateSlaPolicy(shippedPolicy())).toEqual([]);
  });
});
